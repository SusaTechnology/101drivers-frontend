import { useEffect, useState, useRef, useCallback } from 'react'
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api'

interface MiniRouteMapProps {
  pickup: google.maps.LatLngLiteral
  dropoff: google.maps.LatLngLiteral
  isLoaded: boolean
}

/** Compact live map for gig cards.
 *
 *  Behaviour:
 *  1. Lazy-mounts via IntersectionObserver (200 px margin).
 *  2. Fetches DirectionsService route between pickup → dropoff.
 *  3. Draws green polyline via DirectionsRenderer (preserveViewport = true,
 *     we control bounds ourselves).
 *  4. Fits LatLngBounds to route legs (or markers on fallback).
 *  5. For short routes (< ~2 mi) bumps zoom after fitBounds so the map
 *     doesn't look too zoomed-out.
 *  6. Zero UI controls — pure preview tile.
 */
export default function MiniRouteMap({ pickup, dropoff, isLoaded }: MiniRouteMapProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [directionsFailed, setDirectionsFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasFetched = useRef(false)

  // ── 1. Lazy-mount: only render map when card scrolls into view ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ── 2. Fetch route polyline ──
  useEffect(() => {
    if (!isVisible || !isLoaded || hasFetched.current) return
    hasFetched.current = true

    const svc = new google.maps.DirectionsService()
    svc.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setDirections(result)
        } else {
          setDirectionsFailed(true)
        }
      },
    )
  }, [isVisible, isLoaded, pickup, dropoff])

  // ── 3. Fit bounds (always, both on route success and fallback) ──
  useEffect(() => {
    if (!map) return

    // Wait until we know whether directions succeeded or failed
    if (!directions && !directionsFailed) return

    const bounds = new google.maps.LatLngBounds()

    if (directions && directions.routes.length > 0) {
      // Extend bounds along every step of the route for a tight fit
      directions.routes[0].legs.forEach((leg) => {
        leg.steps.forEach((step) => {
          bounds.extend(step.start_location)
          bounds.extend(step.end_location)
        })
      })
    } else {
      // Fallback: just the two markers
      bounds.extend(pickup)
      bounds.extend(dropoff)
    }

    map.fitBounds(bounds, 32) // 32 px padding all around

    // ── 4. Short-route zoom bump ──
    // If pickup & dropoff are very close (< ~2 miles ≈ 0.03°), the auto
    // zoom from fitBounds can look too zoomed-out in a tiny 80 px card.
    // After fitBounds settles, nudge zoom to at least 14.
    const latDiff = Math.abs(pickup.lat - dropoff.lat)
    const lngDiff = Math.abs(pickup.lng - dropoff.lng)
    const isShortRoute = latDiff < 0.03 && lngDiff < 0.03

    if (isShortRoute) {
      google.maps.event.addListenerOnce(map, 'idle', () => {
        const z = map.getZoom()
        if (z != null && z < 14) map.setZoom(14)
      })
    }
  }, [map, directions, directionsFailed, pickup, dropoff])

  const handleMapLoad = useCallback((gMap: google.maps.Map) => setMap(gMap), [])

  // ── Initial center = midpoint (before directions load) ──
  const initialCenter = {
    lat: (pickup.lat + dropoff.lat) / 2,
    lng: (pickup.lng + dropoff.lng) / 2,
  }

  // ── Placeholder while not yet visible ──
  if (!isVisible || !isLoaded) {
    return (
      <div
        ref={containerRef}
        className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/60 shrink-0 flex items-center justify-center"
      >
        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse" />
      </div>
    )
  }

  // ── Live mini map ──
  return (
    <div
      ref={containerRef}
      className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-slate-200/70 dark:border-slate-700/50"
    >
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={initialCenter}
        zoom={12}
        onLoad={handleMapLoad}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: false,
          gestureHandling: 'none',
          disableDefaultUI: true,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        }}
      >
        {/* Pickup marker — green */}
        <Marker
          position={pickup}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9" fill="#22c55e" stroke="white" stroke-width="2.5"/></svg>',
              ),
            scaledSize: new google.maps.Size(16, 16),
            anchor: new google.maps.Point(8, 8),
          }}
        />

        {/* Dropoff marker — red */}
        <Marker
          position={dropoff}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9" fill="#ef4444" stroke="white" stroke-width="2.5"/></svg>',
              ),
            scaledSize: new google.maps.Size(16, 16),
            anchor: new google.maps.Point(8, 8),
          }}
        />

        {/* Route polyline via DirectionsRenderer */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true, // we draw our own
              preserveViewport: true, // we handle fitBounds ourselves
              polylineOptions: {
                strokeColor: '#22c55e',
                strokeWeight: 3,
                strokeOpacity: 0.9,
              },
            }}
          />
        )}
      </GoogleMap>
    </div>
  )
}
