import React from 'react';
import { Polygon } from '@react-google-maps/api';

interface PickupZoneOverlayProps {
  zones: any[];
}

export default function PickupZoneOverlay({ zones }: PickupZoneOverlayProps) {
  if (!zones || zones.length === 0) return null;

  return (
    <>
      {zones.map((zone) => {
        if (!zone.geoJson?.geometry?.coordinates) return null;
        const ring = zone.geoJson.geometry.coordinates[0]; // outer ring: [[lng, lat], ...]

        // GeoJSON stores [lng, lat], Google Maps needs {lat, lng}
        const paths = ring.map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0],
        }));

        return (
          <Polygon
            key={zone.id || zone.code}
            paths={paths}
            options={{
              fillColor: '#39FF14',
              fillOpacity: 0.15,
              strokeColor: '#39FF14',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              clickable: false,
              zIndex: 1,
            }}
          />
        );
      })}
    </>
  );
}
