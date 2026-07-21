import { NextRequest, NextResponse, after } from 'next/server';
import { TransportModePreference } from '@/lib/types';
import { initCommuteJob, finishCommuteJob } from '@/lib/commute/db';
import { runCommuteRecompute } from '@/lib/commute/recompute';

export const maxDuration = 300;

// If set, dispatch the job to the standalone worker on the OTP Docker host instead of
// running it in this (serverless) function — see otp/worker/server.ts. Required on Vercel,
// where a full grid recompute would otherwise get killed by the function time limit.
const WORKER_URL = process.env.COMMUTE_WORKER_URL;

export async function POST(req: NextRequest) {
  const jobId = crypto.randomUUID();
  let transportModes: TransportModePreference | undefined;
  try {
    const body = await req.json();
    transportModes = body?.transportModes;
  } catch {
    // no body provided — fall back to defaults
  }

  try {
    await initCommuteJob(jobId);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Job konnte nicht angelegt werden' },
      { status: 500 },
    );
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
        body: JSON.stringify({ jobId, transportModes }),
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
    after(() => runCommuteRecompute(jobId, transportModes));
  }

  return NextResponse.json({ success: true, jobId });
}
