import { NextResponse } from 'next/server';
import { stopCommuteJob } from '@/lib/commute/db';

export async function POST(_req: Request, ctx: RouteContext<'/api/commute/jobs/[id]/stop'>) {
  const { id } = await ctx.params;

  try {
    await stopCommuteJob(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Stoppen des Jobs' },
      { status: 500 },
    );
  }
}
