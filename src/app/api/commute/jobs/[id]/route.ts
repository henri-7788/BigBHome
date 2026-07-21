import { NextResponse } from 'next/server';
import { fetchCommuteJob } from '@/lib/commute/db';

export async function GET(_req: Request, ctx: RouteContext<'/api/commute/jobs/[id]'>) {
  const { id } = await ctx.params;

  try {
    const job = await fetchCommuteJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json({ success: true, job });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Laden des Jobs' },
      { status: 500 },
    );
  }
}
