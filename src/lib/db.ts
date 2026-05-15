import { supabase } from './supabase';
import { Destination, DestinationJourney, ListingResult, ScrapedListing } from './types';

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface ListingRow {
  id: string;
  url: string;
  listing_data: ScrapedListing;
  destination_journeys: DestinationJourney[];
  is_favorite: boolean;
  created_at: string;
}

interface DestinationRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
}

// ─── Conversion ──────────────────────────────────────────────────────────────

function rowToListingResult(row: ListingRow): ListingResult {
  return {
    id: row.id,
    listing: row.listing_data,
    destinationJourneys: row.destination_journeys ?? [],
    isFavorite: row.is_favorite,
    isSelectedForComparison: false,
    isLoading: false,
    error: null,
  };
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function fetchListings(): Promise<ListingResult[]> {
  const { data, error } = await supabase
    .from('wg_listings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as ListingRow[]).map(rowToListingResult);
}

export async function upsertListing(
  id: string,
  listing: ScrapedListing,
  destinationJourneys: DestinationJourney[],
  isFavorite: boolean,
): Promise<void> {
  const { error } = await supabase.from('wg_listings').upsert({
    id,
    url: listing.url,
    listing_data: listing,
    destination_journeys: destinationJourneys,
    is_favorite: isFavorite,
  });
  if (error) throw error;
}

export async function updateFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('wg_listings')
    .update({ is_favorite: isFavorite })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('wg_listings').delete().eq('id', id);
  if (error) throw error;
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export async function fetchDestinations(): Promise<Destination[]> {
  const { data, error } = await supabase
    .from('wg_destinations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as DestinationRow[]).map(({ id, name, address, lat, lng }) => ({
    id,
    name,
    address,
    lat,
    lng,
  }));
}

export async function insertDestination(dest: Destination): Promise<void> {
  const { error } = await supabase.from('wg_destinations').insert({
    id: dest.id,
    name: dest.name,
    address: dest.address,
    lat: dest.lat,
    lng: dest.lng,
  });
  if (error) throw error;
}

export async function deleteDestination(id: string): Promise<void> {
  const { error } = await supabase.from('wg_destinations').delete().eq('id', id);
  if (error) throw error;
}
