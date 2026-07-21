import { GridCell } from '@/lib/types';

export const BERLIN_BBOX = {
  south: 52.338,
  west: 13.088,
  north: 52.675,
  east: 13.761,
};

type Ring = [number, number][];
type Polygon = Ring[];
export interface BoundaryGeoJSON {
  type: 'Feature';
  geometry: { type: 'MultiPolygon'; coordinates: Polygon[] };
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, polygon: Polygon): boolean {
  // First ring is the outer boundary, remaining rings are holes.
  if (!pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
}

export function isInBerlin(lng: number, lat: number, boundary: BoundaryGeoJSON): boolean {
  return boundary.geometry.coordinates.some((polygon) => pointInPolygon(lng, lat, polygon));
}

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Generates a regular lat/lng grid over Berlin, clipped to the city boundary.
 * Cell ids are stable across runs so cached travel times stay valid between calls.
 */
export function generateBerlinGrid(spacingMeters: number, boundary: BoundaryGeoJSON): GridCell[] {
  const latStep = spacingMeters / METERS_PER_DEGREE_LAT;
  const cells: GridCell[] = [];

  let row = 0;
  for (let lat = BERLIN_BBOX.south; lat <= BERLIN_BBOX.north; lat += latStep, row++) {
    const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
    const lngStep = spacingMeters / metersPerDegreeLng;

    let col = 0;
    for (let lng = BERLIN_BBOX.west; lng <= BERLIN_BBOX.east; lng += lngStep, col++) {
      if (isInBerlin(lng, lat, boundary)) {
        cells.push({ id: `r${row}c${col}`, lat, lng });
      }
    }
  }

  return cells;
}
