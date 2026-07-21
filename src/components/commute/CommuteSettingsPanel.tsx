'use client';

import { useState } from 'react';
import { CommuteSettings } from '@/hooks/useCommuteSettings';

interface Props {
  settings: CommuteSettings;
  onChange: (next: CommuteSettings) => void;
}

export function CommuteSettingsPanel({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          ⚙️ Einstellungen
          <span className="text-xs font-normal text-gray-400">max. {settings.maxMinutes} min</span>
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">
              Maximale Pendelzeit ({settings.maxMinutes} min)
            </p>
            <input
              type="range"
              min={15}
              max={120}
              step={5}
              value={settings.maxMinutes}
              onChange={(e) => onChange({ ...settings, maxMinutes: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
            <p className="text-xs text-gray-400 mt-1">
              Zellen, die dieses Limit für ein Ziel überschreiten, werden als schlechtest bewertet (Score 0).
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Verkehrsmittel</p>
            <div className="flex gap-4">
              {(
                [
                  { key: 'walk', label: '🚶 Zu Fuß' },
                  { key: 'bike', label: '🚲 Fahrrad' },
                  { key: 'transit', label: '🚊 ÖPNV' },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.transportModes[key]}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        transportModes: { ...settings.transportModes, [key]: e.target.checked },
                      })
                    }
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Änderungen an Verkehrsmitteln erfordern eine Neuberechnung (Button unten).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
