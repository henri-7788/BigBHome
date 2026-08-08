import { Query } from 'appwrite';
import { databases, DATABASE_ID } from './appwrite';
import { Destination, DestinationJourney, ListingResult, ScrapedListing } from './types';

const LISTINGS = 'wg_listings';
const DESTINATIONS = 'wg_destinations';
const PAGE_SIZE = 100;

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface ListingRow {
  $id: string;
  url: string;
  listing_data: string;
  destination_journeys: string;
  is_favorite: boolean;
}

interface DestinationRow {
  $id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// ─── Conversion ──────────────────────────────────────────────────────────────

function rowToListingResult(row: ListingRow): ListingResult {
  const listing_data: ScrapedListing = JSON.parse(row.listing_data);
  return {
    id: row.$id,
    listing: listing_data,
    destinationJourneys: (JSON.parse(row.destination_journeys) as DestinationJourney[]) ?? [],
    isFavorite: row.is_favorite,
    isSelectedForComparison: false,
    isLoading: false,
    error: null,
    isOffline: listing_data?.isOffline ?? false,
  };
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

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function fetchListings(): Promise<ListingResult[]> {
  const rows = await listAll<ListingRow>(LISTINGS, [Query.orderDesc('$createdAt')]);
  return rows.map(rowToListingResult);
}

export async function upsertListing(
  id: string,
  listing: ScrapedListing,
  destinationJourneys: DestinationJourney[],
  isFavorite: boolean,
): Promise<void> {
  await databases.upsertDocument(DATABASE_ID, LISTINGS, id, {
    url: listing.url,
    listing_data: JSON.stringify(listing),
    destination_journeys: JSON.stringify(destinationJourneys),
    is_favorite: isFavorite,
  });
}

export async function updateOfflineStatus(id: string, isOffline: boolean): Promise<void> {
  let row: ListingRow;
  try {
    row = (await databases.getDocument(DATABASE_ID, LISTINGS, id)) as unknown as ListingRow;
  } catch {
    return;
  }
  const listing_data = { ...JSON.parse(row.listing_data), isOffline };
  await databases.updateDocument(DATABASE_ID, LISTINGS, id, {
    listing_data: JSON.stringify(listing_data),
  });
}

export async function updateFavorite(id: string, isFavorite: boolean): Promise<void> {
  await databases.updateDocument(DATABASE_ID, LISTINGS, id, { is_favorite: isFavorite });
}

export async function deleteListing(id: string): Promise<void> {
  await databases.deleteDocument(DATABASE_ID, LISTINGS, id);
}

export async function listingUrlExists(url: string): Promise<boolean> {
  const page = await databases.listDocuments(DATABASE_ID, LISTINGS, [
    Query.equal('url', url),
    Query.limit(1),
  ]);
  return page.documents.length > 0;
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export async function fetchDestinations(): Promise<Destination[]> {
  const rows = await listAll<DestinationRow>(DESTINATIONS, [Query.orderAsc('$createdAt')]);
  return rows.map(({ $id, name, address, lat, lng }) => ({ id: $id, name, address, lat, lng }));
}

export async function insertDestination(dest: Destination): Promise<void> {
  await databases.createDocument(DATABASE_ID, DESTINATIONS, dest.id, {
    name: dest.name,
    address: dest.address,
    lat: dest.lat,
    lng: dest.lng,
  });
}

export async function deleteDestination(id: string): Promise<void> {
  await databases.deleteDocument(DATABASE_ID, DESTINATIONS, id);
}
