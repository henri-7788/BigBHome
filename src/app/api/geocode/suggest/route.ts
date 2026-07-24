import { NextRequest, NextResponse } from 'next/server';
import { suggestAddresses } from '@/lib/geocoder';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? '';

  if (query.trim().length < 3) {
    return NextResponse.json({ success: true, suggestions: [] });
  }

  try {
    const suggestions = await suggestAddresses(query);
    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Vorschläge fehlgeschlagen', suggestions: [] },
      { status: 500 },
    );
  }
}
