import { useEffect, useRef, useState, useMemo } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import PickupZoneOverlay from './PickupZoneOverlay';
import carSvgRaw from '@/assets/car.svg?raw';

// Front of car (anchor point) — GPS coordinate sits exactly here
const CAR_ANCHOR_X = 24;
const CAR_ANCHOR_Y = 13;

/**
 * Generate a car icon data-URI with heading baked into the SVG transform.
 * This avoids Google Maps' Icon.rotation which compresses/distorts SVGs.
 *
 * The car.svg points UP (north = 0 degrees). We dynamically wrap it in a
 * rotation <g> that spins the car around the front anchor point (24, 13).
 */
function getCarIconUrl(headingDeg: number | null | undefined): string {
  const rotation = headingDeg != null ? headingDeg : 0;
  const rotateTransform = `translate(${CAR_ANCHOR_X},${CAR_ANCHOR_Y}) rotate(${rotation}) translate(${-CAR_ANCHOR_X},${-CAR_ANCHOR_Y})`;
  const rotated = carSvgRaw
    .replace('fill="none">', `fill="none"><g transform="${rotateTransform}">`)
    .replace('</svg>', '</g></svg>');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(rotated);
}

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
  driverHeading?: number | null; // bearing in degrees (0-360, 0=North)
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
  /**
   * When true, auto-fit map bounds to all service district zones.
   * Takes priority over initialCenter/initialZoom once zones are loaded.
   */
  fitZonesBounds?: boolean;
  /**
   * When true, the map will center on the driver's current position when it
   * first becomes available. The route and markers are still drawn, but the
   * initial viewport focuses on the driver rather than the full route.
   */
  focusOnDriver?: boolean;
  /**
   * When true, the map continuously pans to follow the driver and rotates
   * to match the heading (like Uber/Google Maps navigation).
   * If the user manually drags the map, following pauses (heading resets to
   * north-up) and a re-center button appears. Tapping it resumes following
   * and heading rotation.
   */
  followDriver?: boolean;
  /**
   * When true, hide the "A"/"B" labels on pickup/dropoff markers.
   */
  showMarkerLabels?: boolean;
}

