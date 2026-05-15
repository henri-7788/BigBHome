'use client';

import { useState } from 'react';
import { RouteSettings } from '@/lib/types';

interface Props {
  settings: RouteSettings;
  onChange: (next: RouteSettings) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          ⚙️ Einstellungen
          <span className="text-xs font-normal text-gray-400">
            {settings.timeMode === 'arrival' ? 'Ankunft' : 'Abfahrt'} {settings.time} Uhr
          </span>
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Routenzeitpunkt</p>
            <div className="flex gap-3">
              {(['arrival', 'departure'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="timeMode"
                    value={mode}
                    checked={settings.timeMode === mode}
                    onChange={() => onChange({ ...settings, timeMode: mode })}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    {mode === 'arrival' ? 'Ankunft um' : 'Abfahrt um'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Uhrzeit</p>
            <input
              type="time"
              value={settings.time}
              onChange={(e) => onChange({ ...settings, time: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p className="text-xs text-gray-400">
            Routen werden für den nächsten Werktag berechnet.
          </p>
        </div>
      )}
    </div>
  );
}
