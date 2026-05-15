'use client';

import { useState, FormEvent } from 'react';
import { Destination, GeocodeResponse } from '@/lib/types';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  destinations: Destination[];
  onAdd: (dest: Omit<Destination, 'id'>) => void;
  onRemove: (id: string) => void;
}

export function DestinationManager({ destinations, onAdd, onRemove }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGeocoding(true);

    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data: GeocodeResponse = await res.json();

      if (!data.success || data.lat == null || data.lng == null) {
        setError(data.error ?? 'Adresse nicht gefunden');
        return;
      }

      onAdd({ name: name.trim(), address: address.trim(), lat: data.lat, lng: data.lng });
      setName('');
      setAddress('');
      setShowForm(false);
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">🎯 Ziele</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            + Ziel hinzufügen
          </button>
        )}
      </div>

      {destinations.length === 0 && !showForm && (
        <p className="text-xs text-gray-400">
          Noch keine Ziele. Füge deinen Arbeitsplatz oder deine Berufsschule hinzu.
        </p>
      )}

      {destinations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {destinations.map((dest) => (
            <div
              key={dest.id}
              className="flex items-center gap-1.5 rounded-full bg-blue-50 pl-3 pr-2 py-1.5"
            >
              <span className="text-xs font-semibold text-blue-700">{dest.name}</span>
              <span className="text-xs text-blue-400 truncate max-w-40" title={dest.address}>
                {dest.address}
              </span>
              <button
                onClick={() => onRemove(dest.id)}
                className="ml-1 text-blue-300 hover:text-red-400 text-xs leading-none"
                title="Entfernen"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Berufsschule"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Musterstraße 1, Berlin"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); setName(''); setAddress(''); }}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isGeocoding || !name.trim() || !address.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isGeocoding && <LoadingSpinner size="sm" />}
              {isGeocoding ? 'Suche…' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
