// Tiny HTTP worker that runs the commute grid recompute on the same Docker host as OTP,
// so it isn't subject to Vercel's serverless function time limit. The Vercel-hosted
// /api/commute/recompute route dispatches jobs here instead of running them in-process
// when COMMUTE_WORKER_URL is configured (see src/app/api/commute/recompute/route.ts).
//
// Besides serving manual triggers over HTTP, this process also drives an autonomous loop:
// since the BVG API is rate-limited (a full grid recompute is slow by design), there's no
// need to wait for someone to click "Neu berechnen" — the worker just keeps grinding through
// whatever's left on its own, and picks back up automatically if the container restarts
// mid-job. A job the user explicitly stopped from the app is left alone until they resume it.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { TransportModePreference } from '../../src/lib/types';
import { runCommuteRecompute, countPendingTasks } from '../../src/lib/commute/recompute';
import { finishCommuteJob, initCommuteJob, fetchLatestCommuteJob } from '../../src/lib/commute/db';

const PORT = Number(process.env.WORKER_PORT ?? 8091);
const SECRET = process.env.COMMUTE_WEBHOOK_SECRET;

// How long to wait before checking again once there's nothing to do (no pending cells, or
// the latest job is paused by the user) vs. right after finishing a run (to immediately pick
// up any work that appeared while it was running).
const IDLE_POLL_MS = 5 * 60_000;
const RECHECK_MS = 5_000;

// Guards against the autonomous loop and an HTTP-triggered request both driving the same
// job at once (they run in the same process, so this is just an in-memory set — a restart
// clears it, which is fine: a job still marked 'running' after a restart is exactly the
// crashed/orphaned case the loop is supposed to pick back up).
const inFlightJobs = new Set<string>();

async function runJob(jobId: string, transportModes?: TransportModePreference, resume = false) {
  if (inFlightJobs.has(jobId)) return;
  inFlightJobs.add(jobId);
  try {
    await runCommuteRecompute(jobId, transportModes, { resume });
  } finally {
    inFlightJobs.delete(jobId);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoRecomputeLoop() {
  for (;;) {
    let delay = IDLE_POLL_MS;
    try {
      const latest = await fetchLatestCommuteJob();

      if (latest?.status === 'stopped') {
        // User explicitly paused this job — leave it alone. Resuming happens via the app's
        // "Fortsetzen" button (a direct HTTP call to this worker), not from this loop.
      } else if (latest && (latest.status === 'running' || latest.status === 'pending')) {
        // Still marked in-progress with nothing in-flight in this process — the container
        // must have restarted mid-job. Pick it back up where it left off.
        console.log(`Auto: resuming orphaned job ${latest.id}`);
        await runJob(latest.id, undefined, true);
        delay = RECHECK_MS;
      } else {
        const pending = await countPendingTasks();
        if (pending > 0) {
          const jobId = randomUUID();
          await initCommuteJob(jobId);
          console.log(`Auto: ${pending} Zellen ausstehend, starte Job ${jobId}`);
          await runJob(jobId);
          delay = RECHECK_MS;
        }
      }
    } catch (err) {
      console.error('Auto-recompute loop error:', err);
    }
    await sleep(delay);
  }
}

async function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/recompute') {
    res.writeHead(404).end();
    return;
  }

  if (SECRET && req.headers.authorization !== `Bearer ${SECRET}`) {
    res.writeHead(401).end('Unauthorized');
    return;
  }

  let jobId: string | undefined;
  let transportModes: TransportModePreference | undefined;
  let resume = false;
  try {
    const body = JSON.parse((await readBody(req)) || '{}');
    jobId = body.jobId;
    transportModes = body.transportModes;
    resume = body.resume === true;
  } catch {
    res.writeHead(400).end('Invalid JSON body');
    return;
  }

  if (!jobId) {
    res.writeHead(400).end('jobId required');
    return;
  }

  // Acknowledge immediately — the job itself keeps running in this long-lived process,
  // with progress tracked in Appwrite (commute_jobs) for the Vercel-hosted UI to poll.
  res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ accepted: true }));

  runJob(jobId, transportModes, resume).catch((err) => {
    console.error(`Recompute job ${jobId} failed:`, err);
    finishCommuteJob(jobId!, err instanceof Error ? err.message : 'Unbekannter Fehler').catch(() => {});
  });
});

server.listen(PORT, () => {
  console.log(`Commute recompute worker listening on :${PORT}`);
});

autoRecomputeLoop();
