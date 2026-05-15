import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/geocoder';
import { GeocodeResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json<GeocodeResponse>(
        { success: false, error: 'Adresse fehlt' },
        { status: 400 },
      );
    }

    const { lat, lng } = await geocodeAddress(address);
    return NextResponse.json<GeocodeResponse>({ success: true, lat, lng });
  } catch (err) {
    return NextResponse.json<GeocodeResponse>(
      { success: false, error: err instanceof Error ? err.message : 'Geocoding fehlgeschlagen' },
      { status: 500 },
    );
  }
}
