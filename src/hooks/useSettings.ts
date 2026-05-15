'use client';

import { useState, useEffect } from 'react';
import { RouteSettings } from '@/lib/types';

const STORAGE_KEY = 'wg-route-settings';
const DEFAULT_SETTINGS: RouteSettings = { timeMode: 'arrival', time: '08:00' };

export function useSettings() {
  const [settings, setSettings] = useState<RouteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings(JSON.parse(stored));
    } catch {}
  }, []);

  function updateSettings(next: RouteSettings) {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  return { settings, updateSettings };
}
