'use client';

import { useState } from 'react';
import { Suggestion, ScrapedListing, DestinationJourney } from '@/lib/types';
import { ScoreBar } from './ScoreBar';
import { useSuggestions } from '@/hooks/useSuggestions';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
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

function SuggestionCard({
  suggestion,
  onAdd,
  onDismiss,
}: {
  suggestion: Suggestion;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const listing = suggestion.listing;
  const bestJourney = suggestion.destinationJourneys.find((dj) => dj.score === suggestion.bestScore);

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* Score badge */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-700">
          ✨ Score {suggestion.bestScore ?? '–'}
          {bestJourney && (
            <span className="font-normal text-emerald-600"> · {bestJourney.destinationName}</span>
          )}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(suggestion.suggestedAt).toLocaleDateString('de-DE')}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {listing ? (
          <>
            <div>
              <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
              <p className="text-xs text-gray-500 truncate">📍 {listing.address}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {listing.warmRent !== null && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  💶 {listing.warmRent} €
                </span>
              )}
              {listing.size !== null && (
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                  📐 {listing.size} m²
                </span>
              )}
              {bestJourney?.journey && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                  🕐 Ø {bestJourney.journey.durationMinutes} min
                </span>
              )}
            </div>

            {suggestion.bestScore !== null && (
              <ScoreBar score={suggestion.bestScore} />
            )}
          </>
        ) : (
          <div>
            <p className="text-xs text-gray-500 break-all">{suggestion.url}</p>
            <p className="text-xs text-amber-600 mt-1">Inserat konnte nicht geladen werden (CAPTCHA)</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onAdd}
            className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            + Hinzufügen
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Ablehnen
          </button>
          <a
            href={suggestion.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-200 transition-colors"
          >
            ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function ManualScanInput({ onScanned }: { onScanned: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleScan = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/scan-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.saved) {
        setResult('✓ Vorschlag gespeichert');
        setUrl('');
        onScanned();
      } else if (data.reason === 'already known') {
        setResult('Bereits bekannt');
      } else if (data.score !== undefined) {
        setResult(`Score ${data.score ?? '–'} – unter dem Schwellwert`);
      } else {
        setResult(data.error ?? 'Fehler');
      }
    } catch {
      setResult('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="WG-Gesucht Link prüfen…"
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />
      <button
        onClick={handleScan}
        disabled={loading || !url.trim()}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
      >
        {loading && <LoadingSpinner size="sm" />}
        {loading ? 'Prüfe…' : 'Prüfen'}
      </button>
      {result && <span className="text-xs text-gray-500 whitespace-nowrap">{result}</span>}
    </div>
  );
}

export function SuggestionsPanel({ onAddListing, onUpdateListing }: Props) {
  const { suggestions, loading, dismiss, refetch } = useSuggestions();
  const [open, setOpen] = useState(true);

  const handleAdd = (suggestion: Suggestion) => {
    const newId = crypto.randomUUID();
    onAddListing(newId);
    onUpdateListing(newId, {
      listing: suggestion.listing ?? undefined,
      destinationJourneys: suggestion.destinationJourneys,
      isLoading: false,
    });
    dismiss(suggestion.id);
  };

  const count = suggestions.length;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          ✨ Vorschläge
          {count > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {count}
            </span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-emerald-100 px-4 py-4 space-y-4">
          <ManualScanInput onScanned={refetch} />

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <LoadingSpinner size="sm" />
              <span className="text-xs">Lade Vorschläge…</span>
            </div>
          ) : count === 0 ? (
            <p className="text-xs text-gray-400">
              Keine Vorschläge. Füge einen WG-Gesucht Link oben ein oder richte den automatischen n8n-Workflow ein.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onAdd={() => handleAdd(s)}
                  onDismiss={() => dismiss(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
