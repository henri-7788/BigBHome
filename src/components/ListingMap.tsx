'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Destination } from '@/lib/types';

function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
}

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface ListingMapProps {
  lat: number;
  lng: number;
  title: string;
  destinations: Destination[];
}

export default function ListingMap({ lat, lng, title, destinations }: ListingMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  // Center between listing and first destination (or just listing if no destinations)
  const allLats = [lat, ...destinations.map((d) => d.lat)];
  const allLngs = [lng, ...destinations.map((d) => d.lng)];
  const centerLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
  const centerLng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={destinations.length > 0 ? 12 : 14}
      className="h-56 w-full rounded-lg z-0"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]}>
        <Popup>{title}</Popup>
      </Marker>
      {destinations.map((dest) => (
        <Marker key={dest.id} position={[dest.lat, dest.lng]} icon={destIcon}>
          <Popup>{dest.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
