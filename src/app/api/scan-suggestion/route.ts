import { NextRequest, NextResponse } from 'next/server';
import { parseListing } from '@/lib/scraper';
import { fetchJourney } from '@/lib/bvg';
import { calculateScore } from '@/lib/scoring';
import * as db from '@/lib/db';
import { DestinationJourney, ScanSuggestionResponse, RouteSettings } from '@/lib/types';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.5',
};

function extractListingId(url: string): string | null {
  const m = url.match(/(\d{6,})\.html/);
  return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const { url, minScore = 50 }: { url: string; minScore?: number } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json<ScanSuggestionResponse>(
        { success: false, saved: false, error: 'URL fehlt' },
        { status: 400 },
      );
    }

    const listingId = extractListingId(url);
    if (!listingId) {
      return NextResponse.json<ScanSuggestionResponse>(
        { success: false, saved: false, error: 'Ungültige WG-Gesucht URL' },
        { status: 400 },
      );
    }

    // Skip if already known (listing or dismissed suggestion)
    const [alreadyListing, alreadySuggestion] = await Promise.all([
      db.listingUrlExists(url),
      db.suggestionExists(listingId),
    ]);
    if (alreadyListing || alreadySuggestion) {
      return NextResponse.json<ScanSuggestionResponse>({
        success: true,
        saved: false,
        reason: 'already known',
      });
    }

    // Read destinations from DB
    const destinations = await db.fetchDestinations();

    // Try to scrape
    let listing = null;
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (res.ok) {
        const html = await res.text();
        const isBlocked =
          html.includes('cf-browser-verification') ||
          html.includes('<div class="g-recaptcha"') ||
          html.length < 20_000;
        if (!isBlocked) {
          listing = parseListing(html, url);
        }
      }
    } catch {
      // scraping failed — continue without listing data
    }

    // Calculate journeys if we have coordinates
    const settings: RouteSettings = { timeMode: 'arrival', time: '08:00' };
    let destinationJourneys: DestinationJourney[] = [];
    let bestScore: number | null = null;

    if (listing?.lat && listing?.lng && destinations.length > 0) {
      const results = await Promise.all(
        destinations.map(async (dest): Promise<DestinationJourney> => {
          try {
            const journey = await fetchJourney(
              listing!.lat!, listing!.lng!, listing!.address,
              dest.lat, dest.lng, dest.address,
              settings,
            );
            return {
              destinationId: dest.id,
              destinationName: dest.name,
              journey,
              score: calculateScore(listing!, journey),
              error: null,
            };
          } catch {
            return { destinationId: dest.id, destinationName: dest.name, journey: null, score: null, error: 'Fehler' };
          }
        }),
      );
      destinationJourneys = results;
      const scores = results.map((r) => r.score).filter((s): s is number => s !== null);
      bestScore = scores.length > 0 ? Math.max(...scores) : null;
    }

    // Save if score is good enough (or if no destinations to score against)
    const shouldSave = bestScore === null ? destinations.length === 0 : bestScore >= minScore;
    if (!shouldSave) {
      return NextResponse.json<ScanSuggestionResponse>({
        success: true,
        saved: false,
        score: bestScore,
        reason: `score ${bestScore} below threshold ${minScore}`,
      });
    }

    await db.upsertSuggestion(listingId, url, listing, destinationJourneys, bestScore);

    return NextResponse.json<ScanSuggestionResponse>({
      success: true,
      saved: true,
      score: bestScore,
    });
  } catch (err) {
    return NextResponse.json<ScanSuggestionResponse>(
      { success: false, saved: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
