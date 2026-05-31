import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { Suggestion } from '@/lib/types';

export async function GET() {
  try {
    const suggestions = await db.fetchSuggestions();
    return NextResponse.json({ success: true, data: suggestions });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action }: { id: string; action: 'dismiss' } = await req.json();
    if (action === 'dismiss') {
      await db.dismissSuggestion(id);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 },
    );
  }
}
