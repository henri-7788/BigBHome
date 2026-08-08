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

// ─── Commute Heatmap ───────────────────────────────────────────────────────────

export interface CommuteScheduleEntry {
  weekday: number; // 1 (Monday) – 7 (Sunday), ISO-8601
  time: string; // HH:MM
  timeMode: 'departure' | 'arrival';
}

export interface CommuteDestination {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  weight: number; // relative importance, 1-100
  schedule: CommuteScheduleEntry[];
}

export interface GridCell {
  id: string;
  lat: number;
  lng: number;
}

export interface CommuteTravelTime {
  cellId: string;
  destinationId: string;
  weekday: number;
  targetTime: string;
  durationMinutes: number | null;
  transfers: number | null;
  legs: JourneyLeg[] | null;
}

export interface CommuteJob {
  id: string;
  status: 'pending' | 'running' | 'stopped' | 'done' | 'error';
  totalCells: number;
  completedCells: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommuteCellScore {
  cellId: string;
  lat: number;
  lng: number;
  score: number | null; // null = unreachable for at least one destination
  perDestination: {
    destinationId: string;
    durationMinutes: number | null;
    transfers: number | null;
    legs: JourneyLeg[] | null;
  }[];
}

export interface TransportModePreference {
  walk: boolean;
  bike: boolean;
  transit: boolean;
}
