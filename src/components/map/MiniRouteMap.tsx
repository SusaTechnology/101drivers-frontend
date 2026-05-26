import { useEffect, useState, useRef, useCallback } from 'react'
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api'

interface MiniRouteMapProps {
  pickup: google.maps.LatLngLiteral
  dropoff: google.maps.LatLngLiteral
  isLoaded: boolean
}

/** Compact live route map for gig cards.
 *
 * Visual priorities:
 *  1. Green route polyline — the star of the show
 *  2. Pickup / dropoff markers — subtle, not dominant
 *  3. Clean map surface — minimal labels, no clutter
 *  4. Tight bounds — route fills the card edge-to-edge
 *
 * Performance:
 *  - Lazy-mounts via IntersectionObserver (200 px margin)
 *  - Directions fetched once per mount
 *  - No gesture handling, no controls
 */
export default function MiniRouteMap({ pickup, dropoff, isLoaded }: MiniRouteMapProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [directionsFailed, setDirectionsFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasFetched = useRef(false)

  // ── 1. Lazy-mount ──
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

  // ── 2. Fetch route ──
  useEffect(() => {
    if (!isVisible || !isLoaded || hasFetched.current) return
    hasFetched.current = true

    const svc = new google.maps.DirectionsService()
    svc.route(
      { origin: pickup, destination: dropoff, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) setDirections(result)
        else setDirectionsFailed(true)
      },
    )
  }, [isVisible, isLoaded, pickup, dropoff])

  // ── 3. Fit bounds tightly around the route ──
  useEffect(() => {
    if (!map) return
    if (!directions && !directionsFailed) return

    const bounds = new google.maps.LatLngBounds()

    if (directions && directions.routes.length > 0) {
      directions.routes[0].legs.forEach((leg) => {
        leg.steps.forEach((step) => {
          bounds.extend(step.start_location)
          bounds.extend(step.end_location)
        })
      })
    } else {
      bounds.extend(pickup)
      bounds.extend(dropoff)
    }

    // Tight padding — route should fill the card
    map.fitBounds(bounds, 20)

    // Short-route zoom bump: keep it legible
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

  const initialCenter = {
    lat: (pickup.lat + dropoff.lat) / 2,
    lng: (pickup.lng + dropoff.lng) / 2,
  }

  // Map styles: strip everything except roads — route is the focus
  const cleanStyles: google.maps.MapTypeStyle[] = [
    { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', elementType: 'all', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'all', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit.station', elementType: 'all', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'landscape', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ]

  // ── Placeholder ──
  if (!isVisible || !isLoaded) {
    return (
      <div
        ref={containerRef}
        className="w-[100px] h-[100px] rounded-2xl bg-slate-100 dark:bg-slate-800/60 shrink-0 flex items-center justify-center"
      >
        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse" />
      </div>
    )
  }

  // ── Live mini map ──
  return (
    <div
      ref={containerRef}
      className="w-[100px] h-[100px] rounded-2xl overflow-hidden shrink-0 border border-slate-200/70 dark:border-slate-700/50"
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
          styles: cleanStyles,
        }}
      >
        {/* Pickup — small green dot */}
        <Marker
          position={pickup}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="6" fill="#22c55e" stroke="white" stroke-width="2"/></svg>',
              ),
            scaledSize: new google.maps.Size(12, 12),
            anchor: new google.maps.Point(6, 6),
          }}
        />

        {/* Dropoff — small red dot */}
        <Marker
          position={dropoff}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="6" fill="#ef4444" stroke="white" stroke-width="2"/></svg>',
              ),
            scaledSize: new google.maps.Size(12, 12),
            anchor: new google.maps.Point(6, 6),
          }}
        />

        {/* Route polyline — the main visual */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              preserveViewport: true,
              polylineOptions: {
                strokeColor: '#16a34a',     // strong green-600
                strokeWeight: 5,             // thick — dominant over markers
                strokeOpacity: 1,
                icons: undefined,            // no dashed pattern
              },
            }}
          />
        )}
      </GoogleMap>
    </div>
  )
}
