'use client';

import { useState } from 'react';
import { ListingResult } from '@/lib/types';

interface Props {
  listings: ListingResult[];
  onClose: () => void;
}

function bestIdx(values: (number | null)[], higher = true): number {
  let best = -1;
  let bestVal: number | null = null;
  values.forEach((v, i) => {
    if (v === null) return;
    if (bestVal === null || (higher ? v > bestVal : v < bestVal)) {
      bestVal = v;
      best = i;
    }
  });
  return best;
}

function Cell({ value, isBest }: { value: string; isBest: boolean }) {
  return (
    <td
      className={`px-4 py-3 text-sm text-center border-b border-gray-100 ${
        isBest ? 'bg-green-50 font-semibold text-green-800' : 'text-gray-700'
      }`}
    >
      {value}
    </td>
  );
}

export function ComparisonTable({ listings, onClose }: Props) {
  // Collect all destination names across all listings
  const allDestNames = Array.from(
    new Set(listings.flatMap((l) => l.destinationJourneys.map((dj) => dj.destinationName))),
  );

  const [activeDest, setActiveDest] = useState(allDestNames[0] ?? '');

  const rents = listings.map((l) => l.listing?.warmRent ?? null);
  const sizes = listings.map((l) => l.listing?.size ?? null);
  const durations = listings.map((l) => {
    const dj = l.destinationJourneys.find((j) => j.destinationName === activeDest);
    return dj?.journey?.durationMinutes ?? null;
  });
  const transfers = listings.map((l) => {
    const dj = l.destinationJourneys.find((j) => j.destinationName === activeDest);
    return dj?.journey?.transfers ?? null;
  });
  const scores = listings.map((l) => {
    const dj = l.destinationJourneys.find((j) => j.destinationName === activeDest);
    return dj?.score ?? null;
  });

  const bestRentIdx = bestIdx(rents, false);
  const bestSizeIdx = bestIdx(sizes, true);
  const bestDurIdx = bestIdx(durations, false);
  const bestTransIdx = bestIdx(transfers, false);
  const bestScoreIdx = bestIdx(scores, true);

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-md overflow-x-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-gray-900">Vergleich ({listings.length})</h2>
          {allDestNames.length > 1 && (
            <div className="flex gap-1">
              {allDestNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveDest(name)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    name === activeDest ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
          ✕
        </button>
      </div>
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
              Merkmal
            </th>
            {listings.map((l) => (
              <th key={l.id} className="px-4 py-2 text-center text-xs font-medium text-gray-700 max-w-40">
                <span className="block truncate" title={l.listing?.title}>
                  {l.listing?.title ?? 'WG-Inserat'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-100">Warmmiete</td>
            {rents.map((v, i) => <Cell key={i} value={v !== null ? `${v} €` : '–'} isBest={i === bestRentIdx} />)}
          </tr>
          <tr>
            <td className="px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-100">Größe</td>
            {sizes.map((v, i) => <Cell key={i} value={v !== null ? `${v} m²` : '–'} isBest={i === bestSizeIdx} />)}
          </tr>
          <tr>
            <td className="px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-100">
              Fahrtzeit {allDestNames.length > 1 ? `(${activeDest})` : ''}
            </td>
            {durations.map((v, i) => <Cell key={i} value={v !== null ? `${v} min` : '–'} isBest={i === bestDurIdx} />)}
          </tr>
          <tr>
            <td className="px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-100">Umstiege</td>
            {transfers.map((v, i) => <Cell key={i} value={v !== null ? String(v) : '–'} isBest={i === bestTransIdx} />)}
          </tr>
          <tr>
            <td className="px-4 py-3 text-xs font-medium text-gray-500">Score</td>
            {scores.map((v, i) => <Cell key={i} value={v !== null ? `${v}/100` : '–'} isBest={i === bestScoreIdx} />)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
