'use client';

import { useCallback } from 'react';
import { useListings } from '@/hooks/useListings';
import { useDestinations } from '@/hooks/useDestinations';
import { useSettings } from '@/hooks/useSettings';
import { DestinationJourney, JourneyResponse } from '@/lib/types';
import { calculateScore } from '@/lib/scoring';
import { DestinationManager } from './DestinationManager';
import { SettingsPanel } from './SettingsPanel';
import { UrlInput } from './UrlInput';
import { ListingGrid } from './ListingGrid';
import { ComparisonTable } from './ComparisonTable';
import { LoadingSpinner } from './LoadingSpinner';

export function ListingsView() {
  const { listings, dbLoaded, addListing, updateListing, removeListing, toggleFavorite, toggleComparison, toggleOffline } =
    useListings();
  const { destinations, loaded: destsLoaded, addDestination, removeDestination } = useDestinations();
  const { settings, updateSettings } = useSettings();

  const handleRetryJourney = useCallback(
    async (listingId: string) => {
      const current = listings.find((l) => l.id === listingId);
      if (!current?.listing?.lat || !current?.listing?.lng) return;

      updateListing(listingId, { isLoading: true });

      const results = await Promise.all(
        destinations.map(async (dest): Promise<DestinationJourney> => {
          try {
            const res = await fetch('/api/journey', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromLat: current.listing!.lat,
                fromLng: current.listing!.lng,
                fromAddress: current.listing!.address,
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
              score: data.success && data.data ? calculateScore(current.listing!, data.data) : null,
              error: data.success ? null : (data.error ?? 'Fehler'),
            };
          } catch {
            return {
              destinationId: dest.id,
              destinationName: dest.name,
              journey: null,
              score: null,
              error: 'Netzwerkfehler',
            };
          }
        }),
      );

      // Pass listing in payload so updateListing persists to DB
      updateListing(listingId, {
        listing: current.listing,
        destinationJourneys: results,
        isLoading: false,
      });
    },
    [listings, destinations, settings, updateListing],
  );

  const handleRetryDestinationJourney = useCallback(
    async (listingId: string, destinationId: string) => {
      const current = listings.find((l) => l.id === listingId);
      if (!current?.listing?.lat || !current?.listing?.lng) return;

      const dest = destinations.find((d) => d.id === destinationId);
      if (!dest) return;

      let updatedDj: DestinationJourney;
      try {
        const res = await fetch('/api/journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromLat: current.listing.lat,
            fromLng: current.listing.lng,
            fromAddress: current.listing.address,
            toLat: dest.lat,
            toLng: dest.lng,
            toAddress: dest.address,
            settings,
          }),
        });
        const data: JourneyResponse = await res.json();
        updatedDj = {
          destinationId: dest.id,
          destinationName: dest.name,
          journey: data.success && data.data ? data.data : null,
          score: data.success && data.data ? calculateScore(current.listing, data.data) : null,
          error: data.success ? null : (data.error ?? 'Fehler'),
        };
      } catch {
        updatedDj = {
          destinationId: dest.id,
          destinationName: dest.name,
          journey: null,
          score: null,
          error: 'Netzwerkfehler',
        };
      }

      const updatedJourneys = current.destinationJourneys.map((dj) =>
        dj.destinationId === destinationId ? updatedDj : dj,
      );
      updateListing(listingId, {
        listing: current.listing,
        destinationJourneys: updatedJourneys,
        isLoading: false,
      });
    },
    [listings, destinations, settings, updateListing],
  );

  const comparisonListings = listings.filter((l) => l.isSelectedForComparison && l.listing);
  const showComparison = comparisonListings.length >= 2;
  const isInitializing = !dbLoaded || !destsLoaded;

  return (
    <div className="space-y-4">
      {destsLoaded && (
        <DestinationManager
          destinations={destinations}
          onAdd={addDestination}
          onRemove={removeDestination}
        />
      )}

      <SettingsPanel settings={settings} onChange={updateSettings} />

      <UrlInput
        destinations={destinations}
        settings={settings}
        onAddListing={addListing}
        onUpdateListing={updateListing}
      />

      {isInitializing ? (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
          <LoadingSpinner size="md" />
          <span className="text-sm">Gespeicherte Inserate werden geladen…</span>
        </div>
      ) : (
        <>
          {listings.length > 0 && (
            <p className="text-xs text-gray-400 text-right">
              {listings.length} Inserat{listings.length !== 1 ? 'e' : ''} •{' '}
              {listings.filter((l) => l.isFavorite).length} Favoriten
            </p>
          )}

          {showComparison && (
            <ComparisonTable
              listings={comparisonListings}
              onClose={() => comparisonListings.forEach((l) => toggleComparison(l.id))}
            />
          )}

          <ListingGrid
            listings={listings}
            destinations={destinations}
            onRemove={removeListing}
            onToggleFavorite={toggleFavorite}
            onToggleComparison={toggleComparison}
            onRetryJourney={handleRetryJourney}
            onRetryDestinationJourney={handleRetryDestinationJourney}
            onToggleOffline={toggleOffline}
          />

          {listings.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🏠</div>
              <p className="text-sm">WG-Gesucht Link einfügen und Fahrtzeit berechnen lassen</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
