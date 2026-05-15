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

function nextWeekdayAt(time: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hh, mm, 0, 0);
  // Advance past weekends (0=Sun, 6=Sat) and past times already elapsed today
  while (candidate <= now || candidate.getDay() === 0 || candidate.getDay() === 6) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(hh, mm, 0, 0);
  }
  return candidate;
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
  const when = nextWeekdayAt(resolvedSettings.time);

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
    ...(resolvedSettings.timeMode === 'arrival' ? { arrivalBy: 'true' } : {}),
  });

  const res = await fetch(`${base}/journeys?${params}`, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const msg =
      res.status === 503 || res.status === 502
        ? 'ÖPNV-API vorübergehend nicht erreichbar – bitte später erneut versuchen'
        : `ÖPNV-API Fehler (${res.status})`;
    throw new Error(msg);
  }

  const data: BvgResponse = await res.json();
  const journey = data.journeys?.[0];
  if (!journey) throw new Error('No journeys found');

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
}