export default function RouteMap({
  pickup,
  dropoff,
  driverPosition,
  driverHeading: heading,
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
  fitZonesBounds = false,
  focusOnDriver = false,
  followDriver = false,
  showMarkerLabels = true,
}: RouteMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [internalDirections, setInternalDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [trackPolyline, setTrackPolyline] = useState<google.maps.Polyline | null>(null);
  const initialDriverFocusDone = useRef(false);

  // ── Follow-driver state (refs, not state — avoids re-renders on every GPS tick) ──
  const followingRef = useRef(true);
  const userDraggedRef = useRef(false);

  // ── Imperative driver marker with smooth position animation ──
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const animPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const animFrameRef = useRef<number>(0);

  // ── Re-center button visibility (state because it controls JSX) ──
  const [showRecenter, setShowRecenter] = useState(false);

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

  // ── Imperative driver marker: create, remove, and animate ──
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Create marker on first driver position
    if (!driverMarkerRef.current && driverPosition) {
      driverMarkerRef.current = new google.maps.Marker({
        map,
        position: driverPosition,
        icon: {
          url: getCarIconUrl(heading),
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(CAR_ANCHOR_X, CAR_ANCHOR_Y),
        },
      });
      animPosRef.current = driverPosition;
      return;
    }

    // Remove marker if position cleared
    if (!driverPosition && driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
      animPosRef.current = null;
      return;
    }

    // Move marker to new position
    if (driverPosition && driverMarkerRef.current) {
      // Update heading immediately
      if (heading != null) {
        driverMarkerRef.current.setIcon({
          url: getCarIconUrl(heading),
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(CAR_ANCHOR_X, CAR_ANCHOR_Y),
        });
      }

      const from = animPosRef.current || driverPosition;
      const to = driverPosition;
      if (from.lat === to.lat && from.lng === to.lng) return;

      // Cancel any running animation
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      // ── UBER PATTERN: When following, snap marker instantly ──
      // The map moveCamera handles all visual smoothness. Animating the marker
      // AND moving the camera creates a "double animation" where the map
      // arrives before the marker catches up — looks laggy.
      // Uber keeps the car fixed in center; only the map moves.
      if (followDriver && followingRef.current) {
        driverMarkerRef.current.setPosition(to);
        animPosRef.current = to;
        return;
      }

      // ── NOT following: animate marker smoothly (e.g., user dragged away) ──
      const duration = 2800; // ms — completes before next ~3s GPS ping
      const startTime = performance.now();

      const step = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - (1 - t) * (1 - t); // ease-out quadratic
        const lat = from.lat + (to.lat - from.lat) * eased;
        const lng = from.lng + (to.lng - from.lng) * eased;
        const pos = { lat, lng };
        animPosRef.current = pos;
        driverMarkerRef.current?.setPosition(pos);
        if (t < 1) animFrameRef.current = requestAnimationFrame(step);
      };

      animFrameRef.current = requestAnimationFrame(step);
    }
  }, [map, isLoaded, driverPosition, heading, followDriver]);

  // Cleanup marker on unmount
  useEffect(() => {
    return () => {
      if (driverMarkerRef.current) { driverMarkerRef.current.setMap(null); driverMarkerRef.current = null; }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Center on driver position once when it first becomes available
  useEffect(() => {
    if (!map || !focusOnDriver || !driverPosition || initialDriverFocusDone.current) return;

    map.setCenter(driverPosition);
    map.setZoom(16); // slightly tighter zoom for navigation feel
    initialDriverFocusDone.current = true;
  }, [map, focusOnDriver, driverPosition]);

  // ── Detect user drag to pause following ──
  // When user drags: stop following AND reset heading to north-up (0).
  // This is what Uber/Google Maps do — dragging exits navigation mode
  // and returns the map to a standard north-up orientation.
  useEffect(() => {
    if (!map || !followDriver) return;

    const onDragStart = () => {
      userDraggedRef.current = true;
      followingRef.current = false;
      // Reset map heading to north-up when user takes control
      map.setHeading(0);
    };
    const listener = map.addListener('dragstart', onDragStart);
    return () => { google.maps.event.removeListener(listener); };
  }, [map, followDriver]);

  // ── Continuous follow: moveCamera with heading rotation ──
  // Uses moveCamera (not panTo) so center + heading + tilt update atomically
  // in a single animation frame — no flicker, no double-animation.
  // This is the Uber/Google Maps navigation pattern.
  useEffect(() => {
    if (!map || !followDriver || !driverPosition || !followingRef.current) return;

    const cameraOpts: google.maps.CameraOptions = {
      center: driverPosition,
      // Rotate map to match heading when available.
      // GPS heading is null when stationary — in that case, keep the last
      // heading (Google Maps does the same). Only set heading when we have it.
      ...(heading != null && { heading }),
    };

    map.moveCamera(cameraOpts);
  }, [map, followDriver, driverPosition, heading]);

  // ── Show/hide re-center button based on follow state ──
  useEffect(() => {
    if (!followDriver) { setShowRecenter(false); return; }
    setShowRecenter(!followingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followDriver, driverPosition]);

  const handleRecenter = () => {
    if (!map || !driverPosition) return;
    followingRef.current = true;
    userDraggedRef.current = false;
    // Atomic re-center with heading — single smooth animation
    const cameraOpts: google.maps.CameraOptions = {
      center: driverPosition,
      ...(heading != null && { heading }),
    };
    map.moveCamera(cameraOpts);
    setShowRecenter(false);
  };

  // Adjust map view when directions or coordinates change
  useEffect(() => {
    if (!map) return;

    // Don't auto-zoom when focusing on driver — the driver-focus effect handles it
    if (focusOnDriver) return;

    if (directions) {
      // DirectionsRenderer will handle viewport unless preserveViewport is true
      return;
    }

    // Don't override if zones are fitting the bounds
    if (fitZonesBounds && zones && zones.length > 0) return;

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
  }, [map, directions, pickup, dropoff, fitZonesBounds, zones, focusOnDriver]);

  // Auto-fit map to service district zones when they load
  useEffect(() => {
    if (!map || !fitZonesBounds || !zones || zones.length === 0) return;
    // Only defer to directions — show zones alongside pickup/dropoff markers
    if (directions) return;

    const bounds = new google.maps.LatLngBounds();
    let hasCoords = false;

    zones.forEach((zone: any) => {
      try {
        const geoJson = typeof zone.geoJson === 'string' ? JSON.parse(zone.geoJson) : zone.geoJson;
        if (geoJson?.coordinates) {
          const coords = geoJson.type === 'Polygon'
            ? geoJson.coordinates[0]
            : geoJson.coordinates.flatMap((ring: any) => ring);
          coords.forEach((c: [number, number]) => {
            bounds.extend({ lat: c[1], lng: c[0] });
            hasCoords = true;
          });
        }
      } catch (e) {
        console.warn('Failed to parse zone geoJson:', e);
      }
    });

    if (hasCoords) {
      // Use proportional padding based on container size so polygon is never clipped
      const mapDiv = map.getDiv();
      const w = mapDiv.clientWidth;
      const h = mapDiv.clientHeight;
      const padV = Math.round(h * 0.12); // 12% vertical padding
      const padH = Math.round(w * 0.08); // 8% horizontal padding
      map.fitBounds(bounds, { top: padV, right: padH, bottom: padV, left: padH });
    }
  }, [map, fitZonesBounds, zones, directions]);

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
      {pickup && <Marker position={pickup} {...(showMarkerLabels ? { label: 'A' } : {})} />}

      {/* Dropoff marker */}
      {dropoff && <Marker position={dropoff} {...(showMarkerLabels ? { label: 'B' } : {})} />}

      {/* Driver position marker — created imperatively with smooth animation above */}

      {/* Render directions if available */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true, // we already have our own markers
            preserveViewport: focusOnDriver || followDriver ? true : false,
            routeIndex: selectedRouteIndex,
          }}
        />
      )}

      {/* Pickup zone overlay polygons */}
      {zones && zones.length > 0 && <PickupZoneOverlay zones={zones} />}

      {/* Re-center button (follow-driver mode) — appears when user drags away */}
      {followDriver && showRecenter && (
        <div
          onClick={handleRecenter}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-12 h-12 rounded-full bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:shadow-xl transition-shadow active:scale-95"
          title="Re-center on driver"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700 dark:text-slate-300">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93" />
          </svg>
        </div>
      )}
    </GoogleMap>
  );
}