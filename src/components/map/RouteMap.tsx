import { useEffect, useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import PickupZoneOverlay from './PickupZoneOverlay';

const containerStyle = {
  width: '100%',
  height: '100%',
  position: 'absolute' as const,
  top: 0,
  left: 0,
};

// Default: zoomed into Westside LA pickup zones
const defaultCenter = { lat: 33.98, lng: -118.45 }; // Marina del Rey area
const defaultZoom = 12;

// Full California fallback (used when no override)
const californiaCenter = { lat: 36.7783, lng: -119.4179 };
const californiaZoom = 6;

interface RouteMapProps {
  pickup?: google.maps.LatLngLiteral | null;
  dropoff?: google.maps.LatLngLiteral | null;
  driverPosition?: google.maps.LatLngLiteral | null;
  directionsResult?: google.maps.DirectionsResult | null; // external directions (with alternatives)
  selectedRouteIndex?: number; // which route to highlight (default 0)
  isLoaded: boolean;
  onLoad?: (map: google.maps.Map) => void;
  zones?: any[];
  /**
   * Set to true if you want to display alternative routes (only used when directionsResult is not provided).
   */
  showAlternatives?: boolean;
  /**
   * Historical tracking points to display as a polyline (e.g., the path the driver has taken).
   */
  points?: google.maps.LatLngLiteral[];
  /**
   * Map type to display. Options: 'roadmap' (default, shows place names), 
   * 'satellite' (no labels), 'hybrid' (satellite + labels), 'terrain'
   */
  mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  /**
   * Whether to show map type control for users to switch views
   */
  showMapTypeControl?: boolean;
  /**
   * Override the initial center and zoom for the map.
   * When provided, the map starts at this location instead of the default Westside LA.
   * Set showCaliforniaDefault to override this.
   */
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  /**
   * When true, use full California view as default (e.g. for non-LA contexts).
   */
  showCaliforniaDefault?: boolean;
  /**
   * When true, disable user pan/zoom until a route is calculated
   */
  lockViewport?: boolean;
}

export default function RouteMap({
  pickup,
  dropoff,
  driverPosition,
  directionsResult: externalDirections,
  selectedRouteIndex = 0,
  isLoaded,
  onLoad,
  zones,
  showAlternatives = false,
  points = [],
  mapType = 'roadmap',
  showMapTypeControl = true,
  initialCenter,
  initialZoom,
  showCaliforniaDefault = false,
  lockViewport = false,
}: RouteMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [internalDirections, setInternalDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [trackPolyline, setTrackPolyline] = useState<google.maps.Polyline | null>(null);

  // Use external directions if provided, otherwise use internal
  const directions = externalDirections ?? internalDirections;

  // Determine the effective initial center/zoom
  const mapCenter = showCaliforniaDefault ? californiaCenter : (initialCenter || defaultCenter);
  const mapZoom = showCaliforniaDefault ? californiaZoom : (initialZoom || defaultZoom);

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
      map.setZoom(13);
    } else if (dropoff) {
      map.setCenter(dropoff);
      map.setZoom(13);
    }
    // else: keep the initial center/zoom set in GoogleMap props
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
      center={mapCenter}
      zoom={mapZoom}
      onLoad={handleLoad}
      onUnmount={handleUnmount}
      options={{
        fullscreenControl: !lockViewport,
        streetViewControl: false,
        mapTypeControl: showMapTypeControl,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
        },
        zoomControl: !lockViewport,
        gestureHandling: lockViewport && !directions ? 'none' : 'auto',
        mapTypeId: mapType,
        // Enable place names and POI labels
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }],
          },
          {
            featureType: 'transit',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }],
          },
        ],
      }}
    >
      {/* Pickup marker */}
      {pickup && <Marker position={pickup} label="A" />}

      {/* Dropoff marker */}
      {dropoff && <Marker position={dropoff} label="B" />}

      {/* Driver position marker - custom car icon */}
      {driverPosition && (
        <Marker
          position={driverPosition}
          icon={{
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48">
                <!-- Car shadow -->
                <ellipse cx="32" cy="56" rx="20" ry="6" fill="rgba(0,0,0,0.2)"/>
                <!-- Car body -->
                <rect x="8" y="28" width="48" height="22" rx="6" fill="#3b82f6"/>
                <!-- Car roof/cabin -->
                <path d="M16 28 Q16 14 32 14 Q48 14 48 28" fill="#1d4ed8"/>
                <!-- Windows -->
                <path d="M18 26 Q18 18 32 18 Q46 18 46 26 Z" fill="#93c5fd"/>
                <!-- Wheels -->
                <circle cx="18" cy="50" r="8" fill="#1f2937"/>
                <circle cx="18" cy="50" r="4" fill="#6b7280"/>
                <circle cx="46" cy="50" r="8" fill="#1f2937"/>
                <circle cx="46" cy="50" r="4" fill="#6b7280"/>
                <!-- Headlights -->
                <rect x="50" y="34" width="4" height="6" rx="1" fill="#fbbf24"/>
                <rect x="50" y="42" width="4" height="4" rx="1" fill="#ef4444"/>
                <!-- Location pin pointer -->
                <polygon points="32,62 26,54 38,54" fill="#3b82f6"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(48, 48),
            anchor: new google.maps.Point(24, 56),
            labelOrigin: new google.maps.Point(24, 24),
          }}
        />
      )}

      {/* Render directions if available */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true, // we already have our own markers
            preserveViewport: false, // auto-zoom to fit route on submit
            routeIndex: selectedRouteIndex,
          }}
        />
      )}

      {/* Pickup zone overlay polygons */}
      {zones && zones.length > 0 && <PickupZoneOverlay zones={zones} />}
    </GoogleMap>
  );
}
