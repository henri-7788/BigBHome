'use client';

import { useState, useEffect } from 'react';
import { Destination } from '@/lib/types';
import * as db from '@/lib/db';

export function useDestinations() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    db.fetchDestinations()
      .then((rows) => setDestinations(rows))
      .catch((err) => console.error('DB destinations load error:', err))
      .finally(() => setLoaded(true));
  }, []);

  const addDestination = (dest: Omit<Destination, 'id'>) => {
    const newDest: Destination = { ...dest, id: crypto.randomUUID() };
    setDestinations((prev) => [...prev, newDest]);
    db.insertDestination(newDest).catch((err) => console.error('DB insert destination error:', err));
  };

  const removeDestination = (id: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
    db.deleteDestination(id).catch((err) => console.error('DB delete destination error:', err));
  };

  return { destinations, loaded, addDestination, removeDestination };
}
