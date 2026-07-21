'use client';

import { useEffect, useMemo, useState } from 'react';
import { CommuteCellScore, CommuteDestination, CommuteTravelTime, GridCell } from '@/lib/types';
import { loadBerlinBoundaryClient } from '@/lib/commute/boundary';
import { generateBerlinGrid } from '@/lib/commute/grid';
import { averageDurationForDestination, scoreCell } from '@/lib/commute/scoring';
import { fetchTravelTimes } from '@/lib/commute/db';

const GRID_SPACING_METERS = 500;

export function useCommuteGrid(destinations: CommuteDestination[], maxMinutes: number) {
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [travelTimes, setTravelTimes] = useState<CommuteTravelTime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadBerlinBoundaryClient()
      .then((boundary) => {
        if (!cancelled) setGrid(generateBerlinGrid(GRID_SPACING_METERS, boundary));
      })
      .catch((err) => console.error('Berlin boundary load error:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const destinationIds = useMemo(() => destinations.map((d) => d.id), [destinations]);
  // Bumped to manually re-trigger the load effect below (e.g. after a recompute job finishes).
  const [reloadToken, setReloadToken] = useState(0);
  const reloadTravelTimes = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoading(true);
    fetchTravelTimes(destinationIds)
      .then((rows) => setTravelTimes(rows))
      .catch((err) => console.error('DB travel times load error:', err))
      .finally(() => setLoading(false));
  }, [destinationIds, reloadToken]);

  const cellScores: CommuteCellScore[] = useMemo(() => {
    if (grid.length === 0 || destinations.length === 0) return [];

    return grid.map((cell) => {
      const cellTravelTimes = travelTimes.filter((t) => t.cellId === cell.id);

      const durations = destinations.map((dest) => ({
        destinationId: dest.id,
        ...averageDurationForDestination(dest.id, cellTravelTimes),
      }));

      const perDestination = destinations.map((dest) => {
        const match = cellTravelTimes.find((t) => t.destinationId === dest.id);
        const avg = durations.find((d) => d.destinationId === dest.id)!;
        return {
          destinationId: dest.id,
          durationMinutes: avg.durationMinutes,
          transfers: avg.transfers,
          legs: match?.legs ?? null,
        };
      });

      return {
        cellId: cell.id,
        lat: cell.lat,
        lng: cell.lng,
        score: scoreCell(durations, destinations, maxMinutes),
        perDestination,
      };
    });
  }, [grid, travelTimes, destinations, maxMinutes]);

  return { grid, cellScores, loading, reloadTravelTimes };
}
