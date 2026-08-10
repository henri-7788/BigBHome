'use client';

import { useEffect, useState } from 'react';
import { useCommuteDestinations } from '@/hooks/useCommuteDestinations';
import { useCommuteSettings } from '@/hooks/useCommuteSettings';
import { useCommuteGrid } from '@/hooks/useCommuteGrid';
import { CommuteDestinationManager } from './CommuteDestinationManager';
import { CommuteSettingsPanel } from './CommuteSettingsPanel';
import { CommuteJobProgress } from './CommuteJobProgress';
import { CommuteHeatmapMap } from './CommuteHeatmapMap';
import { CommuteDetailPanel } from './CommuteDetailPanel';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { fetchTravelTimesForCell } from '@/lib/commute/db';
import { CommuteTravelTime } from '@/lib/types';

export function CommuteView() {
  const { destinations, loaded, addDestination, updateDestination, updateWeight, removeDestination } =
    useCommuteDestinations();
  const { settings, updateSettings } = useCommuteSettings();
  const { cellScores, loading, reloadTravelTimes } = useCommuteGrid(destinations, settings.maxMinutes);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  // The heatmap colors come from lightweight score data only (see useCommuteGrid); the full
  // route breakdown (`legs`) for the selected cell is fetched on demand here, only once a
  // cell is actually clicked, instead of upfront for every cell on the map.
  const [cellDetail, setCellDetail] = useState<CommuteTravelTime[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    // Nothing to fetch once the panel is closed — `cellDetail` is reset right before the
    // next fetch starts (below), so stale data here is never shown in the meantime.
    if (!selectedCellId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting for the newly selected cell before its fetch resolves
    setDetailLoading(true);
    setCellDetail(null);
    fetchTravelTimesForCell(selectedCellId, destinations.map((d) => d.id))
      .then((rows) => {
        if (!cancelled) setCellDetail(rows);
      })
      .catch((err) => console.error('Cell detail load error:', err))
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCellId, destinations]);

  const selectedCellBase = selectedCellId
    ? (cellScores.find((c) => c.cellId === selectedCellId) ?? null)
    : null;

  const selectedCell = selectedCellBase
    ? {
        ...selectedCellBase,
        perDestination: selectedCellBase.perDestination.map((p) => ({
          ...p,
          legs: cellDetail?.find((t) => t.destinationId === p.destinationId)?.legs ?? null,
        })),
      }
    : null;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
        <LoadingSpinner size="md" />
        <span className="text-sm">Ziele werden geladen…</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
      <div className="space-y-4">
        <CommuteDestinationManager
          destinations={destinations}
          onAdd={addDestination}
          onUpdate={updateDestination}
          onWeightChange={updateWeight}
          onRemove={removeDestination}
        />
        <CommuteSettingsPanel settings={settings} onChange={updateSettings} />
        <CommuteJobProgress
          disabled={destinations.length === 0}
          transportModes={settings.transportModes}
          onProgress={reloadTravelTimes}
        />
        <CommuteDetailPanel
          cell={selectedCell}
          destinations={destinations}
          detailLoading={detailLoading}
          onClose={() => setSelectedCellId(null)}
        />
      </div>

      <div className="relative h-[600px] rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {destinations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-gray-400 px-6">
            <div>
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-sm">Füge links mindestens ein Ziel mit Zeitplan hinzu und starte die Berechnung.</p>
            </div>
          </div>
        ) : (
          <>
            <CommuteHeatmapMap
              cellScores={cellScores}
              destinations={destinations}
              onCellClick={setSelectedCellId}
              selectedCellId={selectedCellId}
            />
            {loading && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs text-gray-500 shadow">
                <LoadingSpinner size="sm" />
                Lade Fahrzeiten…
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
