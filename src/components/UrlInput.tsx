'use client';

import { useState, FormEvent, useRef } from 'react';
import { Destination, DestinationJourney, RouteSettings, ScrapedListing, ScrapeResponse, JourneyResponse } from '@/lib/types';
import { calculateScore } from '@/lib/scoring';
import { ManualAddressForm } from './ManualAddressForm';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  destinations: Destination[];
  settings: RouteSettings;
  onAddListing: (id: string) => void;
  onUpdateListing: (
    id: string,
    data: {
      listing?: ScrapedListing;
      destinationJourneys?: DestinationJourney[];
      isLoading?: boolean;
      error?: string | null;
    },
  ) => void;
}

export function UrlInput({ destinations, settings, onAddListing, onUpdateListing }: Props) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [partialData, setPartialData] = useState<Partial<ScrapedListing> | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  const fetchJourneysAndFinalize = async (id: string, listing: ScrapedListing) => {
    if (!listing.lat || !listing.lng) {
      onUpdateListing(id, { listing, isLoading: false, error: 'Koordinaten nicht gefunden' });
      setIsLoading(false);
      return;
    }

    if (destinations.length === 0) {
      onUpdateListing(id, { listing, destinationJourneys: [], isLoading: false });
      setIsLoading(false);
      pendingIdRef.current = null;
      setUrl('');
      return;
    }

    const results = await Promise.all(
      destinations.map(async (dest): Promise<DestinationJourney> => {
        try {
          const res = await fetch('/api/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromLat: listing.lat,
              fromLng: listing.lng,
              fromAddress: listing.address,
              toLat: dest.lat,
              toLng: dest.lng,
              toAddress: dest.address,
              settings,
            }),
          });
          const data: JourneyResponse = await res.json();
          return {
            destinationId: dest.id,
            destinationName: dest.name,
            journey: data.success && data.data ? data.data : null,
            score: data.success && data.data ? calculateScore(listing, data.data) : null,
            error: data.success ? null : (data.error ?? 'Fehler'),
          };
        } catch {
          return { destinationId: dest.id, destinationName: dest.name, journey: null, score: null, error: 'Netzwerkfehler' };
        }
      }),
    );

    onUpdateListing(id, { listing, destinationJourneys: results, isLoading: false });
    setIsLoading(false);
    pendingIdRef.current = null;
    setUrl('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const id = crypto.randomUUID();
    pendingIdRef.current = id;
    setIsLoading(true);
    onAddListing(id);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const scrapeData: ScrapeResponse = await res.json();

      if (!scrapeData.success || scrapeData.fallback) {
        setPartialData(scrapeData.data ?? { url: url.trim() });
        setShowManualForm(true);
        setIsLoading(false);
        onUpdateListing(id, scrapeData.data ? { listing: scrapeData.data, isLoading: true } : { isLoading: true });
        return;
      }

      await fetchJourneysAndFinalize(id, scrapeData.data!);
    } catch {
      onUpdateListing(id, { isLoading: false, error: 'Netzwerkfehler beim Laden des Inserats' });
      setIsLoading(false);
      pendingIdRef.current = null;
    }
  };

  const handleManualSubmit = async (data: {
    address: string;
    lat: number;
    lng: number;
    warmRent: number | null;
    size: number | null;
  }) => {
    const id = pendingIdRef.current;
    if (!id) return;

    setShowManualForm(false);
    setIsLoading(true);

    const listing: ScrapedListing = {
      url: partialData?.url ?? '',
      title: partialData?.title ?? 'WG-Inserat',
      address: data.address,
      warmRent: data.warmRent,
      coldRent: null,
      size: data.size,
      lat: data.lat,
      lng: data.lng,
      scrapedAt: new Date().toISOString(),
    };

    onUpdateListing(id, { listing, isLoading: true });
    await fetchJourneysAndFinalize(id, listing);
  };

  const handleManualCancel = () => {
    setShowManualForm(false);
    if (pendingIdRef.current) {
      onUpdateListing(pendingIdRef.current, { isLoading: false, error: 'Abgebrochen' });
      pendingIdRef.current = null;
    }
    setIsLoading(false);
    setUrl('');
  };

  return (
    <>
      <div className="space-y-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              const match = text.match(/https?:\/\/\S+/);
              if (match && match[0] !== text.trim()) {
                e.preventDefault();
                setUrl(match[0].replace(/[.,!?)]+$/, ''));
              }
            }}
            placeholder="WG-Gesucht Link einfügen…"
            required
            disabled={isLoading}
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading && <LoadingSpinner size="sm" />}
            {isLoading ? 'Analysiere…' : 'Analysieren'}
          </button>
        </form>
        {destinations.length === 0 && (
          <p className="text-xs text-amber-600">
            ⚠️ Füge zuerst ein Ziel (Arbeitsplatz, Berufsschule) hinzu, um Fahrtzeiten zu berechnen.
          </p>
        )}
      </div>

      {showManualForm && partialData && (
        <ManualAddressForm
          partialData={partialData}
          onSubmit={handleManualSubmit}
          onCancel={handleManualCancel}
        />
      )}
    </>
  );
}
