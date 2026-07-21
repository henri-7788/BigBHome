'use client';

import { CommuteCellScore, CommuteDestination, JourneyResult } from '@/lib/types';
import { JourneyResultView } from '@/components/JourneyResult';

interface Props {
  cell: CommuteCellScore | null;
  destinations: CommuteDestination[];
  onClose: () => void;
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

export function CommuteDetailPanel({ cell, destinations, onClose }: Props) {
  if (!cell) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">📍 Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">
          ✕
        </button>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-xs text-gray-500">Gesamtscore</span>
        <span className={`text-2xl font-bold ${scoreColor(cell.score)}`}>
          {cell.score ?? '–'}
        </span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>

      <div className="space-y-3 divide-y divide-gray-100">
        {destinations.map((dest) => {
          const detail = cell.perDestination.find((p) => p.destinationId === dest.id);
          if (!detail) return null;

          if (detail.durationMinutes === null) {
            return (
              <div key={dest.id} className="pt-3 first:pt-0">
                <p className="text-xs font-semibold text-gray-700">{dest.name}</p>
                <p className="text-xs text-gray-400">Keine Verbindung berechnet</p>
              </div>
            );
          }

          const syntheticJourney: JourneyResult = {
            durationMinutes: detail.durationMinutes,
            transfers: detail.transfers ?? 0,
            legs: detail.legs ?? [],
            departureTime: '',
            arrivalTime: '',
          };

          return (
            <div key={dest.id} className="pt-3 first:pt-0">
              <p className="text-xs font-semibold text-gray-700 mb-1">{dest.name}</p>
              <JourneyResultView journey={syntheticJourney} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
