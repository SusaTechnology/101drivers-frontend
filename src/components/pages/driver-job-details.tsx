// app/pages/driver/job-details.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Bolt,
  QrCode,
  Camera,
  Gauge as Speed,
  Route,
  Info,
  Sun,
  Moon,
  MapPin,
  MessageSquare,
  CalendarPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { BUSINESS_TZ } from '@/lib/timezone'
import { openCalendarEvent } from '@/lib/calendar-utils'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

// ── Formatters ──────────────────────────────────────────────────────

const formatDate = (isoString?: string): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TZ })
}

const formatTimeRange = (startIso?: string | null, endIso?: string | null): string => {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ })
  return `${startStr}\u2013${endStr}`
}

const formatDuration = (minutes?: number | null): string => {
  if (!minutes) return '\u2014'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const formatCurrency = (amount?: number | null): string => {
  if (amount == null) return '\u2014'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const getShortAddress = (address?: string): string => {
  if (!address) return ''
  const parts = address.split(',')
  return parts[0]
}

// Service type mapping
const serviceTypeLabels: Record<string, string> = {
  HOME_DELIVERY: 'Car Transfer',
  BETWEEN_LOCATIONS: 'Car Transfer',
  SERVICE_PICKUP_RETURN: 'Car Transfer',
}

// Static requirements
const pickupRequirements = [
  { icon: QrCode, label: 'VIN last-4' },
  { icon: Camera, label: '6 Pickup Photos' },
  { icon: Speed, label: 'Odometer Start' },
]
const dropoffRequirements = [
  { icon: Camera, label: '6 Drop-off Photos' },
  { icon: Speed, label: 'Odometer End' },
  { icon: Route, label: 'Tap Complete' },
]

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

  // Clean map styles
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

  // Fetch real job details
  const { data, isLoading, isError } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${user?.profileId}/${jobId}`,
    noFilter: true,
    enabled: Boolean(jobId && user?.profileId),
  })

  // Check if driver already has an ACTIVE delivery
  const { data: activeDeliveries } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/active-delivery/${user?.profileId}`,
    noFilter: true,
    enabled: Boolean(user?.profileId),
  })

  const hasActiveDelivery = Array.isArray(activeDeliveries) && activeDeliveries.some(
    (d: any) => d.delivery?.status === 'ACTIVE',
  )

  // Load Google Maps API
  const { isLoaded: isMapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Shared error handler for booking
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

  // Single booking mutation — context-aware destination
  const bookMutation = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${jobId}/book`, {
    invalidateQueryKey: [
      ["data", `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/active-delivery/${user?.profileId}`],
      ["data", `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${user?.profileId}`],
    ],
    onSuccess: () => {
      if (hasActiveDelivery) {
        toast.success('Accepted!', {
          description: 'You can find it in your Booked for Later queue.',
        })
        navigate({ to: '/driver/booked-later' })
      } else {
        toast.success('Accepted!', {
          description: 'Complete the pickup checklist to start your trip.',
        })
        navigate({ to: '/driver/pickup-checklist', search: { jobId } as any })
      }
    },
    onError: handleBookingError,
  })

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/driver-signin' })
  }

  const handleBook = () => {
    if (!user?.profileId || !user?.id) {
      toast.error('User not authenticated')
      return
    }
    bookMutation.mutate({
      driverId: user.profileId,
      bookedByUserId: user.id,
      reason: '',
    })
  }

  const handleReportIssue = () => {
    navigate({ to: '/driver/issue-report', state: { deliveryId: jobId } as any })
  }

  const [showCalendarDialog, setShowCalendarDialog] = useState(false)

  const handleConfirmCalendar = () => {
    try {
      openCalendarEvent({
        deliveryId: job.deliveryId,
        pickupAddress: job.pickupAddress,
        dropoffAddress: job.dropoffAddress,
        pickupWindowStart: job.pickupWindowStart,
        pickupWindowEnd: job.pickupWindowEnd,
        dropoffWindowEnd: job.dropoffWindowEnd,
        etaMinutes: job.etaMinutes,
        payoutPreviewAmount: job.payoutPreviewAmount,
        isUrgent: job.isUrgent,
        serviceType: job.serviceType,
      })
    } catch {
      toast.error('Cannot add to calendar', {
        description: 'This delivery has no scheduled pickup time.',
      })
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
        <header className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Delivery
                </div>
                <div className="text-sm font-extrabold">Loading...</div>
              </div>
            </div>
          </div>
        </header>
        {/* Map skeleton */}
        <div className="w-full h-[220px] bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-32">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">Loading job details...</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Error state
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
        <header className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/driver/dashboard"
                className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Delivery
                </div>
                <div className="text-sm font-extrabold">Error</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="w-10 h-10 rounded-2xl" onClick={toggleTheme}>
                {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button onClick={handleSignOut} variant="link" className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition p-0 h-auto">
                Sign Out
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-32">
          <Card className="border-red-200 dark:border-red-900 shadow-lg">
            <CardContent className="p-8 text-center">
              <p className="text-red-600 dark:text-red-400">Failed to load job details. Please try again.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Data is available
  const job = data

  // Compute display values
  const route = `${getShortAddress(job.pickupAddress)} \u2192 ${getShortAddress(job.dropoffAddress)}`
  const serviceLabel = serviceTypeLabels[job.serviceType] || job.serviceType
  const typeLabel = job.originSource === 'homeBase' ? 'Near home base' : 'Matched job'
  const urgent = job.isUrgent
  const bonus = job.urgentBonusAmount
  const payout = job.payoutPreviewAmount
  const miles = job.pickupDistanceMiles
  const windowDate = formatDate(job.pickupWindowStart)
  const windowTime = formatTimeRange(job.pickupWindowStart, job.pickupWindowEnd)
  const window = `${windowDate} \u2022 ${windowTime}`
  const driveTime = formatDuration(job.etaMinutes)

  const hasCoords =
    job.pickupLat != null &&
    job.pickupLng != null &&
    job.dropoffLat != null &&
    job.dropoffLng != null

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-dashboard"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Delivery
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {route}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            <Button
              onClick={handleSignOut}
              variant="link"
              className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition p-0 h-auto"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO MAP ── */}
      {hasCoords ? (
        <HeroRouteMap
          pickup={{ lat: job.pickupLat!, lng: job.pickupLng! }}
          dropoff={{ lat: job.dropoffLat!, lng: job.dropoffLng! }}
          isLoaded={isMapsLoaded}
        />
      ) : (
        <div className="w-full h-[220px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
      )}

      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-32">
        {/* Summary Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                {urgent && (
                  <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold">
                    <Bolt className="w-4 h-4 text-amber-500" />
                    Urgent
                  </Badge>
                )}

                <h1 className="mt-4 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {route}
                </h1>

                <p className="mt-2 text-xs text-slate-500">Status: {job.status === 'LISTED' ? 'Available' : job.status}</p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-3xl font-black text-primary">
                  {formatCurrency(payout)}
                </p>
                {bonus ? (
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Includes {formatCurrency(bonus)} bonus
                  </p>
                ) : (
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    No bonus
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Distance
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                  {miles ? `${miles} mi` : '\u2014'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Pickup Time
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                  {window}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Est. Drive Time
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                  {driveTime}
                </p>
              </div>
            </div>

            {/* Additional badges */}
            {(job.afterHours || job.matchScore != null) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {job.afterHours && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-300">
                    After Hours
                  </Badge>
                )}
                {job.matchScore != null && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-300">
                    Match Score: {job.matchScore}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pickup Requirements */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">Required at Pickup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {pickupRequirements.map((req, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <req.icon className="w-4 h-4 text-primary mr-1" />
                  {req.label}
                </Badge>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
              You cannot tap &quot;Start Delivery&quot; until all checklist items are completed.
            </p>
          </CardContent>
        </Card>

        {/* Drop-off Requirements */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">Required at Drop-off</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {dropoffRequirements.map((req, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <req.icon className="w-4 h-4 text-primary mr-1" />
                  {req.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Job Details Card */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Type</p>
                <p className="font-medium">{serviceLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                <p className="font-medium">{job.status}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match Score</p>
                <p className="font-medium">{job.matchScore ?? '\u2014'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match Reasons</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {job.matchReasons?.map((reason: string, i: number) => (
                    <Badge key={i} variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100">
                      {reason}
                    </Badge>
                  )) || '\u2014'}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distance (mi)</p>
                <p className="font-medium">{job.pickupDistanceMiles ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup ETA (min)</p>
                <p className="font-medium">{job.pickupEtaMinutes ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Origin Source</p>
                <p className="font-medium">{job.originSource}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">After Hours</p>
                <p className="font-medium">{job.afterHours ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created At</p>
                <p className="font-medium">{new Date(job.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Notes */}
        <Alert className="mt-6 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
            Important Policy
          </AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-sm mt-1">
            No cancellation from Driver UI. If an issue occurs, report it through Support. All actions are logged for audit purposes.
          </AlertDescription>
        </Alert>
      </main>

      {/* Bottom Action Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Report issue */}
            <Button
              onClick={handleReportIssue}
              variant="outline"
              className="shrink-0 w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition p-0 flex items-center justify-center"
            >
              <MessageSquare className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </Button>

            {/* Add to Calendar — only when pickup time exists */}
            {job.pickupWindowStart && (
              <Button
                onClick={() => setShowCalendarDialog(true)}
                variant="outline"
                className="shrink-0 w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition p-0 flex items-center justify-center"
                aria-label="Add to calendar"
              >
                <CalendarPlus className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </Button>
            )}

            {/* Calendar confirmation dialog */}
            <AlertDialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Add to Calendar</AlertDialogTitle>
                  <AlertDialogDescription>
                    {job.pickupWindowStart
                      ? `Add this delivery (${window}) to your calendar? You’ll be redirected to your calendar app to confirm.`
                      : 'This delivery has no scheduled pickup time.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmCalendar}
                    disabled={!job.pickupWindowStart}
                    className="bg-[#34C759] hover:bg-[#2db84e] text-white font-extrabold"
                  >
                    Add to Calendar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Context-aware booking button */}
            <Button
              onClick={handleBook}
              disabled={bookMutation.isPending}
              className="flex-1 px-6 py-4 rounded-2xl font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#34C759] hover:bg-[#2db84e] text-white"
            >
              {bookMutation.isPending
                ? 'Accepting\u2026'
                : 'Accept'}
            </Button>
          </div>
        </div>
      </nav>
    </div>
  )
}
