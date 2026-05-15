import { NextRequest, NextResponse } from 'next/server';
import { fetchJourney } from '@/lib/bvg';
import { JourneyRequest, JourneyResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: JourneyRequest = await req.json();
    const { fromLat, fromLng, fromAddress, toLat, toLng, toAddress, settings } = body;

    if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
      return NextResponse.json<JourneyResponse>(
        { success: false, error: 'Koordinaten fehlen' },
        { status: 400 },
      );
    }

    const journey = await fetchJourney(fromLat, fromLng, fromAddress, toLat, toLng, toAddress, settings);

    return NextResponse.json<JourneyResponse>({ success: true, data: journey });
  } catch (err) {
    return NextResponse.json<JourneyResponse>(
      { success: false, error: err instanceof Error ? err.message : 'Routenberechnung fehlgeschlagen' },
      { status: 500 },
    );
  }
}
