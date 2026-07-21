'use client';

import { useState, useEffect } from 'react';
import { TransportModePreference } from '@/lib/types';

export interface CommuteSettings {
  maxMinutes: number;
  transportModes: TransportModePreference;
}

const STORAGE_KEY = 'commute-heatmap-settings';
const DEFAULT_SETTINGS: CommuteSettings = {
  maxMinutes: 60,
  transportModes: { walk: true, bike: false, transit: true },
};

export function useCommuteSettings() {
  const [settings, setSettings] = useState<CommuteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
      if (stored) setSettings(JSON.parse(stored));
    } catch {}
  }, []);

  function updateSettings(next: CommuteSettings) {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  return { settings, updateSettings };
}
