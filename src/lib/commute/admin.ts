// Server-only: uses node-appwrite with an API key, unlike the rest of src/lib/commute/db.ts
// (which deliberately uses the public web SDK so it also works from 'use client' hooks).
// Only import this from server code (recompute.ts, API routes, the worker, scripts) — never
// from a client component, since node-appwrite pulls in Node built-ins that don't bundle for
// the browser, and the API key must never reach client code anyway.
import { Client, Databases, Query } from 'node-appwrite';

const DATABASE_ID = 'main';
const TRAVEL_TIMES = 'commute_travel_times';

function adminDatabases(): Databases {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

/** Deletes every cached travel time for the given destinations in a single bulk call — used
 * by a fresh (non-resume) recompute so the map doesn't keep showing stale results for cells
 * the new job hasn't reached yet. Document-by-document deletes (the only option on the
 * public SDK) tripped Appwrite's abuse protection even paced conservatively; this bulk
 * delete-by-query is one request regardless of row count. */
export async function clearTravelTimesAdmin(destinationIds: string[]): Promise<void> {
  if (destinationIds.length === 0) return;
  await adminDatabases().deleteDocuments(DATABASE_ID, TRAVEL_TIMES, [
    Query.equal('destination_id', destinationIds),
  ]);
}
