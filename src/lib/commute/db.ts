import { Query } from 'appwrite';
import { databases, DATABASE_ID } from '@/lib/appwrite';
import {
  CommuteDestination,
  CommuteJob,
  CommuteTravelTime,
  JourneyLeg,
} from '@/lib/types';

const DESTINATIONS = 'commute_destinations';
const TRAVEL_TIMES = 'commute_travel_times';
const JOBS = 'commute_jobs';
const PAGE_SIZE = 100;

// The recompute job can run for hours across thousands of Appwrite calls. Without a retry,
// a single transient blip (e.g. a momentary DNS failure) throws and kills the whole job,
// discarding all progress made so far — so retry a few times with backoff before giving up.
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr;
}

async function listAll<T extends { $id: string }>(
  collection: string,
  queries: string[],
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await databases.listDocuments(DATABASE_ID, collection, [
      ...queries,
      Query.limit(PAGE_SIZE),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ]);
    const rows = page.documents as unknown as T[];
    results.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1].$id;
  }
  return results;
}

/** commute_travel_times has no natural single-column key — derive a stable 32-char
 * document id from the composite (cell, destination, weekday, time) key so re-running
 * a recompute upserts the same row instead of piling up duplicates. Uses the isomorphic
 * Web Crypto API (not node:crypto) since this module is also bundled into client code. */
export async function travelTimeDocId(
  cellId: string,
  destinationId: string,
  weekday: number,
  targetTime: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${cellId}_${destinationId}_${weekday}_${targetTime}`);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface CommuteDestinationRow {
  $id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  weight: number;
  schedule: string;
}

interface CommuteTravelTimeRow {
  cell_id: string;
  destination_id: string;
  weekday: number;
  target_time: string;
  duration_minutes: number | null;
  transfers: number | null;
  legs: string | null;
}

interface CommuteJobRow {
  $id: string;
  status: CommuteJob['status'];
  total_cells: number;
  completed_cells: number;
  error: string | null;
  $createdAt: string;
  $updatedAt: string;
}

function rowToDestination(row: CommuteDestinationRow): CommuteDestination {
  return {
    id: row.$id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    weight: row.weight,
    schedule: row.schedule ? JSON.parse(row.schedule) : [],
  };
}

function rowToTravelTime(row: CommuteTravelTimeRow): CommuteTravelTime {
  return {
    cellId: row.cell_id,
    destinationId: row.destination_id,
    weekday: row.weekday,
    targetTime: row.target_time,
    durationMinutes: row.duration_minutes,
    transfers: row.transfers,
    legs: row.legs ? (JSON.parse(row.legs) as JourneyLeg[]) : null,
  };
}

function rowToJob(row: CommuteJobRow): CommuteJob {
  return {
    id: row.$id,
    status: row.status,
    totalCells: row.total_cells,
    completedCells: row.completed_cells,
    error: row.error,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export async function fetchCommuteDestinations(): Promise<CommuteDestination[]> {
  return withRetry(async () => {
    const rows = await listAll<CommuteDestinationRow>(DESTINATIONS, [Query.orderAsc('$createdAt')]);
    return rows.map(rowToDestination);
  });
}

export async function insertCommuteDestination(dest: CommuteDestination): Promise<void> {
  await databases.createDocument(DATABASE_ID, DESTINATIONS, dest.id, {
    name: dest.name,
    address: dest.address,
    lat: dest.lat,
    lng: dest.lng,
    weight: dest.weight,
    schedule: JSON.stringify(dest.schedule),
  });
}

export async function updateCommuteDestination(dest: CommuteDestination): Promise<void> {
  await databases.updateDocument(DATABASE_ID, DESTINATIONS, dest.id, {
    name: dest.name,
    address: dest.address,
    lat: dest.lat,
    lng: dest.lng,
    weight: dest.weight,
    schedule: JSON.stringify(dest.schedule),
  });
}

export async function deleteCommuteDestination(id: string): Promise<void> {
  await databases.deleteDocument(DATABASE_ID, DESTINATIONS, id);
}

// ─── Travel times ──────────────────────────────────────────────────────────────

export async function fetchTravelTimes(destinationIds: string[]): Promise<CommuteTravelTime[]> {
  if (destinationIds.length === 0) return [];
  const rows = await listAll<CommuteTravelTimeRow & { $id: string }>(TRAVEL_TIMES, [
    Query.equal('destination_id', destinationIds),
  ]);
  return rows.map(rowToTravelTime);
}

// Clearing all travel times for a fresh recompute needs a bulk delete-by-query, which the
// public SDK doesn't expose (only node-appwrite's admin client does — see admin.ts). Doing
// it here document-by-document tripped Appwrite's abuse protection even at a conservative
// pace, so that responsibility moved out of this (public-SDK) module entirely.

export async function upsertTravelTime(travelTime: CommuteTravelTime): Promise<void> {
  await withRetry(async () => {
    const id = await travelTimeDocId(
      travelTime.cellId,
      travelTime.destinationId,
      travelTime.weekday,
      travelTime.targetTime,
    );
    await databases.upsertDocument(DATABASE_ID, TRAVEL_TIMES, id, {
      cell_id: travelTime.cellId,
      destination_id: travelTime.destinationId,
      weekday: travelTime.weekday,
      target_time: travelTime.targetTime,
      duration_minutes: travelTime.durationMinutes,
      transfers: travelTime.transfers,
      legs: travelTime.legs ? JSON.stringify(travelTime.legs) : null,
    });
  });
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function initCommuteJob(id: string): Promise<void> {
  await databases.createDocument(DATABASE_ID, JOBS, id, {
    status: 'pending',
    total_cells: 0,
    completed_cells: 0,
  });
}

export async function setCommuteJobTotal(id: string, totalCells: number): Promise<void> {
  await databases.updateDocument(DATABASE_ID, JOBS, id, {
    status: 'running',
    total_cells: totalCells,
  });
}

export async function updateCommuteJobProgress(
  id: string,
  completedCells: number,
): Promise<void> {
  await withRetry(async () => {
    await databases.updateDocument(DATABASE_ID, JOBS, id, { completed_cells: completedCells });
  });
}

export async function stopCommuteJob(id: string): Promise<void> {
  await databases.updateDocument(DATABASE_ID, JOBS, id, { status: 'stopped' });
}

export async function finishCommuteJob(id: string, error: string | null): Promise<void> {
  await withRetry(async () => {
    await databases.updateDocument(DATABASE_ID, JOBS, id, {
      status: error ? 'error' : 'done',
      error,
    });
  });
}

export async function fetchCommuteJob(id: string): Promise<CommuteJob | null> {
  try {
    const row = await databases.getDocument(DATABASE_ID, JOBS, id);
    return rowToJob(row as unknown as CommuteJobRow);
  } catch {
    return null;
  }
}

export async function fetchLatestCommuteJob(): Promise<CommuteJob | null> {
  const page = await databases.listDocuments(DATABASE_ID, JOBS, [
    Query.orderDesc('$createdAt'),
    Query.limit(1),
  ]);
  return page.documents.length > 0 ? rowToJob(page.documents[0] as unknown as CommuteJobRow) : null;
}
