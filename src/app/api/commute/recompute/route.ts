import { NextRequest, NextResponse, after } from 'next/server';
import { TransportModePreference } from '@/lib/types';
import { initCommuteJob, finishCommuteJob, fetchLatestCommuteJob } from '@/lib/commute/db';
import { runCommuteRecompute } from '@/lib/commute/recompute';

export const maxDuration = 300;

// If set, dispatch the job to the standalone worker on the OTP Docker host instead of
// running it in this (serverless) function — see otp/worker/server.ts. Required on Vercel,
// where a full grid recompute would otherwise get killed by the function time limit.
const WORKER_URL = process.env.COMMUTE_WORKER_URL;

export async function POST(req: NextRequest) {
  let transportModes: TransportModePreference | undefined;
  let resume = false;
  let resumeJobId: string | undefined;
  try {
    const body = await req.json();
    transportModes = body?.transportModes;
    resume = body?.resume === true;
    resumeJobId = body?.jobId;
  } catch {
    // no body provided — fall back to defaults
  }

  // A double-click, a page refresh mid-submit, or a stale UI state can otherwise fire off
  // multiple concurrent jobs — each running its own recompute (and, for a fresh run, its own
  // clear-the-map step) at the same time. Beyond wasting API quota, that's what caused a
  // string of jobs to all fail at once: several clear operations racing each other tripped
  // Appwrite's abuse protection even though each one alone was paced safely.
  const activeJob = await fetchLatestCommuteJob().catch(() => null);
  if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')) {
    return NextResponse.json(
      { success: false, error: 'Es läuft bereits eine Berechnung.' },
      { status: 409 },
    );
  }

  // Resuming a stopped job reuses its id (and its already-reported progress) instead of
  // starting a fresh one — a brand-new job would reset the progress bar to 0%.
  const jobId = resume && resumeJobId ? resumeJobId : crypto.randomUUID();

  if (!resume || !resumeJobId) {
    try {
      await initCommuteJob(jobId);
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Job konnte nicht angelegt werden' },
        { status: 500 },
      );
    }
  }

  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL}/recompute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.COMMUTE_WEBHOOK_SECRET
            ? { Authorization: `Bearer ${process.env.COMMUTE_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify({ jobId, transportModes, resume }),
      });
      if (!res.ok) {
        await finishCommuteJob(jobId, `Worker antwortete mit ${res.status}`);
        return NextResponse.json({ success: false, error: 'Worker nicht erreichbar' }, { status: 502 });
      }
    } catch {
      await finishCommuteJob(jobId, 'Worker nicht erreichbar');
      return NextResponse.json({ success: false, error: 'Worker nicht erreichbar' }, { status: 502 });
    }
  } else {
    // Local dev fallback: no separate worker configured, run in-process past the response.
    after(() => runCommuteRecompute(jobId, transportModes, { resume }));
  }

  return NextResponse.json({ success: true, jobId });
}
