'use client';

import { useState, useEffect } from 'react';
import { CommuteDestination } from '@/lib/types';
import * as db from '@/lib/commute/db';

export function useCommuteDestinations() {
  const [destinations, setDestinations] = useState<CommuteDestination[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    db.fetchCommuteDestinations()
      .then((rows) => setDestinations(rows))
      .catch((err) => console.error('DB commute destinations load error:', err))
      .finally(() => setLoaded(true));
  }, []);

  const addDestination = (dest: Omit<CommuteDestination, 'id'>) => {
    const newDest: CommuteDestination = { ...dest, id: crypto.randomUUID() };
    setDestinations((prev) => [...prev, newDest]);
    db.insertCommuteDestination(newDest).catch((err) =>
      console.error('DB insert commute destination error:', err),
    );
  };

  const updateDestination = (dest: CommuteDestination) => {
    setDestinations((prev) => prev.map((d) => (d.id === dest.id ? dest : d)));
    db.updateCommuteDestination(dest).catch((err) =>
      console.error('DB update commute destination error:', err),
    );
  };

  const removeDestination = (id: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
    db.deleteCommuteDestination(id).catch((err) =>
      console.error('DB delete commute destination error:', err),
    );
  };

  return { destinations, loaded, addDestination, updateDestination, removeDestination };
}
