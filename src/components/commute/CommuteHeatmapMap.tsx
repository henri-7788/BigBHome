'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CommuteCellScore, CommuteDestination } from '@/lib/types';

const GRID_SPACING_METERS = 500;
const METERS_PER_DEGREE_LAT = 111_320;

interface Props {
  cellScores: CommuteCellScore[];
  destinations: CommuteDestination[];
  onCellClick: (cellId: string) => void;
  selectedCellId: string | null;
}

function cellsToGeoJSON(cellScores: CommuteCellScore[]): GeoJSON.FeatureCollection {
  const latHalf = GRID_SPACING_METERS / METERS_PER_DEGREE_LAT / 2;

  return {
    type: 'FeatureCollection',
    features: cellScores.map((cell) => {
      const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((cell.lat * Math.PI) / 180);
      const lngHalf = GRID_SPACING_METERS / metersPerDegreeLng / 2;

      return {
        type: 'Feature',
        properties: {
          cellId: cell.cellId,
          score: cell.score,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [cell.lng - lngHalf, cell.lat - latHalf],
              [cell.lng + lngHalf, cell.lat - latHalf],
              [cell.lng + lngHalf, cell.lat + latHalf],
              [cell.lng - lngHalf, cell.lat + latHalf],
              [cell.lng - lngHalf, cell.lat - latHalf],
            ],
          ],
        },
      };
    }),
  };
}

const SOURCE_ID = 'commute-grid';
const FILL_LAYER_ID = 'commute-grid-fill';
const OUTLINE_LAYER_ID = 'commute-grid-selected-outline';

export function CommuteHeatmapMap({ cellScores, destinations, onCellClick, selectedCellId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // State (not a ref) so effects that only need to run once the map has finished loading
  // re-run when this flips — a ref wouldn't retrigger effects whose data (e.g. destinations)
  // was already set before the map's "load" event fired, leaving markers/data never drawn.
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [13.405, 52.52],
      zoom: 10,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: cellsToGeoJSON(cellScores),
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'score'], null],
            '#9ca3af',
            [
              'interpolate',
              ['linear'],
              ['get', 'score'],
              0, '#dc2626',
              50, '#f59e0b',
              100, '#16a34a',
            ],
          ],
          'fill-opacity': 0.55,
        },
      });

      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 2,
        },
        filter: ['==', ['get', 'cellId'], ''],
      });

      map.on('click', FILL_LAYER_ID, (e) => {
        const cellId = e.features?.[0]?.properties?.cellId;
        if (cellId) onCellClick(cellId);
      });

      map.on('mouseenter', FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });

      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(cellsToGeoJSON(cellScores));
  }, [cellScores, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.setFilter(OUTLINE_LAYER_ID, ['==', ['get', 'cellId'], selectedCellId ?? '']);
  }, [selectedCellId, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = destinations.map((dest) => {
      const el = document.createElement('div');
      el.textContent = '📍';
      el.style.fontSize = '28px';
      el.style.lineHeight = '1';
      el.style.cursor = 'default';
      el.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))';

      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([dest.lng, dest.lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setText(dest.name))
        .addTo(map);
    });
  }, [destinations, mapLoaded]);

  return <div ref={containerRef} className="h-full w-full rounded-xl" />;
}
