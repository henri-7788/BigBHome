'use client';

import { useState, FormEvent } from 'react';
import { CommuteDestination, CommuteScheduleEntry, GeocodeResponse } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AddressAutocomplete, AddressSuggestion } from '@/components/AddressAutocomplete';

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 7: 'So',
};

interface Props {
  destinations: CommuteDestination[];
  onAdd: (dest: Omit<CommuteDestination, 'id'>) => void;
  onUpdate: (dest: CommuteDestination) => void;
  onWeightChange: (id: string, weight: number) => void;
  onRemove: (id: string) => void;
}

function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: CommuteScheduleEntry[];
  onChange: (schedule: CommuteScheduleEntry[]) => void;
}) {
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState('08:00');
  const [timeMode, setTimeMode] = useState<'arrival' | 'departure'>('arrival');

  const addEntry = () => {
    onChange([...schedule, { weekday, time, timeMode }]);
  };

  const removeEntry = (index: number) => {
    onChange(schedule.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {schedule.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {schedule.map((entry, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 pl-2 pr-1 py-0.5 text-xs text-gray-600"
            >
              {WEEKDAY_LABELS[entry.weekday]} {entry.time} ({entry.timeMode === 'arrival' ? 'an' : 'ab'})
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="text-gray-400 hover:text-red-500"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
          className="rounded border border-gray-300 px-1.5 py-1 text-xs"
        >
          {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded border border-gray-300 px-1.5 py-1 text-xs"
        />
        <select
          value={timeMode}
          onChange={(e) => setTimeMode(e.target.value as 'arrival' | 'departure')}
          className="rounded border border-gray-300 px-1.5 py-1 text-xs"
        >
          <option value="arrival">Ankunft</option>
          <option value="departure">Abfahrt</option>
        </select>
        <button
          type="button"
          onClick={addEntry}
          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          + Zeit
        </button>
      </div>
    </div>
  );
}

export function CommuteDestinationManager({
  destinations,
  onAdd,
  onUpdate,
  onWeightChange,
  onRemove,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [schedule, setSchedule] = useState<CommuteScheduleEntry[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddressChange = (next: string) => {
    setAddress(next);
    setSelectedCoords(null);
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setSelectedCoords({ lat: suggestion.lat, lng: suggestion.lng });
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (schedule.length === 0) {
      setError('Mindestens einen Zeitpunkt hinzufügen');
      return;
    }

    setIsGeocoding(true);
    try {
      // If a suggestion was picked we already have coordinates — no need to geocode again.
      let coords = selectedCoords;
      if (!coords) {
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
        coords = { lat: data.lat, lng: data.lng };
      }

      onAdd({
        name: name.trim(),
        address: address.trim(),
        lat: coords.lat,
        lng: coords.lng,
        weight: 50,
        schedule,
      });
      setName('');
      setAddress('');
      setSelectedCoords(null);
      setSchedule([]);
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
          Noch keine Ziele. Füge z.B. deinen Arbeitsplatz oder deine Berufsschule mit Zeitplan hinzu.
        </p>
      )}

      {destinations.length > 0 && (
        <div className="space-y-3 mb-3">
          {destinations.map((dest) => (
            <div key={dest.id} className="rounded-lg border border-gray-100 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800">{dest.name}</p>
                  <p className="text-xs text-gray-400 truncate max-w-64" title={dest.address}>
                    {dest.address}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(dest.id)}
                  className="text-gray-300 hover:text-red-400 text-xs"
                  title="Entfernen"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16">Gewicht</span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={dest.weight}
                  onChange={(e) => onWeightChange(dest.id, Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{dest.weight}</span>
              </div>

              <ScheduleEditor
                schedule={dest.schedule}
                onChange={(next) => onUpdate({ ...dest, schedule: next })}
              />
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="space-y-3 pt-1 border-t border-gray-100 mt-2">
          <div className="grid grid-cols-2 gap-2 pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Arbeitsplatz"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
              <AddressAutocomplete
                value={address}
                onChange={handleAddressChange}
                onSelect={handleSelectSuggestion}
                placeholder="Musterstraße 1, Berlin"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Zeitplan</p>
            <ScheduleEditor schedule={schedule} onChange={setSchedule} />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
                setName('');
                setAddress('');
                setSelectedCoords(null);
                setSchedule([]);
              }}
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
