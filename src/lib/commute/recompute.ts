import { TransportModePreference } from '@/lib/types';
import { loadBerlinBoundaryServer } from './boundary';
import { generateBerlinGrid, spiralOrderCells } from './grid';
import { planTrip } from './bvg-planner';
import * as db from './db';

function toPlannerTransportModes(prefs?: TransportModePreference): { mode: string }[] {
  if (!prefs) return [{ mode: 'WALK' }, { mode: 'TRANSIT' }];
  const modes: { mode: string }[] = [];
  if (prefs.walk) modes.push({ mode: 'WALK' });
  if (prefs.bike) modes.push({ mode: 'BICYCLE' });
  if (prefs.transit) modes.push({ mode: 'TRANSIT' });
  return modes.length > 0 ? modes : [{ mode: 'WALK' }, { mode: 'TRANSIT' }];
}

// Trip lookups go through the public BVG API (see bvg-planner.ts) rather than a
// self-hosted OTP instance, which the VPS can't run alongside everything else on it.
// bvg-planner.ts already paces requests to a shared rate via COMMUTE_API_MIN_INTERVAL_MS;
// this just bounds how many requests can be in flight waiting on that gate at once.
const CONCURRENCY = Number(process.env.COMMUTE_OTP_CONCURRENCY ?? '2');

// How often (in completed tasks) the job checks whether it's been stopped from outside —
// same cadence as progress reporting, so stopping doesn't add extra DB traffic of its own.
const STOP_CHECK_INTERVAL_MS = 3000;

/** Runs a bounded number of tasks concurrently, waiting for all to settle. Stops picking up
 * new tasks (without cancelling ones already in flight) once `isStopped()` returns true. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  isStopped: () => boolean,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      if (isStopped()) return;
      const item = items[cursor++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
}

/** Next ISO date (YYYY-MM-DD) on/after today matching the given ISO weekday (1=Mon..7=Sun). */
function nextDateForWeekday(weekday: number): string {
  const today = new Date();
  const todayIso = today.getDay() === 0 ? 7 : today.getDay();
  let diff = weekday - todayIso;
  if (diff < 0) diff += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

function centroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return { lat, lng };
}

interface RecomputeTask {
  cellId: string;
  cellLat: number;
  cellLng: number;
  destinationId: string;
  destLat: number;
  destLng: number;
  weekday: number;
  time: string;
  timeMode: 'departure' | 'arrival';
}

function taskKey(t: Pick<RecomputeTask, 'cellId' | 'destinationId' | 'weekday' | 'time'>): string {
  return `${t.cellId}_${t.destinationId}_${t.weekday}_${t.time}`;
}

/** How many (cell, destination, schedule-entry) combinations still have no cached travel
 * time. Used by the worker's autonomous loop to decide whether there's anything left to do
 * without spinning up a full job just to find out. */
export async function countPendingTasks(): Promise<number> {
  const spacing = Number(process.env.COMMUTE_GRID_SPACING_METERS ?? '500');
  const boundary = await loadBerlinBoundaryServer();
  const grid = generateBerlinGrid(spacing, boundary);
  const destinations = await db.fetchCommuteDestinations();
  if (destinations.length === 0) return 0;

  const totalTasks = grid.length * destinations.reduce((sum, d) => sum + d.schedule.length, 0);
  const existing = await db.fetchTravelTimes(destinations.map((d) => d.id));
  return Math.max(0, totalTasks - existing.length);
}

export async function runCommuteRecompute(
  jobId: string,
  transportModes?: TransportModePreference,
  options?: { resume?: boolean },
): Promise<void> {
  const plannerModes = toPlannerTransportModes(transportModes);

  try {
    const spacing = Number(process.env.COMMUTE_GRID_SPACING_METERS ?? '500');
    const boundary = await loadBerlinBoundaryServer();
    const grid = generateBerlinGrid(spacing, boundary);
    const destinations = await db.fetchCommuteDestinations();

    // A fresh (non-resume) run starts the map over — clear whatever's cached so stale
    // results from before don't linger on cells the new job hasn't reached yet.
    if (!options?.resume) {
      await db.clearTravelTimes(destinations.map((d) => d.id));
    }

    // Start from roughly the middle (the destinations' centroid, since that's what actually
    // matters for a commute heatmap — falls back to the grid's own center if there are none
    // yet) and spiral outward, so the map fills in from the center out instead of row by row.
    const center = destinations.length > 0 ? centroid(destinations) : centroid(grid);
    const orderedGrid = spiralOrderCells(grid, center);

    // Cells are the outer loop so a cell's lookups across all destinations land close
    // together in the task queue — cells then complete (and get a real score) roughly
    // in order, instead of finishing all cells for destination 1 before destination 2
    // even starts (which would leave the map looking empty until near the very end).
    const allTasks: RecomputeTask[] = [];
    for (const cell of orderedGrid) {
      for (const dest of destinations) {
        for (const entry of dest.schedule) {
          allTasks.push({
            cellId: cell.id,
            cellLat: cell.lat,
            cellLng: cell.lng,
            destinationId: dest.id,
            destLat: dest.lat,
            destLng: dest.lng,
            weekday: entry.weekday,
            time: entry.time,
            timeMode: entry.timeMode,
          });
        }
      }
    }

    // Resuming a stopped job: skip whatever this job already computed (cached in
    // commute_travel_times) and pick up with the next not-yet-done task in spiral order.
    let remainingTasks = allTasks;
    let completed = 0;
    if (options?.resume) {
      const existing = await db.fetchTravelTimes(destinations.map((d) => d.id));
      const done = new Set(existing.map((t) => taskKey({
        cellId: t.cellId,
        destinationId: t.destinationId,
        weekday: t.weekday,
        time: t.targetTime,
      })));
      remainingTasks = allTasks.filter((t) => !done.has(taskKey(t)));
      completed = allTasks.length - remainingTasks.length;
    }

    await db.setCommuteJobTotal(jobId, allTasks.length);
    if (completed > 0) await db.updateCommuteJobProgress(jobId, completed);

    let lastReported = completed;
    let stopped = false;
    const stopCheck = setInterval(async () => {
      try {
        const current = await db.fetchCommuteJob(jobId);
        if (current?.status === 'stopped') stopped = true;
      } catch {
        // transient — try again next tick
      }
    }, STOP_CHECK_INTERVAL_MS);

    try {
      await runWithConcurrency(remainingTasks, CONCURRENCY, () => stopped, async (task) => {
        const result = await planTrip({
          fromLat: task.cellLat,
          fromLng: task.cellLng,
          toLat: task.destLat,
          toLng: task.destLng,
          date: nextDateForWeekday(task.weekday),
          time: task.time,
          arriveBy: task.timeMode === 'arrival',
          transportModes: plannerModes,
        });

        await db.upsertTravelTime({
          cellId: task.cellId,
          destinationId: task.destinationId,
          weekday: task.weekday,
          targetTime: task.time,
          durationMinutes: result?.durationMinutes ?? null,
          transfers: result?.transfers ?? null,
          legs: result?.legs ?? null,
        });

        completed++;
        if (completed - lastReported >= 25 || completed === allTasks.length) {
          lastReported = completed;
          await db.updateCommuteJobProgress(jobId, completed);
        }
      });
    } finally {
      clearInterval(stopCheck);
    }

    // If stopped from outside, leave the job in 'stopped' state rather than overwriting it —
    // whoever stopped it already set that status.
    if (!stopped) {
      await db.finishCommuteJob(jobId, null);
    }
  } catch (err) {
    await db.finishCommuteJob(jobId, err instanceof Error ? err.message : 'Unbekannter Fehler');
  }
}
