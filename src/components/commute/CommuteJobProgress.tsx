'use client';

import { useEffect, useRef, useState } from 'react';
import { CommuteJob, TransportModePreference } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface Props {
  disabled: boolean;
  transportModes: TransportModePreference;
  // Called on every poll tick while a job runs (and once more when it finishes), so the
  // map can refetch and fill in newly-computed cells live instead of only at the end.
  onProgress: () => void;
}

export function CommuteJobProgress({ disabled, transportModes, onProgress }: Props) {
  const [job, setJob] = useState<CommuteJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollJob(jobId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/commute/jobs/${jobId}`);
        const data = await res.json();
        if (!data.success) return;
        setJob(data.job);
        onProgress();
        if (data.job.status === 'done' || data.job.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // transient network error while polling — keep trying
      }
    }, 2000);
  }

  async function handleRecompute() {
    setError(null);
    setJob(null);
    try {
      const res = await fetch('/api/commute/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transportModes }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Job konnte nicht gestartet werden');
        return;
      }
      pollJob(data.jobId);
    } catch {
      setError('Netzwerkfehler');
    }
  }

  const running = job && job.status !== 'done' && job.status !== 'error';
  const progressPct = job && job.totalCells > 0 ? Math.round((job.completedCells / job.totalCells) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">🔄 Berechnung</h2>
        <button
          onClick={handleRecompute}
          disabled={disabled || !!running}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {running && <LoadingSpinner size="sm" />}
          Neu berechnen
        </button>
      </div>

      {disabled && !job && (
        <p className="text-xs text-gray-400">Füge zuerst mindestens ein Ziel hinzu.</p>
      )}

      {job && (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full transition-all ${job.status === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${job.status === 'done' ? 100 : progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {job.status === 'done' && 'Fertig ✓'}
            {job.status === 'error' && `Fehler: ${job.error}`}
            {running && `${job.completedCells} / ${job.totalCells} Zellen (${progressPct}%)`}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
