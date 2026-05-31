'use client';

import { useReducer, useEffect, useState } from 'react';
import { ListingResult, ScrapedListing, DestinationJourney } from '@/lib/types';
import * as db from '@/lib/db';

type Action =
  | { type: 'LOAD'; listings: ListingResult[] }
  | { type: 'ADD'; id: string }
  | { type: 'UPDATE'; id: string; payload: Partial<ListingResult> }
  | { type: 'REMOVE'; id: string }
  | { type: 'SET_FAVORITE'; id: string; value: boolean }
  | { type: 'TOGGLE_COMPARISON'; id: string }
  | { type: 'SET_OFFLINE'; id: string; value: boolean };

function reducer(state: ListingResult[], action: Action): ListingResult[] {
  switch (action.type) {
    case 'LOAD':
      return action.listings;
    case 'ADD':
      return [
        {
          id: action.id,
          listing: null,
          destinationJourneys: [],
          isFavorite: false,
          isSelectedForComparison: false,
          isLoading: true,
          error: null,
          isOffline: false,
        },
        ...state,
      ];
    case 'UPDATE':
      return state.map((r) => (r.id === action.id ? { ...r, ...action.payload } : r));
    case 'REMOVE':
      return state.filter((r) => r.id !== action.id);
    case 'SET_FAVORITE':
      return state.map((r) => (r.id === action.id ? { ...r, isFavorite: action.value } : r));
    case 'TOGGLE_COMPARISON':
      return state.map((r) =>
        r.id === action.id ? { ...r, isSelectedForComparison: !r.isSelectedForComparison } : r,
      );
    case 'SET_OFFLINE':
      return state.map((r) => (r.id === action.id ? { ...r, isOffline: action.value } : r));
    default:
      return state;
  }
}

export function useListings() {
  const [listings, dispatch] = useReducer(reducer, []);
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    db.fetchListings()
      .then((rows) => {
        dispatch({ type: 'LOAD', listings: rows });
      })
      .catch((err) => console.error('DB load error:', err))
      .finally(() => setDbLoaded(true));
  }, []);

  const addListing = (id: string) => dispatch({ type: 'ADD', id });

  const updateListing = (
    id: string,
    payload: {
      listing?: ScrapedListing;
      destinationJourneys?: DestinationJourney[];
      isLoading?: boolean;
      error?: string | null;
    },
  ) => {
    dispatch({ type: 'UPDATE', id, payload });
    if (payload.isLoading === false && payload.listing) {
      db.upsertListing(id, payload.listing, payload.destinationJourneys ?? [], false).catch(
        (err) => console.error('DB upsert error:', err),
      );
    }
  };

  const removeListing = (id: string) => {
    dispatch({ type: 'REMOVE', id });
    db.deleteListing(id).catch((err) => console.error('DB delete error:', err));
  };

  const toggleFavorite = (id: string, newValue: boolean) => {
    dispatch({ type: 'SET_FAVORITE', id, value: newValue });
    db.updateFavorite(id, newValue).catch((err) => console.error('DB favorite error:', err));
  };

  const toggleComparison = (id: string) => dispatch({ type: 'TOGGLE_COMPARISON', id });

  const toggleOffline = (id: string, newValue: boolean) => {
    dispatch({ type: 'SET_OFFLINE', id, value: newValue });
    db.updateOfflineStatus(id, newValue).catch((err) => console.error('DB offline error:', err));
  };

  return { listings, dbLoaded, addListing, updateListing, removeListing, toggleFavorite, toggleComparison, toggleOffline };
}
