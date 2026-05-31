export interface ScrapedListing {
  url: string;
  title: string;
  address: string;
  warmRent: number | null;
  coldRent: number | null;
  size: number | null;
  lat: number | null;
  lng: number | null;
  scrapedAt: string;
  isOffline?: boolean;
}

export interface JourneyLeg {
  mode: 'walk' | 'subway' | 'suburban' | 'tram' | 'bus' | 'ferry' | 'regional' | 'express' | 'taxi';
  lineName: string | null;
  origin: string;
  destination: string;
  durationMinutes: number;
}

export interface JourneyResult {
  durationMinutes: number;
  transfers: number;
  legs: JourneyLeg[];
  departureTime: string;
  arrivalTime: string;
  averagedDays?: number;
}

export interface Destination {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface DestinationJourney {
  destinationId: string;
  destinationName: string;
  journey: JourneyResult | null;
  score: number | null;
  error: string | null;
}

export interface ListingResult {
  id: string;
  listing: ScrapedListing | null;
  destinationJourneys: DestinationJourney[];
  isFavorite: boolean;
  isSelectedForComparison: boolean;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  success: boolean;
  data?: ScrapedListing;
  error?: string;
  fallback?: boolean;
}

export interface RouteSettings {
  timeMode: 'departure' | 'arrival';
  time: string; // HH:MM
}

export interface JourneyRequest {
  fromLat: number;
  fromLng: number;
  fromAddress: string;
  toLat: number;
  toLng: number;
  toAddress: string;
  settings?: RouteSettings;
}

export interface JourneyResponse {
  success: boolean;
  data?: JourneyResult;
  error?: string;
}

export interface GeocodeResponse {
  success: boolean;
  lat?: number;
  lng?: number;
  error?: string;
}

export interface Suggestion {
  id: string;
  url: string;
  listing: ScrapedListing | null;
  destinationJourneys: DestinationJourney[];
  bestScore: number | null;
  suggestedAt: string;
}

export interface ScanSuggestionRequest {
  url: string;
  minScore?: number;
}

export interface ScanSuggestionResponse {
  success: boolean;
  saved: boolean;
  score?: number | null;
  reason?: string;
  error?: string;
}
