'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Destination, DestinationJourney, ListingResult } from '@/lib/types';
import { JourneyResultView } from './JourneyResult';
import { ScoreBar } from './ScoreBar';
import { LoadingSpinner } from './LoadingSpinner';

const ListingMap = dynamic(() => import('./ListingMap'), { ssr: false });

interface Props {
  result: ListingResult;
  destinations: Destination[];
  onRemove: (id: string) => void;
  onToggleFavorite: (id: string, newValue: boolean) => void;
  onToggleComparison: (id: string) => void;
  onRetryJourney: (id: string) => void;
  onRetryDestinationJourney: (listingId: string, destinationId: string) => Promise<void>;
  onToggleOffline: (id: string, newValue: boolean) => void;
}

function JourneySection({
  destinationJourneys,
  isLoading,
  error,
  onRetry,
  onRetryDestination,
}: {
  destinationJourneys: DestinationJourney[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onRetryDestination?: (destinationId: string) => Promise<void>;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const handleRefreshDestination = async (destinationId: string) => {
    if (!onRetryDestination || refreshingIds.has(destinationId)) return;
    setRefreshingIds((prev) => new Set([...prev, destinationId]));
    try {
      await onRetryDestination(destinationId);
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(destinationId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <LoadingSpinner size="sm" />
        <span className="text-xs text-gray-400">Route wird berechnet…</span>
      </div>
    );
  }

  if (destinationJourneys.length === 0) {
    if (error) {
      return (
        <div className="space-y-1">
          <p className="text-xs text-orange-600">{error}</p>
          {onRetry && (
            <button onClick={onRetry} className="text-xs text-blue-600 hover:underline">
              ↺ Erneut versuchen
            </button>
          )}
        </div>
      );
    }
    return <p className="text-xs text-gray-400">Kein Ziel konfiguriert</p>;
  }

  const active = destinationJourneys[activeIdx] ?? destinationJourneys[0];
  const hasAnyError = destinationJourneys.some((dj) => dj.error && !dj.journey);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {destinationJourneys.map((dj, i) => (
          <div key={dj.destinationId} className="flex items-center gap-0.5">
            <button
              onClick={() => setActiveIdx(i)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                destinationJourneys.length > 1
                  ? i === activeIdx
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-gray-100 text-gray-600 cursor-default'
              }`}
            >
              {dj.destinationName}
            </button>
            <button
              onClick={() => handleRefreshDestination(dj.destinationId)}
              disabled={refreshingIds.has(dj.destinationId)}
              title={`Route für ${dj.destinationName} neu berechnen`}
              className="flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              {refreshingIds.has(dj.destinationId) ? (
                <LoadingSpinner size="sm" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
      {active.journey ? (
        <JourneyResultView journey={active.journey} />
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-orange-600">{active.error ?? 'Keine Route gefunden'}</p>
          {onRetry && (
            <button onClick={onRetry} className="text-xs text-blue-600 hover:underline">
              ↺ Erneut versuchen
            </button>
          )}
        </div>
      )}
      {hasAnyError && active.journey && onRetry && (
        <button onClick={onRetry} className="text-xs text-blue-600 hover:underline">
          ↺ Alle Routen neu berechnen
        </button>
      )}
    </div>
  );
}

export function ListingCard({ result, destinations, onRemove, onToggleFavorite, onToggleComparison, onRetryJourney, onRetryDestinationJourney, onToggleOffline }: Props) {
  const [showMap, setShowMap] = useState(false);
  const { id, listing, destinationJourneys, isFavorite, isSelectedForComparison, isLoading, error, isOffline } = result;

  // Pick score from the first destination that has one
  const score = destinationJourneys.find((dj) => dj.score !== null)?.score ?? null;

  if (isLoading && !listing) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex items-center gap-3">
        <LoadingSpinner size="md" />
        <span className="text-sm text-gray-500">Inserat wird analysiert…</span>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">Fehler: {error}</p>
        <button onClick={() => onRemove(id)} className="mt-2 text-xs text-red-500 hover:underline">
          Entfernen
        </button>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${
        isOffline
          ? 'border-gray-200 opacity-60 grayscale'
          : isSelectedForComparison
          ? 'border-blue-400 ring-2 ring-blue-200'
          : 'border-gray-200'
      }`}
    >
      {/* Offline banner */}
      {isOffline && (
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-1.5 flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">Nicht mehr online</span>
        </div>
      )}
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate" title={listing.title}>
              {listing.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate" title={listing.address}>
              📍 {listing.address}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => onToggleFavorite(id, !isFavorite)}
              title={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
              className={`p-1.5 rounded-lg text-base transition-colors ${
                isFavorite ? 'text-yellow-500 bg-yellow-50' : 'text-gray-300 hover:text-yellow-400'
              }`}
            >
              ★
            </button>
            <button
              onClick={() => onRemove(id)}
              title="Entfernen"
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {listing.warmRent !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              💶 {listing.warmRent} €
            </span>
          )}
          {listing.size !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
              📐 {listing.size} m²
            </span>
          )}
          {listing.warmRent && listing.size ? (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {Math.round(listing.warmRent / listing.size)} €/m²
            </span>
          ) : null}
        </div>
      </div>

      {/* Journey */}
      <div className="px-4 pb-3 border-t border-gray-100 pt-3">
        <JourneySection
          destinationJourneys={destinationJourneys}
          isLoading={isLoading}
          error={error}
          onRetry={() => onRetryJourney(id)}
          onRetryDestination={(destinationId) => onRetryDestinationJourney(id, destinationId)}
        />
      </div>

      {/* Score */}
      {score !== null && (
        <div className="px-4 pb-3">
          <ScoreBar score={score} />
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-gray-100">
        <div className="flex gap-2">
          {listing.lat && listing.lng && (
            <button
              onClick={() => setShowMap(!showMap)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showMap ? 'Karte ausblenden' : '🗺️ Karte'}
            </button>
          )}
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:underline"
          >
            Inserat ↗
          </a>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onToggleOffline(id, !isOffline)}
            title={isOffline ? 'Als online markieren' : 'Als offline markieren'}
            className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
              isOffline
                ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {isOffline ? '↺ Online' : '⊘ Offline'}
          </button>
          <button
            onClick={() => onToggleComparison(id)}
            className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
              isSelectedForComparison
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isSelectedForComparison ? '✓ Vergleich' : 'Vergleichen'}
          </button>
        </div>
      </div>

      {/* Map */}
      {showMap && listing.lat && listing.lng && (
        <div className="px-4 pb-4">
          <ListingMap
            lat={listing.lat}
            lng={listing.lng}
            title={listing.title}
            destinations={destinations}
          />
        </div>
      )}
    </div>
  );
}
