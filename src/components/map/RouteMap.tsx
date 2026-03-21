import { useEffect, useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%',
  position: 'absolute' as const,
  top: 0,
  left: 0,
};

const defaultCenter = { lat: 36.7783, lng: -119.4179 }; // California center

interface RouteMapProps {
  pickup?: google.maps.LatLngLiteral | null;
  dropoff?: google.maps.LatLngLiteral | null;
  driverPosition?: google.maps.LatLngLiteral | null;
  directionsResult?: google.maps.DirectionsResult | null; // external directions (with alternatives)
  selectedRouteIndex?: number; // which route to highlight (default 0)
  isLoaded: boolean;
  onLoad?: (map: google.maps.Map) => void;
  /**
   * Set to true if you want to display alternative routes (only used when directionsResult is not provided).
   */
  showAlternatives?: boolean;
  /**
   * Historical tracking points to display as a polyline (e.g., the path the driver has taken).
   */
  points?: google.maps.LatLngLiteral[];
}

export default function RouteMap({
  pickup,
  dropoff,
  driverPosition,
  directionsResult: externalDirections,
  selectedRouteIndex = 0,
  isLoaded,
  onLoad,
  showAlternatives = false,
  points = [],
}: RouteMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [internalDirections, setInternalDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [trackPolyline, setTrackPolyline] = useState<google.maps.Polyline | null>(null);

  // Use external directions if provided, otherwise use internal
  const directions = externalDirections ?? internalDirections;

  const handleLoad = (map: google.maps.Map) => {
    setMap(map);
    if (onLoad) onLoad(map);
  };

  const handleUnmount = () => {
    setMap(null);
  };

  // Internal directions fetching (fallback when no external directions)
  useEffect(() => {
    // If external directions are provided, skip internal fetching
    if (externalDirections) {
      setInternalDirections(null);
      return;
    }

    if (!isLoaded || !pickup || !dropoff) {
      setInternalDirections(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: showAlternatives,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setInternalDirections(result);
        } else {
          console.error('Directions request failed:', status);
          setInternalDirections(null);
        }
      }
    );
  }, [isLoaded, pickup, dropoff, showAlternatives, externalDirections]);

  // Adjust map view when directions or coordinates change
  useEffect(() => {
    if (!map) return;

    if (directions) {
      // DirectionsRenderer will handle viewport unless preserveViewport is true
      return;
    }

    if (pickup && dropoff) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(dropoff);
      map.fitBounds(bounds);
    } else if (pickup) {
      map.setCenter(pickup);
      map.setZoom(12);
    } else if (dropoff) {
      map.setCenter(dropoff);
      map.setZoom(12);
    } else {
      map.setCenter(defaultCenter);
      map.setZoom(6);
    }
  }, [map, directions, pickup, dropoff]);

  // Draw historical points as a polyline with a distinct color
  useEffect(() => {
    if (!map || !points || points.length < 2) {
      // Remove existing polyline if it exists
      if (trackPolyline) {
        trackPolyline.setMap(null);
        setTrackPolyline(null);
      }
      return;
    }

    // Create new polyline for historical points
    const path = points.map(p => new google.maps.LatLng(p.lat, p.lng));
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#FFA500', // orange – distinct from the route color (blue/lime)
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map,
    });

    setTrackPolyline(polyline);

    // Cleanup on unmount or when points/map change
    return () => {
      polyline.setMap(null);
    };
  }, [map, points]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        Loading map...
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={defaultCenter}
      zoom={6}
      onLoad={handleLoad}
      onUnmount={handleUnmount}
      options={{
        fullscreenControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        zoomControl: true,
        mapTypeId: 'satellite',
      }}
    >
      {/* Pickup marker */}
      {pickup && <Marker position={pickup} label="P" />}

      {/* Dropoff marker */}
      {dropoff && <Marker position={dropoff} label="D" />}

      {/* Driver position marker */}
      {driverPosition && (
        <Marker
          position={driverPosition}
          icon={{
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            labelOrigin: new google.maps.Point(12, 12),
          }}
        />
      )}

      {/* Render directions if available */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true, // we already have our own markers
            preserveViewport: false, // let the map adjust to the route
            routeIndex: selectedRouteIndex,
            //  polylineOptions: {} // optional, defaults to blue for selected route
          }}
        />
      )}
    </GoogleMap>
  );
}