import { JourneyLeg, JourneyResult } from '@/lib/types';

interface OtpLeg {
  mode: string;
  route: { shortName: string | null } | null;
  from: { name: string };
  to: { name: string };
  startTime: number; // epoch millis
  endTime: number; // epoch millis
}

interface OtpItinerary {
  startTime: number;
  endTime: number;
  legs: OtpLeg[];
}

interface OtpPlanResponse {
  data?: { plan: { itineraries: OtpItinerary[] } };
  errors?: { message: string }[];
}

const MODE_MAP: Record<string, JourneyLeg['mode']> = {
  WALK: 'walk',
  BICYCLE: 'walk',
  SUBWAY: 'subway',
  RAIL: 'suburban',
  TRAM: 'tram',
  BUS: 'bus',
  FERRY: 'ferry',
  REGIONAL_RAIL: 'regional',
  REGIONAL_FAST_RAIL: 'express',
};

function mapMode(otpMode: string): JourneyLeg['mode'] {
  return MODE_MAP[otpMode] ?? 'bus';
}

// transportModes is inlined into the query text rather than passed as a typed GraphQL
// variable — its exact input type name in OTP's schema is unconfirmed (introspection is
// blocked by OTP's anti-abuse "BadFaithIntrospection" guard), but literal `mode: WALK`
// syntax is confirmed working against a live server. Modes only ever come from our own
// toOtpTransportModes()/DEFAULT_TRANSPORT_MODES (a fixed enum whitelist), never user input.
function buildPlanQuery(modes: { mode: string }[]): string {
  const modesLiteral = `[${modes.map((m) => `{mode: ${m.mode}}`).join(', ')}]`;
  return `
    query Plan(
      $fromLat: Float!, $fromLon: Float!,
      $toLat: Float!, $toLon: Float!,
      $date: String!, $time: String!, $arriveBy: Boolean!
    ) {
      plan(
        from: { lat: $fromLat, lon: $fromLon }
        to: { lat: $toLat, lon: $toLon }
        date: $date
        time: $time
        arriveBy: $arriveBy
        numItineraries: 1
        transportModes: ${modesLiteral}
      ) {
        itineraries {
          startTime
          endTime
          legs {
            mode
            route { shortName }
            from { name }
            to { name }
            startTime
            endTime
          }
        }
      }
    }
  `;
}

export interface PlanTripParams {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  arriveBy: boolean;
  /** Defaults to walk + public transit. */
  transportModes?: { mode: string }[];
}

const DEFAULT_TRANSPORT_MODES = [{ mode: 'WALK' }, { mode: 'TRANSIT' }];

/** Queries OTP's GraphQL API for a single itinerary and maps it onto our shared JourneyResult shape. */
export async function planTrip(params: PlanTripParams): Promise<JourneyResult | null> {
  const base = process.env.OTP_BASE_URL ?? 'http://localhost:8080';
  const modes = params.transportModes ?? DEFAULT_TRANSPORT_MODES;

  const res = await fetch(`${base}/otp/routers/default/index/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: buildPlanQuery(modes),
      variables: {
        fromLat: params.fromLat,
        fromLon: params.fromLng,
        toLat: params.toLat,
        toLon: params.toLng,
        date: params.date,
        time: params.time,
        arriveBy: params.arriveBy,
      },
    }),
  });

  if (!res.ok) {
    console.error(`OTP request failed: HTTP ${res.status}`);
    return null;
  }

  const body: OtpPlanResponse = await res.json();
  if (body.errors?.length) {
    console.error('OTP GraphQL errors:', body.errors.map((e) => e.message).join('; '));
    return null;
  }

  const itinerary = body.data?.plan?.itineraries?.[0];
  if (!itinerary) return null;

  const durationMinutes = Math.round((itinerary.endTime - itinerary.startTime) / 60000);
  const transitLegs = itinerary.legs.filter((l) => l.mode !== 'WALK' && l.mode !== 'BICYCLE');
  const transfers = Math.max(0, transitLegs.length - 1);

  const legs: JourneyLeg[] = itinerary.legs.map((leg) => ({
    mode: mapMode(leg.mode),
    lineName: leg.route?.shortName ?? null,
    origin: leg.from.name,
    destination: leg.to.name,
    durationMinutes: Math.round((leg.endTime - leg.startTime) / 60000),
  }));

  return {
    durationMinutes,
    transfers,
    legs,
    departureTime: new Date(itinerary.startTime).toISOString(),
    arrivalTime: new Date(itinerary.endTime).toISOString(),
  };
}
