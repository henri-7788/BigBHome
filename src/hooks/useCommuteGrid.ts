'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CommuteCellScore, CommuteDestination, CommuteTravelTimeScore, GridCell } from '@/lib/types';
import { loadBerlinBoundaryClient } from '@/lib/commute/boundary';
import { generateBerlinGrid } from '@/lib/commute/grid';
import { averageDurationForDestination, scoreCell } from '@/lib/commute/scoring';
import { fetchTravelTimeScores } from '@/lib/commute/db';

const GRID_SPACING_METERS = 500;

export function useCommuteGrid(destinations: CommuteDestination[], maxMinutes: number) {
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [travelTimes, setTravelTimes] = useState<CommuteTravelTimeScore[]>([]);
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

  // Only the very first load shows the loading spinner — reloads triggered by live polling
  // during a running recompute job should fill in the map quietly, without flashing it.
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    }
    fetchTravelTimeScores(destinationIds)
      .then((rows) => {
        setTravelTimes(rows);
        hasLoadedOnceRef.current = true;
      })
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

      // `legs` (the detailed route breakdown) isn't fetched here — it's loaded on demand
      // when the cell is clicked, see CommuteView's cell-detail fetch.
      const perDestination = destinations.map((dest) => {
        const avg = durations.find((d) => d.destinationId === dest.id)!;
        return {
          destinationId: dest.id,
          durationMinutes: avg.durationMinutes,
          transfers: avg.transfers,
          legs: null,
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
