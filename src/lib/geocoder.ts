import { BERLIN_BBOX } from '@/lib/commute/grid';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Address-as-you-type suggestions, scoped to Berlin via a viewbox.
 * Note: Nominatim's usage policy discourages autocomplete-style querying against the
 * public instance — fine for occasional personal use, but run your own instance
 * (via NOMINATIM_BASE) if this sees any real traffic.
 */
export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const base = process.env.NOMINATIM_BASE ?? 'https://nominatim.openstreetmap.org';
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    countrycodes: 'de',
    viewbox: `${BERLIN_BBOX.west},${BERLIN_BBOX.north},${BERLIN_BBOX.east},${BERLIN_BBOX.south}`,
    bounded: '1',
  });

  const res = await fetch(`${base}/search?${params}`, {
    headers: {
      'User-Agent': 'WGRouteFinder/1.0 (wg-route-finder)',
      Accept: 'application/json',
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) return [];

  const results: NominatimResult[] = await res.json();
  return results.map((r) => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const base = process.env.NOMINATIM_BASE ?? 'https://nominatim.openstreetmap.org';
  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    countrycodes: 'de',
  });

  const res = await fetch(`${base}/search?${params}`, {
    headers: {
      'User-Agent': 'WGRouteFinder/1.0 (wg-route-finder)',
      Accept: 'application/json',
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

  const results: NominatimResult[] = await res.json();
  if (!results.length) throw new Error(`No results for: ${address}`);

  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}
