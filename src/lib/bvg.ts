import { JourneyLeg, JourneyResult, RouteSettings } from './types';

interface BvgLeg {
  origin: { name: string };
  destination: { name: string };
  plannedDeparture: string;
  plannedArrival: string;
  walking?: boolean;
  line?: {
    name: string;
    product: string;
  };
}

interface BvgJourney {
  legs: BvgLeg[];
}

interface BvgResponse {
  journeys: BvgJourney[];
}

function mapMode(leg: BvgLeg): JourneyLeg['mode'] {
  if (leg.walking) return 'walk';
  const product = leg.line?.product ?? '';
  const valid = ['subway', 'suburban', 'tram', 'bus', 'ferry', 'regional', 'express', 'taxi'];
  return valid.includes(product) ? (product as JourneyLeg['mode']) : 'bus';
}

function nextNWeekdaysAt(time: string, n: number): Date[] {
  const [hh, mm] = time.split(':').map(Number);
  const dates: Date[] = [];
  const candidate = new Date();
  candidate.setHours(hh, mm, 0, 0);
  candidate.setDate(candidate.getDate() + 1);
  while (dates.length < n) {
    const day = candidate.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(candidate));
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  return dates;
}

async function fetchJourneyForDate(
  base: string,
  fromLat: number,
  fromLng: number,
  fromAddress: string,
  workLat: number,
  workLng: number,
  workAddress: string,
  when: Date,
  timeMode: 'departure' | 'arrival',
): Promise<JourneyResult | null> {
  const params = new URLSearchParams({
    'from.latitude': String(fromLat),
    'from.longitude': String(fromLng),
    'from.address': fromAddress,
    'to.latitude': String(workLat),
    'to.longitude': String(workLng),
    'to.address': workAddress,
    results: '3',
    polylines: 'false',
    remarks: 'false',
    when: when.toISOString(),
    ...(timeMode === 'arrival' ? { arrivalBy: 'true' } : {}),
  });

  try {
    const res = await fetch(`${base}/journeys?${params}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const data: BvgResponse = await res.json();
    const journey = data.journeys?.[0];
    if (!journey) return null;

    const legs = journey.legs;
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];

    const departureTime = firstLeg.plannedDeparture;
    const arrivalTime = lastLeg.plannedArrival;
    const durationMinutes = Math.round(
      (new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000,
    );

    const transitLegs = legs.filter((l) => !l.walking && l.line);
    const transfers = Math.max(0, transitLegs.length - 1);

    const mappedLegs: JourneyLeg[] = legs.map((leg) => {
      const start = new Date(leg.plannedDeparture).getTime();
      const end = new Date(leg.plannedArrival).getTime();
      return {
        mode: mapMode(leg),
        lineName: leg.line?.name ?? null,
        origin: leg.origin.name,
        destination: leg.destination.name,
        durationMinutes: Math.round((end - start) / 60000),
      };
    });

    return { durationMinutes, transfers, legs: mappedLegs, departureTime, arrivalTime };
  } catch {
    return null;
  }
}

export async function fetchJourney(
  fromLat: number,
  fromLng: number,
  fromAddress: string,
  workLat: number,
  workLng: number,
  workAddress: string,
  settings?: RouteSettings,
): Promise<JourneyResult> {
  const base = process.env.BVG_API_BASE ?? 'https://v6.bvg.transport.rest';
  const resolvedSettings = settings ?? { timeMode: 'arrival', time: '08:00' };

  const weekdays = nextNWeekdaysAt(resolvedSettings.time, 5);

  const results = await Promise.all(
    weekdays.map((when) =>
      fetchJourneyForDate(
        base,
        fromLat, fromLng, fromAddress,
        workLat, workLng, workAddress,
        when,
        resolvedSettings.timeMode,
      ),
    ),
  );

  const successful = results.filter((r): r is JourneyResult => r !== null);
  if (successful.length === 0) {
    throw new Error('ÖPNV-API vorübergehend nicht erreichbar – bitte später erneut versuchen');
  }

  const avgDuration = Math.round(
    successful.reduce((sum, r) => sum + r.durationMinutes, 0) / successful.length,
  );
  const avgTransfers = Math.round(
    successful.reduce((sum, r) => sum + r.transfers, 0) / successful.length,
  );

  // Use the first successful journey's legs as representative
  const representative = successful[0];

  return {
    durationMinutes: avgDuration,
    transfers: avgTransfers,
    legs: representative.legs,
    departureTime: representative.departureTime,
    arrivalTime: representative.arrivalTime,
    averagedDays: successful.length,
  };
}
