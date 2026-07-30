import { NextResponse } from 'next/server';
import { fetchLatestCommuteJob } from '@/lib/commute/db';

export async function GET() {
  try {
    const job = await fetchLatestCommuteJob();
    return NextResponse.json({ success: true, job });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler beim Laden des Jobs' },
      { status: 500 },
    );
  }
}
