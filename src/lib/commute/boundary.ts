import type { BoundaryGeoJSON } from './grid';

let cached: BoundaryGeoJSON | null = null;

/** Server-side loader (route handlers, scripts). Reads the bundled GeoJSON straight off disk. */
export async function loadBerlinBoundaryServer(): Promise<BoundaryGeoJSON> {
  if (cached) return cached;
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const filePath = path.join(process.cwd(), 'public', 'data', 'berlin-boundary.geojson');
  const raw = await fs.readFile(filePath, 'utf-8');
  cached = JSON.parse(raw) as BoundaryGeoJSON;
  return cached;
}

/** Client-side loader (browser). Fetches the same file served statically from /public. */
export async function loadBerlinBoundaryClient(): Promise<BoundaryGeoJSON> {
  if (cached) return cached;
  const res = await fetch('/data/berlin-boundary.geojson');
  cached = (await res.json()) as BoundaryGeoJSON;
  return cached;
}
