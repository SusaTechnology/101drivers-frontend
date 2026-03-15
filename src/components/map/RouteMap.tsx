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
  isLoaded: boolean;
  onLoad?: (map: google.maps.Map) => void;
  /**
   * Set to true if you want to display alternative routes.
   * The DirectionsRenderer will then show a route selector overlay.
   */
  showAlternatives?: boolean;
}

export default function RouteMap({
  pickup,
  dropoff,
  isLoaded,
  onLoad,
  showAlternatives = false,
}: RouteMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const handleLoad = (map: google.maps.Map) => {
    setMap(map);
    if (onLoad) onLoad(map);
  };

  const handleUnmount = () => {
    setMap(null);
  };

  // Fetch directions whenever pickup/dropoff change
  useEffect(() => {
    if (!isLoaded || !pickup || !dropoff) {
      setDirections(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: showAlternatives, // request alternatives if needed
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setDirections(result);
        } else {
          console.error('Directions request failed:', status);
          setDirections(null);
        }
      }
    );
  }, [isLoaded, pickup, dropoff, showAlternatives]);

  // Adjust map view when directions are loaded or coordinates change
  useEffect(() => {
    if (!map) return;

    if (directions) {
      // If we have directions, let the DirectionsRenderer handle the view
      // (it will fit bounds automatically unless preserveViewport is true)
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
      {/* Always show custom markers */}
      {pickup && <Marker position={pickup} label="P" />}
      {dropoff && <Marker position={dropoff} label="D" />}

      {/* Render directions if available */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true, // we already have our own markers
            preserveViewport: false, // let the map adjust to the route
            polylineOptions: {
              strokeColor: '#84cc16', // lime-500
              strokeOpacity: 0.8,
              strokeWeight: 4,
            },
          }}
        />
      )}
    </GoogleMap>
  );
}