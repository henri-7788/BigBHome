'use client';

import { useState, FormEvent } from 'react';
import { ScrapedListing } from '@/lib/types';

interface Props {
  partialData: Partial<ScrapedListing>;
  onSubmit: (data: { address: string; lat: number; lng: number; warmRent: number | null; size: number | null }) => void;
  onCancel: () => void;
}

export function ManualAddressForm({ partialData, onSubmit, onCancel }: Props) {
  const [address, setAddress] = useState(partialData.address ?? '');
  const [warmRent, setWarmRent] = useState(partialData.warmRent?.toString() ?? '');
  const [size, setSize] = useState(partialData.size?.toString() ?? '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGeocoding(true);

    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? 'Adresse nicht gefunden');
        setIsGeocoding(false);
        return;
      }

      onSubmit({
        address,
        lat: data.lat,
        lng: data.lng,
        warmRent: warmRent ? parseInt(warmRent, 10) : null,
        size: size ? parseInt(size, 10) : null,
      });
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-gray-900">Adresse manuell eingeben</h2>
        <p className="mb-4 text-sm text-gray-500">
          Das Inserat konnte nicht automatisch ausgelesen werden. Bitte gib die Adresse manuell ein.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Musterstraße 1, 10115 Berlin"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warmmiete (€)</label>
              <input
                type="number"
                value={warmRent}
                onChange={(e) => setWarmRent(e.target.value)}
                placeholder="800"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Größe (m²)</label>
              <input
                type="number"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="18"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isGeocoding || !address}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isGeocoding ? 'Suche...' : 'Route berechnen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
