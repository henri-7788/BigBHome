interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
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
