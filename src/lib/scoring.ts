import { JourneyResult, ScrapedListing } from './types';

export function calculateScore(listing: ScrapedListing, journey: JourneyResult): number | null {
  if (listing.warmRent === null || journey.durationMinutes === null) return null;

  const timeScore = Math.max(0, 1 - journey.durationMinutes / 60) * 40;
  const rentScore = Math.max(0, 1 - listing.warmRent / 1500) * 35;
  const sizeScore = listing.size !== null ? Math.min(1, listing.size / 25) * 15 : 0;
  const transferScore = Math.max(0, 1 - journey.transfers / 3) * 10;

  return Math.round(Math.min(100, Math.max(0, timeScore + rentScore + sizeScore + transferScore)));
}
