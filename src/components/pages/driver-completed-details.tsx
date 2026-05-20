import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Sun,
  Moon,
  MapPin,
  ExternalLink,
  Clock,
  Package,
  CheckCircle,
  Calendar,
  DollarSign,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'
import {
  useJsApiLoader,
  GoogleMap,
  Marker,
  DirectionsRenderer,
} from '@react-google-maps/api'
import {
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from '@/lib/google-maps-config'
import { BUSINESS_TZ } from '@/lib/timezone'
import DriverBottomNav from '@/components/layout/DriverBottomNav'

// ── Formatters ──────────────────────────────────────────────────────

const formatShortDayMonth = (isoString?: string | null): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })
}

const formatDateTimeWindow = (startIso?: string | null, endIso?: string | null): string => {
  if (!startIso || !endIso) return ''
  const date = new Date(startIso)
  const start = new Date(startIso)
  const end = new Date(endIso)
  const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: BUSINESS_TZ })
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })
  return `${dayStr} \u2022 ${startStr} \u2013 ${endStr}`
}

const formatTime = (isoString?: string | null): string => {
  if (!isoString) return '--'
  return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })
}

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })
}

const formatCurrency = (amount?: number | null): string => {
  if (amount == null) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const extractRouteLabel = (fullAddress: string): string => {
  if (!fullAddress) return ''
  const trimmed = fullAddress.trim()
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i]
      if (/^\d+$/.test(seg)) continue
      if (/^[A-Z]{2}$/.test(seg)) continue
      if (/^(USA|United States)$/i.test(seg)) continue
      if (/^\d/.test(seg)) continue
      const clean = seg.replace(/\s+\d{5}(-\d{4})?$/, '').trim()
      if (clean.length >= 3) return clean
    }
    const street = parts[0].replace(/^\d+\s+/, '').replace(/\s+(Blvd|Ave|Avenue|Street|St|Drive|Dr|Road|Rd|Lane|Ln|Way|Ct|Court|Pl|Place|Pkwy|Parkway)$/i, '').trim()
    if (street.length >= 3) return street
  }
  const match = trimmed.match(/^\d+\s+(.+)$/)
  return match ? match[1].trim() : trimmed
}

// ── Hero Route Map ──────────────────────────────────────────────────

function HeroRouteMap({
  pickup,
  dropoff,
  isLoaded,
}: {
  pickup: { lat: number; lng: number }
  dropoff: { lat: number; lng: number }
  isLoaded: boolean
}) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [directionsFailed, setDirectionsFailed] = useState(false)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!isLoaded || hasFetched.current) return
    hasFetched.current = true

    const svc = new google.maps.DirectionsService()
    svc.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) setDirections(result)
        else setDirectionsFailed(true)
      },
    )
  }, [isLoaded, pickup, dropoff])

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
    map.fitBounds(bounds, 48)
  }, [map, directions, directionsFailed, pickup, dropoff])

  const handleMapLoad = useCallback((gMap: google.maps.Map) => setMap(gMap), [])

  const initialCenter = {
    lat: (pickup.lat + dropoff.lat) / 2,
    lng: (pickup.lng + dropoff.lng) / 2,
  }

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

  if (!isLoaded) {
    return (
      <div className="w-full h-[220px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="w-full h-[220px] bg-slate-100 dark:bg-slate-800">
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
          gestureHandling: 'greedy',
          disableDefaultUI: false,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
          styles: cleanStyles,
        }}
      >
        <Marker
          position={pickup}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="40"><path d="M16 2C10.48 2 6 6.48 6 12c0 7.5 10 18 10 18s10-10.5 10-18C26 6.48 21.52 2 16 2z" fill="#16a34a"/><circle cx="16" cy="12" r="5" fill="white"/></svg>',
              ),
            scaledSize: new google.maps.Size(28, 40),
            anchor: new google.maps.Point(14, 40),
          }}
        />
        <Marker
          position={dropoff}
          icon={{
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="40"><path d="M16 2C10.48 2 6 6.48 6 12c0 7.5 10 18 10 18s10-10.5 10-18C26 6.48 21.52 2 16 2z" fill="#dc2626"/><circle cx="16" cy="12" r="5" fill="white"/></svg>',
              ),
            scaledSize: new google.maps.Size(28, 40),
            anchor: new google.maps.Point(14, 40),
          }}
        />
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              preserveViewport: true,
              polylineOptions: {
                strokeColor: '#16a34a',
                strokeWeight: 5,
                strokeOpacity: 1,
              },
            }}
          />
        )}
      </GoogleMap>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────

