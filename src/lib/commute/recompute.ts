import { TransportModePreference } from '@/lib/types';
import { loadBerlinBoundaryServer } from './boundary';
import { generateBerlinGrid } from './grid';
import { planTrip } from './otp';
import * as db from './db';

function toOtpTransportModes(prefs?: TransportModePreference): { mode: string }[] {
  if (!prefs) return [{ mode: 'WALK' }, { mode: 'TRANSIT' }];
  const modes: { mode: string }[] = [];
  if (prefs.walk) modes.push({ mode: 'WALK' });
  if (prefs.bike) modes.push({ mode: 'BICYCLE' });
  if (prefs.transit) modes.push({ mode: 'TRANSIT' });
  return modes.length > 0 ? modes : [{ mode: 'WALK' }, { mode: 'TRANSIT' }];
}

// OTP's own HTTP handler thread pool is sized to the host's CPU count (often small on a
// VPS) — pushing more concurrent requests than that just causes contention and search
// timeouts inside OTP, not faster throughput. Tune via COMMUTE_OTP_CONCURRENCY if needed.
const CONCURRENCY = Number(process.env.COMMUTE_OTP_CONCURRENCY ?? '3');

/** Runs a bounded number of tasks concurrently, waiting for all to settle. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
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

export async function runCommuteRecompute(
  jobId: string,
  transportModes?: TransportModePreference,
): Promise<void> {
  const otpModes = toOtpTransportModes(transportModes);

  try {
    const spacing = Number(process.env.COMMUTE_GRID_SPACING_METERS ?? '500');
    const boundary = await loadBerlinBoundaryServer();
    const grid = generateBerlinGrid(spacing, boundary);
    const destinations = await db.fetchCommuteDestinations();

    // Cells are the outer loop so a cell's lookups across all destinations land close
    // together in the task queue — cells then complete (and get a real score) roughly
    // in order, instead of finishing all cells for destination 1 before destination 2
    // even starts (which would leave the map looking empty until near the very end).
    const tasks: RecomputeTask[] = [];
    for (const cell of grid) {
      for (const dest of destinations) {
        for (const entry of dest.schedule) {
          tasks.push({
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

    await db.setCommuteJobTotal(jobId, tasks.length);

    let completed = 0;
    let lastReported = 0;

    await runWithConcurrency(tasks, CONCURRENCY, async (task) => {
      const result = await planTrip({
        fromLat: task.cellLat,
        fromLng: task.cellLng,
        toLat: task.destLat,
        toLng: task.destLng,
        date: nextDateForWeekday(task.weekday),
        time: task.time,
        arriveBy: task.timeMode === 'arrival',
        transportModes: otpModes,
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
      if (completed - lastReported >= 25 || completed === tasks.length) {
        lastReported = completed;
        await db.updateCommuteJobProgress(jobId, completed);
      }
    });

    await db.finishCommuteJob(jobId, null);
  } catch (err) {
    await db.finishCommuteJob(jobId, err instanceof Error ? err.message : 'Unbekannter Fehler');
  }
}
