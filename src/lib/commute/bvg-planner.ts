import { JourneyLeg, JourneyResult } from '@/lib/types';
import { PlanTripParams } from './otp';

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

interface BvgResponse {
  journeys: { legs: BvgLeg[] }[];
}

function mapMode(leg: BvgLeg): JourneyLeg['mode'] {
  if (leg.walking) return 'walk';
  const product = leg.line?.product ?? '';
  const valid = ['subway', 'suburban', 'tram', 'bus', 'ferry', 'regional', 'express', 'taxi'];
  return valid.includes(product) ? (product as JourneyLeg['mode']) : 'bus';
}

// v6.bvg.transport.rest has no documented rate limit, so we pace requests ourselves rather
// than find the limit by getting throttled mid-job. A single shared gate (rather than a
// per-worker delay) keeps the total request rate bounded no matter how many concurrent
// workers call planTrip — see COMMUTE_OTP_CONCURRENCY in recompute.ts.
//
// The gate is adaptive rather than fixed: every 429 slows it down (so a job never keeps
// hammering a limit it's already hit), and a long clean streak cautiously speeds it back up
// toward the configured base rate. This lets a multi-hour job find a safe pace on its own
// instead of needing the base interval hand-tuned per run.
const BASE_INTERVAL_MS = Number(process.env.COMMUTE_API_MIN_INTERVAL_MS ?? '600');
const MAX_INTERVAL_MS = 10_000;
const BACKOFF_FACTOR = 1.5;
const RECOVERY_FACTOR = 0.9;
const RECOVERY_STREAK = 50;

let currentIntervalMs = BASE_INTERVAL_MS;
let consecutiveSuccesses = 0;
let nextSlot = 0;

async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + currentIntervalMs;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

function recordRateLimited(): void {
  currentIntervalMs = Math.min(MAX_INTERVAL_MS, Math.round(currentIntervalMs * BACKOFF_FACTOR));
  consecutiveSuccesses = 0;
}

function recordSuccess(): void {
  if (currentIntervalMs <= BASE_INTERVAL_MS) return;
  consecutiveSuccesses++;
  if (consecutiveSuccesses >= RECOVERY_STREAK) {
    currentIntervalMs = Math.max(BASE_INTERVAL_MS, Math.round(currentIntervalMs * RECOVERY_FACTOR));
    consecutiveSuccesses = 0;
  }
}

function parseRetryAfterMs(res: Response): number | null {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/**
 * Single-itinerary trip planner backed by the public BVG API, used in place of a
 * self-hosted OTP instance the VPS can't carry alongside everything else on it. Same
 * PlanTripParams/JourneyResult contract as otp.ts's planTrip, so recompute.ts can swap
 * between the two without other changes. Never throws — an unreachable/failed lookup
 * comes back as null so one bad cell doesn't take down the whole recompute job.
 */
export async function planTrip(params: PlanTripParams): Promise<JourneyResult | null> {
  const base = process.env.BVG_API_BASE ?? 'https://v6.bvg.transport.rest';
  const when = new Date(`${params.date}T${params.time}:00`);
  const bike = params.transportModes?.some((m) => m.mode === 'BICYCLE') ?? false;

  const query = new URLSearchParams({
    'from.latitude': String(params.fromLat),
    'from.longitude': String(params.fromLng),
    // The API 500s on a bare lat/lng origin/destination ("invalid from.type: location") —
    // it needs an address label alongside the coordinates, even a synthetic one, to accept
    // it as a free-standing location rather than a resolvable stop/address lookup.
    'from.address': 'Rasterzelle',
    'to.latitude': String(params.toLat),
    'to.longitude': String(params.toLng),
    'to.address': 'Ziel',
    results: '1',
    polylines: 'false',
    remarks: 'false',
    when: when.toISOString(),
    ...(params.arriveBy ? { arrivalBy: 'true' } : {}),
    ...(bike ? { bike: 'true' } : {}),
  });

  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await waitForSlot();

    let res: Response;
    try {
      res = await fetch(`${base}/journeys?${query}`, { headers: { Accept: 'application/json' } });
    } catch (err) {
      console.error('BVG request failed:', err instanceof Error ? err.message : err);
      if (attempt === maxAttempts - 1) return null;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }

    if (res.status === 429) {
      recordRateLimited();
      const retryAfterMs = parseRetryAfterMs(res) ?? 1000 * 2 ** attempt;
      if (attempt === maxAttempts - 1) {
        console.error('BVG rate limit persisted after retries, skipping cell');
        return null;
      }
      await new Promise((r) => setTimeout(r, retryAfterMs));
      continue;
    }

    if (!res.ok) {
      console.error(`BVG request failed: HTTP ${res.status}`);
      return null;
    }

    recordSuccess();
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
  }

  return null;
}
