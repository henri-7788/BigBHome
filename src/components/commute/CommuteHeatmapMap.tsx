'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CommuteCellScore } from '@/lib/types';

const GRID_SPACING_METERS = 500;
const METERS_PER_DEGREE_LAT = 111_320;

interface Props {
  cellScores: CommuteCellScore[];
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

export function CommuteHeatmapMap({ cellScores, onCellClick, selectedCellId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);

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

      loadedRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(cellsToGeoJSON(cellScores));
  }, [cellScores]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter(OUTLINE_LAYER_ID, ['==', ['get', 'cellId'], selectedCellId ?? '']);
  }, [selectedCellId]);

  return <div ref={containerRef} className="h-full w-full rounded-xl" />;
}
