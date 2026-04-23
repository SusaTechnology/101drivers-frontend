import { useEffect, useState, useRef, useCallback } from 'react'
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api'

interface MiniRouteMapProps {
  pickup: google.maps.LatLngLiteral
  dropoff: google.maps.LatLngLiteral
  isLoaded: boolean
}

/** Compact map component optimized for rendering inside list cards.
 *  - No controls (zoom, fullscreen, street view all disabled)
 *  - Auto-fits bounds to show pickup + dropoff
 *  - Fetches driving directions for the route polyline
 *  - Falls back to markers-only if directions fail
 */
export default function MiniRouteMap({ pickup, dropoff, isLoaded }: MiniRouteMapProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Intersection Observer: only mount map when card is visible ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect() // only need to trigger once
        }
      },
      { rootMargin: '200px' } // start loading slightly before entering viewport
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ── Fetch directions when map is visible and loaded ──
  const fetchDirections = useCallback(() => {
    if (!isLoaded || !pickup || !dropoff) return
    const service = new google.maps.DirectionsService()
    service.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setDirections(result)
        } else {
          setDirections(null)
        }
      }
    )
  }, [isLoaded, pickup, dropoff])

  // Fetch on first visibility
  useEffect(() => {
    if (isVisible && isLoaded) {
      fetchDirections()
    }
  }, [isVisible, isLoaded, fetchDirections])

  // ── Auto-fit bounds when map is ready (and no directions to auto-fit) ──
  useEffect(() => {
    if (!map || directions) return // DirectionsRenderer handles viewport

    const bounds = new google.maps.LatLngBounds()
    bounds.extend(pickup)
    bounds.extend(dropoff)
    map.fitBounds(bounds, { top: 16, right: 16, bottom: 16, left: 16 })
  }, [map, directions, pickup, dropoff])

  const handleMapLoad = useCallback((gMap: google.maps.Map) => {
    setMap(gMap)
  }, [])

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
        center={pickup}
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
        <Marker
          position={pickup}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="7" fill="#22c55e" stroke="white" stroke-width="2"/></svg>'
              ),
            scaledSize: new google.maps.Size(14, 14),
            anchor: new google.maps.Point(7, 7),
          }}
        />
        <Marker
          position={dropoff}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="7" fill="#ef4444" stroke="white" stroke-width="2"/></svg>'
              ),
            scaledSize: new google.maps.Size(14, 14),
            anchor: new google.maps.Point(7, 7),
          }}
        />
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
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
