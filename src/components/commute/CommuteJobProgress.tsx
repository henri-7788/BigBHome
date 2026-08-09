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

// The recompute job itself runs server-side in the worker, independent of this tab —
// reloading/leaving the page doesn't stop it. What's stored here is just the job id, so a
// fresh page load can find and resume polling an already-running job instead of losing
// track of it (which otherwise looks exactly like the computation stopped).
const STORAGE_KEY = 'commute-current-job-id';

export function CommuteJobProgress({ disabled, transportModes, onProgress }: Props) {
  const [job, setJob] = useState<CommuteJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pollJob(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
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

  useEffect(() => {
    const adopt = (job: CommuteJob) => {
      setJob(job);
      localStorage.setItem(STORAGE_KEY, job.id);
      if (job.status === 'pending' || job.status === 'running') {
        pollJob(job.id);
      }
    };

    const storedJobId = localStorage.getItem(STORAGE_KEY);
    const storedJobFetch = storedJobId
      ? fetch(`/api/commute/jobs/${storedJobId}`)
          .then((res) => res.json())
          .then((data) => (data.success ? (data.job as CommuteJob) : null))
          .catch(() => null)
      : Promise.resolve(null);

    // Falls back to whatever job actually ran most recently — the stored id only tracks a
    // job *this browser* started, so a run triggered elsewhere (server cron, another
    // device, a direct API call) would otherwise never show up here at all.
    storedJobFetch.then((storedJob) => {
      if (storedJob && (storedJob.status === 'pending' || storedJob.status === 'running')) {
        adopt(storedJob);
        return;
      }

      fetch('/api/commute/jobs/latest')
        .then((res) => res.json())
        .then((data) => {
          if (!data.success || !data.job) {
            if (storedJob) setJob(storedJob);
            return;
          }
          if (data.job.status === 'pending' || data.job.status === 'running') {
            adopt(data.job);
          } else if (storedJob) {
            setJob(storedJob);
          } else {
            setJob(data.job);
          }
        })
        .catch(() => {
          if (storedJob) setJob(storedJob);
        });
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRecompute(options?: { resume?: boolean }) {
    if (!options?.resume) {
      const confirmed = window.confirm(
        'Neu berechnen löscht alle bisher berechneten Fahrzeiten und startet die Heatmap komplett neu. Wirklich fortfahren?',
      );
      if (!confirmed) return;
    }
    setError(null);
    if (!options?.resume) setJob(null);
    try {
      const res = await fetch('/api/commute/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transportModes,
          resume: options?.resume ?? false,
          jobId: options?.resume ? job?.id : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Job konnte nicht gestartet werden');
        return;
      }
      localStorage.setItem(STORAGE_KEY, data.jobId);
      pollJob(data.jobId);
    } catch {
      setError('Netzwerkfehler');
    }
  }

  async function handleStop() {
    if (!job) return;
    setError(null);
    try {
      const res = await fetch(`/api/commute/jobs/${job.id}/stop`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Job konnte nicht gestoppt werden');
        return;
      }
      if (pollRef.current) clearInterval(pollRef.current);
      setJob((prev) => (prev ? { ...prev, status: 'stopped' } : prev));
    } catch {
      setError('Netzwerkfehler');
    }
  }

  const running = job && (job.status === 'pending' || job.status === 'running');
  const stopped = job?.status === 'stopped';
  const progressPct = job && job.totalCells > 0 ? Math.round((job.completedCells / job.totalCells) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">🔄 Berechnung</h2>
        <div className="flex items-center gap-1.5">
          {running && (
            <button
              onClick={handleStop}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Stoppen
            </button>
          )}
          {stopped && (
            <button
              onClick={() => handleRecompute({ resume: true })}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Fortsetzen
            </button>
          )}
          <button
            onClick={() => handleRecompute()}
            disabled={disabled || !!running}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running && <LoadingSpinner size="sm" />}
            Neu berechnen
          </button>
        </div>
      </div>

      {disabled && !job && (
        <p className="text-xs text-gray-400">Füge zuerst mindestens ein Ziel hinzu.</p>
      )}

      {job && (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full transition-all ${
                job.status === 'error' ? 'bg-red-500' : stopped ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${job.status === 'done' ? 100 : progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {job.status === 'done' && 'Fertig ✓'}
            {job.status === 'error' && `Fehler: ${job.error}`}
            {stopped && `Angehalten bei ${job.completedCells} / ${job.totalCells} Zellen (${progressPct}%)`}
            {running && `${job.completedCells} / ${job.totalCells} Zellen (${progressPct}%)`}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