export default function DriverCompletedDetailsPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { jobId } = useSearch({ strict: false }) as { jobId: string }

  // Fetch delivery details using the generic endpoint (works for any status)
  const { data: gig, isLoading, isError, refetch } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${jobId}`,
    noFilter: true,
    enabled: Boolean(jobId),
  })

  // Load Google Maps API
  const { isLoaded: isMapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Derived display values
  const pickupLabel = extractRouteLabel(gig?.pickupAddress || '')
  const dropoffLabel = extractRouteLabel(gig?.dropoffAddress || '')
  const hasCoords =
    gig?.pickupLat != null &&
    gig?.pickupLng != null &&
    gig?.dropoffLat != null &&
    gig?.dropoffLng != null

  // ── Loading skeleton ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 font-sans antialiased">
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
          <div className="h-14 flex items-center px-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="ml-3 h-4 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
        <div className="w-full h-[220px] bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="px-5 py-6 space-y-5">
          <div className="h-7 w-3/4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────
  if (isError || !gig) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 font-sans antialiased">
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
          <div className="h-14 flex items-center px-4">
            <Link
              to="/driver/completed"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </div>
        <div className="px-5 py-16 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-lg font-bold text-slate-900 dark:text-white">Delivery not found</p>
          <p className="mt-1 text-sm text-slate-500">This delivery may have been removed.</p>
          <Link to="/driver/completed">
            <Button className="mt-6 rounded-2xl px-6 font-bold">Back to Completed</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Main content ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans antialiased pb-24">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              to="/driver/completed"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </Link>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Delivery Details
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
                {pickupLabel} &rarr; {dropoffLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-xl"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* ── 1. HERO MAP ── */}
      {hasCoords ? (
        <HeroRouteMap
          pickup={{ lat: gig.pickupLat!, lng: gig.pickupLng! }}
          dropoff={{ lat: gig.dropoffLat!, lng: gig.dropoffLng! }}
          isLoaded={isMapsLoaded}
        />
      ) : (
        <div className="w-full h-[220px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
      )}

      {/* ── 2. STATUS BADGE + Route ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[11px] font-bold border-0 rounded-lg">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
          {gig.isUrgent && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[11px] font-bold border-0 rounded-lg">
              Urgent
            </Badge>
          )}
          {gig.afterHours && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[11px] font-bold border-0 rounded-lg">
              After Hours
            </Badge>
          )}
        </div>

        <h1 className="text-[22px] sm:text-[26px] font-black text-slate-900 dark:text-white leading-tight tracking-tight">
          {pickupLabel}{' '}
          <span className="text-slate-300 dark:text-slate-600 mx-1">&rarr;</span>{' '}
          {dropoffLabel}
        </h1>
      </div>

      {/* ── 3. DELIVERY SUMMARY ── */}
      <div className="mx-5 space-y-3">
        {/* Pickup time window */}
        <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 dark:text-slate-200">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Pickup: {formatDateTimeWindow(gig.pickupWindowStart, gig.pickupWindowEnd)}</span>
        </div>
        {/* Dropoff time window */}
        {gig.dropoffWindowStart && gig.dropoffWindowEnd && (
          <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 dark:text-slate-200">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Drop-off: {formatDateTimeWindow(gig.dropoffWindowStart, gig.dropoffWindowEnd)}</span>
          </div>
        )}
        {/* Completed date */}
        {gig.updatedAt && (
          <div className="flex items-center gap-2 text-[14px] font-medium text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Completed: {formatDate(gig.updatedAt)} at {formatTime(gig.updatedAt)}</span>
          </div>
        )}
        {/* Assigned date */}
        {gig.assignedAt && (
          <div className="flex items-center gap-2 text-[14px] font-medium text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Assigned: {formatDate(gig.assignedAt)} at {formatTime(gig.assignedAt)}</span>
          </div>
        )}
        {/* ETA */}
        {gig.etaMinutes != null && (
          <div className="flex items-center gap-2 text-[14px] font-medium text-slate-500 dark:text-slate-400">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Est. drive time: {gig.etaMinutes >= 60 ? `${Math.floor(gig.etaMinutes / 60)}h ${gig.etaMinutes % 60}m` : `${gig.etaMinutes}m`}</span>
          </div>
        )}
      </div>

      {/* ── 4. VEHICLE INFO ── */}
      <div className="px-5 mt-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          Vehicle
        </h2>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Package className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <div>
            <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">
              {gig.vehicleMake && gig.vehicleModel
                ? `${gig.vehicleMake} ${gig.vehicleModel}`
                : gig.vehicleMake || gig.vehicleModel || '--'}
            </p>
            {gig.vehicleColor && (
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                {gig.vehicleColor}{gig.licensePlate ? ` \u2022 ${gig.licensePlate}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 5. LOCATION DETAILS ── */}
      <div className="px-5 mt-6 space-y-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          Locations
        </h2>

        {/* Pickup */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-100 dark:ring-green-900/40" />
            <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />
          </div>
          <div className="flex-1 pb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
              Pickup
            </p>
            <p className="text-[14px] font-semibold text-slate-900 dark:text-white mt-1 leading-snug">
              {gig.pickupAddress || '\u2014'}
            </p>
            {gig.pickupState && (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{gig.pickupState}</p>
            )}
            {gig.pickupLat && gig.pickupLng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${gig.pickupLat},${gig.pickupLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-medium text-green-600 dark:text-green-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Maps
              </a>
            )}
          </div>
        </div>

        {/* Dropoff */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-100 dark:ring-red-900/40" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
              Dropoff
            </p>
            <p className="text-[14px] font-semibold text-slate-900 dark:text-white mt-1 leading-snug">
              {gig.dropoffAddress || '\u2014'}
            </p>
            {gig.dropoffState && (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{gig.dropoffState}</p>
            )}
            {gig.dropoffLat && gig.dropoffLng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${gig.dropoffLat},${gig.dropoffLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-medium text-green-600 dark:text-green-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Maps
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── 6. RECIPIENT INFO ── */}
      {(gig.recipientName || gig.recipientPhone || gig.recipientEmail) && (
        <div className="px-5 mt-6">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
            Recipient
          </h2>
          <div className="space-y-1.5">
            {gig.recipientName && (
              <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">{gig.recipientName}</p>
            )}
            {gig.recipientPhone && (
              <a href={`tel:${gig.recipientPhone}`} className="block text-[13px] text-green-600 dark:text-green-400 hover:underline">
                {gig.recipientPhone}
              </a>
            )}
            {gig.recipientEmail && (
              <a href={`mailto:${gig.recipientEmail}`} className="block text-[13px] text-green-600 dark:text-green-400 hover:underline">
                {gig.recipientEmail}
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── 7. PAYOUT INFO ── */}
      <div className="px-5 mt-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          Earnings
        </h2>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
          <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-[24px] font-black text-emerald-600 dark:text-emerald-400 leading-none">
              {gig.payout?.netAmount != null
                ? formatCurrency(gig.payout.netAmount)
                : gig.quote?.estimatedPrice != null
                  ? formatCurrency(gig.quote.estimatedPrice)
                  : '--'}
            </p>
            <p className="text-[12px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
              {gig.payout?.netAmount != null ? 'Net payout' : 'Estimated price'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <DriverBottomNav activeTab="completed" />
    </div>
  )
}
