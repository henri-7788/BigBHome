// Tiny HTTP worker that runs the commute grid recompute on the same Docker host as OTP,
// so it isn't subject to Vercel's serverless function time limit. The Vercel-hosted
// /api/commute/recompute route dispatches jobs here instead of running them in-process
// when COMMUTE_WORKER_URL is configured (see src/app/api/commute/recompute/route.ts).
import { createServer } from 'node:http';
import { TransportModePreference } from '../../src/lib/types';
import { runCommuteRecompute } from '../../src/lib/commute/recompute';
import { finishCommuteJob } from '../../src/lib/commute/db';

const PORT = Number(process.env.WORKER_PORT ?? 8091);
const SECRET = process.env.COMMUTE_WEBHOOK_SECRET;

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
  // with progress tracked in Supabase (commute_jobs) for the Vercel-hosted UI to poll.
  res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ accepted: true }));

  runCommuteRecompute(jobId, transportModes, { resume }).catch((err) => {
    console.error(`Recompute job ${jobId} failed:`, err);
    finishCommuteJob(jobId!, err instanceof Error ? err.message : 'Unbekannter Fehler').catch(() => {});
  });
});

server.listen(PORT, () => {
  console.log(`Commute recompute worker listening on :${PORT}`);
});
