'use client';

import { useState, useEffect, useCallback } from 'react';
import { Suggestion } from '@/lib/types';

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/suggestions');
      const data = await res.json();
      if (data.success) setSuggestions(data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const dismiss = useCallback(async (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await fetch('/api/suggestions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'dismiss' }),
    });
  }, []);

  return { suggestions, loading, dismiss, refetch: fetchSuggestions };
}
