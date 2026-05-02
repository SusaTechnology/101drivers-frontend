// app/pages/driver/job-details.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUser, useCreate, useDataQuery } from '@/lib/tanstack/dataQuery'
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

// ── Formatters ──────────────────────────────────────────────────────

const formatShortDayMonth = (isoString?: string | null): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const formatDateTimeWindow = (startIso?: string | null, endIso?: string | null): string => {
  if (!startIso || !endIso) return ''
  const date = new Date(startIso)
  const start = new Date(startIso)
  const end = new Date(endIso)
  const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${dayStr} \u2022 ${startStr} \u2013 ${endStr}`
}

const formatTimeRange = (startIso?: string | null, endIso?: string | null): string => {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${startStr} \u2013 ${endStr}`
}

const formatDuration = (minutes?: number | null): string => {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const formatCurrency = (amount?: number | null): string => {
  if (amount == null) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Extract short human-readable label from a full address.
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

  // Fetch route
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

  // Fit bounds tightly
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

  // Clean map styles — focus on route
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
        {/* Pickup marker — green */}
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

        {/* Dropoff marker — red */}
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

        {/* Route polyline */}
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

export default function DriverJobDetailsPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const { jobId } = useSearch({ strict: false }) as { jobId: string }

  // Fetch real gig details
  const { data: gig, isLoading, isError } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${user?.profileId}/${jobId}`,
    noFilter: true,
    enabled: Boolean(jobId && user?.profileId),
  })

  // Load Google Maps API
  const { isLoaded: isMapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Shared error handler for booking mutations
  const handleBookingError = (error: any) => {
    const status = error?.status || error?.statusCode
    const msg = error?.message || ''

    if (status === 410 || msg?.includes('no longer available') || msg?.includes('already been booked')) {
      toast.error('This gig is no longer available', {
        description: 'Another driver may have already accepted it.',
      })
    } else if (status === 403 || msg?.includes('not approved')) {
      toast.error('Account not approved', {
        description: 'Your driver account must be approved before booking gigs.',
      })
    } else {
      toast.error('Failed to book gig', {
        description: msg || 'Something went wrong. Please try again.',
      })
    }
  }

  // Accept Gig mutation — books the gig then navigates to pickup checklist
  const acceptGigMutation = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${jobId}/book`, {
    onSuccess: () => {
      toast.success('Gig accepted!', {
        description: 'Complete the pickup checklist to start your trip.',
      })
      navigate({ to: '/driver-pickup-checklist', search: { jobId } as any })
    },
    onError: handleBookingError,
  })

  // Book for Later mutation — books the gig and navigates to booked-for-later page
  const bookForLaterMutation = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${jobId}/book`, {
    onSuccess: () => {
      toast.success('Booked for later!', {
        description: 'You can find it in your Booked for Later queue.',
      })
      navigate({ to: '/driver-booked-later' })
    },
    onError: handleBookingError,
  })

  const isBooking = acceptGigMutation.isPending || bookForLaterMutation.isPending

  useEffect(() => {
    setMounted(true)
  }, [])

  // Accept Gig — book the gig then navigate to pickup checklist
  const handleAcceptGig = () => {
    if (!user?.profileId || !user?.id) {
      toast.error('User not authenticated')
      return
    }
    acceptGigMutation.mutate({
      driverId: user.profileId,
      bookedByUserId: user.id,
      reason: '',
    })
  }

  // Book for Later — book the gig and navigate to booked-for-later page
  const handleBookForLater = () => {
    if (!user?.profileId || !user?.id) {
      toast.error('User not authenticated')
      return
    }
    bookForLaterMutation.mutate({
      driverId: user.profileId,
      bookedByUserId: user.id,
      reason: '',
    })
  }

  const handleDecline = () => {
    navigate({ to: '/driver-dashboard' })
  }

  const handleReportIssue = () => {
    navigate({ to: '/driver-issue-report', state: { deliveryId: jobId } as any })
  }

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
        {/* Header skeleton */}
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
          <div className="h-14 flex items-center px-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="ml-3 h-4 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
        {/* Map skeleton */}
        <div className="w-full h-[220px] bg-slate-100 dark:bg-slate-800 animate-pulse" />
        {/* Content skeleton */}
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
              to="/driver-dashboard"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </div>
        <div className="px-5 py-16 text-center">
          <p className="text-lg font-bold text-slate-900 dark:text-white">Gig not found</p>
          <p className="mt-1 text-sm text-slate-500">This gig may no longer be available.</p>
          <Link to="/driver-dashboard">
            <Button className="mt-6 rounded-2xl px-6 font-bold">Back to Dashboard</Button>
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
              to="/driver-dashboard"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </Link>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Gig Details
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

      {/* ── 2. PRIMARY INFO: Route + Payout ── */}
      <div className="px-5 pt-5 pb-4">
        {/* Urgent badge */}
        {gig.isUrgent && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Urgent
            </span>
          </div>
        )}

        {/* Route — BIG, BOLD */}
        <h1 className="text-[22px] sm:text-[26px] font-black text-slate-900 dark:text-white leading-tight tracking-tight">
          {pickupLabel}{' '}
          <span className="text-slate-300 dark:text-slate-600 mx-1">&rarr;</span>{' '}
          {dropoffLabel}
        </h1>

        {/* Payout — VERY PROMINENT, GREEN */}
        {gig.payoutPreviewAmount != null && (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[36px] sm:text-[42px] font-black text-green-600 dark:text-green-400 leading-none tracking-tight">
              {formatCurrency(gig.payoutPreviewAmount)}
            </span>
            {gig.urgentBonusAmount != null && gig.urgentBonusAmount > 0 && (
              <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">
                incl. {formatCurrency(gig.urgentBonusAmount)} bonus
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 3. JOB SUMMARY — Stacked, not grid ── */}
      <div className="mx-5 space-y-2">
        {/* Pickup time window */}
        <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
          Pickup: {formatDateTimeWindow(gig.pickupWindowStart, gig.pickupWindowEnd)}
        </p>
        {/* Dropoff time window */}
        {gig.dropoffWindowStart && gig.dropoffWindowEnd && (
          <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
            Drop-off: {formatDateTimeWindow(gig.dropoffWindowStart, gig.dropoffWindowEnd)}
          </p>
        )}
        {/* Distance + ETA — single stacked line */}
        <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
          {[gig.pickupDistanceMiles != null ? `${gig.pickupDistanceMiles} mi` : null, formatDuration(gig.etaMinutes) ? `Est. ${formatDuration(gig.etaMinutes)}` : null].filter(Boolean).join(' \u2013 ')}
        </p>
      </div>

      {/* ── 4. LOCATION DETAILS ── */}
      <div className="px-5 mt-5 space-y-4">
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

      {/* ── 5. STICKY BOTTOM CTA ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-3">
          {/* Report issue (text only) */}
          <button
            onClick={handleReportIssue}
            className="shrink-0 w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
          >
            <MessageSquare className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>

          {/* Accept Gig — book then navigate to pickup checklist */}
          <Button
            onClick={handleAcceptGig}
            disabled={isBooking}
            className="flex-1 h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-extrabold text-[14px] tracking-tight transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
          >
            {isBooking ? 'Booking\u2026' : 'Accept Gig'}
          </Button>

          {/* Book for Later — book and navigate to queue */}
          <Button
            onClick={handleBookForLater}
            disabled={isBooking}
            className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-extrabold text-[14px] tracking-tight transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {isBooking ? 'Booking\u2026' : 'Book for Later'}
          </Button>
        </div>
      </nav>
    </div>
  )
}
