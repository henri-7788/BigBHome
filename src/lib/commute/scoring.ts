import { CommuteDestination } from '@/lib/types';

export interface DestinationDuration {
  destinationId: string;
  durationMinutes: number | null;
  transfers: number | null;
}

type ScorableTravelTime = Pick<DestinationDuration, 'destinationId' | 'durationMinutes' | 'transfers'>;

/** Averages cached travel times for one destination's schedule entries into a single duration. */
export function averageDurationForDestination(
  destinationId: string,
  travelTimes: ScorableTravelTime[],
): { durationMinutes: number | null; transfers: number | null } {
  const matches = travelTimes.filter(
    (t) => t.destinationId === destinationId && t.durationMinutes !== null,
  );
  if (matches.length === 0) return { durationMinutes: null, transfers: null };

  const durationMinutes = Math.round(
    matches.reduce((sum, t) => sum + (t.durationMinutes ?? 0), 0) / matches.length,
  );
  const transfers = Math.round(
    matches.reduce((sum, t) => sum + (t.transfers ?? 0), 0) / matches.length,
  );
  return { durationMinutes, transfers };
}

/**
 * Weighted commute score for a single grid cell, 0-100 (100 = best).
 * Returns null if the cell is unreachable for any destination (no cached travel time at all).
 * Returns 0 if any destination's duration exceeds maxMinutes (a hard cutoff).
 */
export function scoreCell(
  durations: DestinationDuration[],
  destinations: CommuteDestination[],
  maxMinutes: number,
): number | null {
  let totalWeight = 0;
  let weightedPenalty = 0;

  for (const dest of destinations) {
    const match = durations.find((d) => d.destinationId === dest.id);
    if (!match || match.durationMinutes === null) return null;
    if (match.durationMinutes > maxMinutes) return 0;

    weightedPenalty += dest.weight * (match.durationMinutes / maxMinutes);
    totalWeight += dest.weight;
  }

  if (totalWeight === 0) return null;

  const avgPenalty = weightedPenalty / totalWeight;
  return Math.round(Math.min(100, Math.max(0, (1 - avgPenalty) * 100)));
}
