// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import RouteMap from '@/components/map/RouteMap'
import {
  Truck,
  MapPin,
  Clock,
  Navigation,
  Map,
  AlertCircle,
  User,
  Phone,
  MessageCircle,
  Flag,
  Target,
  Loader2,
  RefreshCw,
  Car,
  Maximize2,
  Minimize2,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import { BUSINESS_TZ } from '@/lib/timezone'
import { toast } from 'sonner'
import { useSocketEvent, useSocketConnected } from '@/hooks/useSocket'
import { socketJoinPublic, socketLeavePublic, socketConnect, socketDisconnect } from '@/lib/socket'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WhatsAppSupportButton } from '@/components/shared/WhatsAppSupportButton'

const formatTime = (dateString?: string) => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })
}

const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; className: string }> = {
    BOOKED: { label: 'Booked', className: 'bg-amber-50 text-amber-900 border-amber-200' },
    ACTIVE: { label: 'In Transit', className: 'bg-blue-50 text-blue-900 border-blue-200' },
    COMPLETED: { label: 'Completed', className: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
    CANCELLED: { label: 'Cancelled', className: 'bg-red-50 text-red-900 border-red-200' },
    CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700' },
    DISPUTED: { label: 'Under review', className: 'bg-purple-50 text-purple-900 border-purple-200' },
  }
  const c = cfg[status] ?? { label: status, className: '' }
  return (
    <Badge variant="outline" className={cn("gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest border", c.className)}>
      <Navigation className="h-3 w-3" />
      {c.label}
    </Badge>
  )
}

// ── Task 32: trip-ended explanations ──
// The public endpoint rejects non-ACTIVE deliveries with a 409 whose message
// carries the status, e.g. "Tracking is not available for this delivery
// (status: COMPLETED)". Map each possible ending to a human explanation
// instead of showing a bare error. ACTIVE can leave to COMPLETED, CANCELLED,
// CLOSED, or DISPUTED (see allowedTransitions); pre-trip statuses mean the
// trip simply hasn't started yet.
type TripEndedKind = 'completed' | 'cancelled' | 'closed' | 'disputed' | 'notstarted'

const TRIP_ENDED_COPY: Record<TripEndedKind, { title: string; description: string }> = {
  completed: {
    title: 'Delivery completed',
    description: 'This delivery has been completed successfully. Live tracking has closed — thanks for following along!',
  },
  cancelled: {
    title: 'Delivery cancelled',
    description: 'This delivery was cancelled, so live tracking has closed. If something looks wrong, chat with us on WhatsApp and our team will help.',
  },
  closed: {
    title: 'Delivery closed',
    description: 'This delivery was closed without completing the live trip, so tracking has closed. Chat with us on WhatsApp if you have questions.',
  },
  disputed: {
    title: 'Delivery under review',
    description: 'This delivery is being reviewed by our team, so live tracking is paused. Chat with us on WhatsApp for the latest updates.',
  },
  notstarted: {
    title: 'Tracking not live yet',
    description: 'This delivery is not on the road yet. Tracking goes live automatically the moment the driver starts the trip — keep this page open or come back later.',
  },
}

const parseTripEnded = (message?: string | null): TripEndedKind | null => {
  if (!message) return null
  if (message.includes('COMPLETED')) return 'completed'
  if (message.includes('CANCELLED')) return 'cancelled'
  if (message.includes('CLOSED')) return 'closed'
  if (message.includes('DISPUTED')) return 'disputed'
  if (message.includes('not available')) return 'notstarted'
  return null
}

interface PublicTrackPageProps {
  token: string
}

export default function PublicTrackPage({ token }: PublicTrackPageProps) {
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [driverPosition, setDriverPosition] = useState<google.maps.LatLngLiteral | null>(null)
  const [routePoints, setRoutePoints] = useState<google.maps.LatLngLiteral[]>([])
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const socketConnected = useSocketConnected()

  // Track when socket last pushed a position — prevents poll overwrite.
  const lastSocketUpdateRef = useRef<number>(0)

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Fetch public tracking data using token — no auth required
  const {
    data: trackingData,
    isLoading,
    isError,
    error: errorObj,
    refetch: refetchTracking,
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/public/tracking/${token}`,
    enabled: !!token,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    refetchInterval: 60000, // SOCKET.IO: slowed from 5s to 60s as fallback
  })

  // Update coordinates when tracking data arrives.
  // Only apply driverPosition from DB poll if socket hasn't pushed recently.
  const SOCKET_FRESHNESS_MS = 60_000 // 60s — public page has 60s poll interval
  useEffect(() => {
    if (trackingData?.pickup) {
      setPickupCoords({ lat: trackingData.pickup.lat, lng: trackingData.pickup.lng })
    }
    if (trackingData?.dropoff) {
      setDropoffCoords({ lat: trackingData.dropoff.lat, lng: trackingData.dropoff.lng })
    }
    const socketIsFresh = Date.now() - lastSocketUpdateRef.current < SOCKET_FRESHNESS_MS
    if (trackingData?.trackingSession?.latestPoint && !socketIsFresh) {
      const point = trackingData.trackingSession.latestPoint
      setDriverPosition({ lat: point.lat, lng: point.lng })
    } else if (!socketIsFresh) {
      setDriverPosition(null)
    }
  }, [trackingData])

  // ── SOCKET.IO: Connect (unauthenticated) and join public tracking room ──
  useEffect(() => {
    if (!token) return
    // Public tracking link — visitor may not be logged in, so connect without auth
    socketConnect(null)
    socketJoinPublic(token)
    return () => {
      socketLeavePublic(token)
      // Don't disconnect here — other pages might be using the socket
    }
  }, [token])

  // ── SOCKET.IO: Listen for real-time location updates ──
  const handleLocationUpdate = useCallback((data: any) => {
    lastSocketUpdateRef.current = Date.now()
    setDriverPosition({ lat: data.lat, lng: data.lng })
    setRoutePoints(prev => {
      const last = prev[prev.length - 1]
      if (last) {
        const dLat = data.lat - last.lat
        const dLng = data.lng - last.lng
        const distM = Math.sqrt(dLat * dLat + dLng * dLng) * 111000
        if (distM < 10) return prev
      }
      return [...prev, { lat: data.lat, lng: data.lng }]
    })
  }, [])
  useSocketEvent('delivery:location-update', handleLocationUpdate)

  // Handle token expiration — the backend is the single source of truth.
  // An ACTIVE trip never expires mid-trip (the lifecycle service slides the
  // 24h window forward on read), so a freshly served payload with an old
  // timestamp is still valid data. Only react when the backend itself says
  // the link is expired — a client-side clock comparison against served
  // data used to toast "expired" on a perfectly working live trip.
  useEffect(() => {
    if (errorObj?.message?.includes('expired')) {
      toast.error('Tracking link expired', { description: 'Please request a new tracking link from 101 Drivers.' })
    }
  }, [errorObj])

  // Task 32: trip-ended dialog. When the tracking poll is rejected because
  // the delivery left ACTIVE (completed, cancelled, closed, disputed, or
  // not started yet), explain it in a dialog instead of dumping the visitor
  // on a bare error card. Closing the dialog keeps whatever the page had —
  // the last known map (if the visitor was watching live) or the error
  // card. The effect keys on the kind so a poll that keeps failing with the
  // SAME status does not re-open the dialog after the visitor closes it.
  const endedKind = parseTripEnded(errorObj?.message)
  const [endedDialogOpen, setEndedDialogOpen] = useState(false)
  useEffect(() => {
    if (endedKind) setEndedDialogOpen(true)
  }, [endedKind])

  // The dialog is rendered in BOTH return paths — the fresh-visit error
  // card AND the full page — so a recipient who opens an old link after the
  // trip ended still gets the explanation dialog, not just a bare error.
  const tripEndedDialog = (
    <Dialog open={endedDialogOpen && !!endedKind} onOpenChange={setEndedDialogOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <AlertCircle className="h-6 w-6 text-slate-500" />
          </div>
          <DialogTitle className="text-center">
            {endedKind ? TRIP_ENDED_COPY[endedKind].title : ''}
          </DialogTitle>
          <DialogDescription className="text-center">
            {endedKind ? TRIP_ENDED_COPY[endedKind].description : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-1 flex flex-col gap-2">
          <WhatsAppSupportButton
            label="Chat with us on WhatsApp"
            className="w-full [&>button]:w-full"
          />
          <Button
            variant="outline"
            onClick={() => setEndedDialogOpen(false)}
            className="w-full rounded-2xl font-bold"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  // Check if tracking data is stale (no update for > 2 min)
  const isDataStale = (() => {
    if (!trackingData?.trackingSession?.latestPoint?.recordedAt) return false
    const lastUpdate = new Date(trackingData.trackingSession.latestPoint.recordedAt).getTime()
    return (Date.now() - lastUpdate) > 2 * 60 * 1000
  })()

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true)
    try {
      await refetchTracking()
      toast.success('Location updated')
    } catch {
      toast.error('Failed to refresh location')
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500)
    }
  }

  const getLastUpdateText = () => {
    const recordedAt = trackingData?.trackingSession?.latestPoint?.recordedAt
    if (!recordedAt) return 'No data yet'
    const diffSeconds = Math.floor((Date.now() - new Date(recordedAt).getTime()) / 1000)
    if (diffSeconds < 60) return 'Just now'
    if (diffSeconds < 120) return '1 min ago'
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`
    return formatTime(recordedAt)
  }

  // ── Loading state ──
  if (isLoading || !trackingData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg border border-slate-200 mx-auto mb-6">
            <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
          </div>
          <Loader2 className="h-10 w-10 animate-spin text-lime-500 mx-auto" />
          <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">Loading tracking data...</p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  // Uber pattern: only show error if we NEVER had data.
  // If socket is feeding live positions, a failed poll is irrelevant.
  const hasEverHadData = useRef(false)
  if (trackingData) hasEverHadData.current = true
  if (isError && !hasEverHadData.current) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg border border-slate-200 mx-auto mb-6">
            <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
          </div>
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Tracking unavailable</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {errorObj?.message?.includes('expired')
              ? 'This tracking link has expired. Please request a new one.'
              : endedKind
                ? TRIP_ENDED_COPY[endedKind].description
                : errorObj?.message?.includes('not found')
                  ? 'We could not find this tracking link. Please double-check the link you opened.'
                  : errorObj?.message || 'Could not load tracking data. Please try again in a moment.'}
          </p>
          <Button
            onClick={() => refetchTracking()}
            className="mt-6 bg-lime-500 text-slate-950 font-extrabold rounded-2xl"
          >
            Try Again
          </Button>
        </Card>
        {tripEndedDialog}
      </div>
    )
  }

  const isTripCompleted = trackingData.trackingSession?.status === 'STOPPED' || trackingData.status === 'COMPLETED'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header — clean, branded, no nav links */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow border border-slate-200">
              <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">101 Drivers</div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">Live Tracking</div>
            </div>
          </Link>
          <StatusBadge status={trackingData.status} />
        </div>
      </header>

      <main className={cn(
        "max-w-[980px] mx-auto px-5 sm:px-6 pb-10 transition-all duration-300",
        mapExpanded ? "py-0 pb-0" : "py-6"
      )}>
        {/* Page heading */}
        {!mapExpanded && <section className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {isTripCompleted ? 'Delivery Completed' : endedKind ? TRIP_ENDED_COPY[endedKind].title : 'Live Tracking (ACTIVE)'}
          </h1>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isTripCompleted
                ? 'This delivery has been completed successfully.'
                : endedKind
                  ? TRIP_ENDED_COPY[endedKind].description
                  : 'Real-time vehicle location. Updates automatically.'}
            </p>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {!isTripCompleted && !endedKind && (
              <>
                {/* Socket connection indicator */}
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold",
                  socketConnected
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                )}>
                  {socketConnected ? (
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  {socketConnected ? 'Live' : 'Reconnecting'}
                </div>
                <div className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold",
                  isDataStale
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                )}>
                  {isDataStale ? (
                    <AlertCircle className="h-3.5 w-3.5" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                  {isDataStale ? 'Stale data' : getLastUpdateText()}
                </div>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isManualRefreshing}
              className="h-8 px-3 rounded-full text-xs font-bold text-slate-600 hover:text-lime-600"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isManualRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {/* Task 32: always-available WhatsApp path — the visitor may want
                to ask something without anything being wrong. */}
            {!endedKind && (
              <WhatsAppSupportButton
                size="sm"
                label="WhatsApp us"
                buttonClassName="h-8 px-3 rounded-full text-xs"
              />
            )}
          </div>

          {/* Task 32: the visitor was watching live and the trip just ended —
              keep the page honest with a persistent banner under the header. */}
          {endedKind && hasEverHadData.current && (
            <div className="mt-3 p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white">{TRIP_ENDED_COPY[endedKind].title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{TRIP_ENDED_COPY[endedKind].description}</p>
              </div>
            </div>
          )}
        </section>}

        {/* Task 32: driver signal paused — explain it and offer a human path
            instead of a silently frozen map. */}
        {!mapExpanded && !endedKind && isDataStale && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white">No driver update for a few minutes</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                The driver's signal may be weak (tunnels, rural roads, parking garages). It usually resumes on its own — if you're worried, chat with us.
              </p>
              <WhatsAppSupportButton size="sm" label="Chat with us on WhatsApp" className="mt-2" buttonClassName="text-xs" />
            </div>
          </div>
        )}

        {/* Map */}
        <Card className={cn(
          "border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg mb-6 transition-all duration-300",
          mapExpanded
            ? "!rounded-none !border-0 !shadow-none !mb-0 fixed inset-0 z-40"
            : ""
        )}>
          <div className={cn(
            "relative bg-slate-50 dark:bg-slate-950 transition-all duration-300",
            mapExpanded
              ? "w-full h-full min-h-0"
              : "min-h-[350px] sm:min-h-[450px]"
          )}>
            {isLoaded && pickupCoords && dropoffCoords ? (
              <RouteMap
                pickup={pickupCoords}
                dropoff={dropoffCoords}
                driverPosition={driverPosition}
                points={routePoints}
                isLoaded={isLoaded}
                focusOnDriver={true}
                followDriver={true}
                showMarkerLabels={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center min-h-[350px] sm:min-h-[450px]">
                <div className="text-center">
                  <Loader2 className="h-8 h-8 animate-spin text-lime-500 mx-auto" />
                  <p className="mt-2 text-sm text-slate-500">Loading map...</p>
                </div>
              </div>
            )}

            {/* Gray circular enlarge/collapse button */}
            <button
              onClick={() => setMapExpanded(prev => !prev)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition"
              title={mapExpanded ? 'Collapse map' : 'Expand map'}
            >
              {mapExpanded
                ? <Minimize2 className="h-4.5 w-4.5 text-slate-700 dark:text-slate-300" />
                : <Maximize2 className="h-4.5 w-4.5 text-slate-700 dark:text-slate-300" />
              }
            </button>
          </div>
        </Card>

        {/* Info cards grid */}
        {!mapExpanded && <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pickup / Dropoff */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{trackingData.pickup?.address || '—'}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Flag className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drop-off</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{trackingData.dropoff?.address || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle info */}
          {trackingData.vehicle && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Car className="h-4 w-4 text-lime-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-lime-500/15 flex items-center justify-center">
                    <Truck className="h-5 h-5 text-lime-500" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white text-sm">
                      {[trackingData.vehicle.color, trackingData.vehicle.year, trackingData.vehicle.make, trackingData.vehicle.model].filter(Boolean).join(' ') || '—'}
                    </div>
                    {trackingData.vehicle.licensePlate && (
                      <div className="text-xs text-slate-500">{trackingData.vehicle.licensePlate}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer PIN */}
          {trackingData?.pickupPin && (
            <div className="mt-4 p-4 rounded-2xl bg-lime-50 dark:bg-lime-900/10 border-2 border-lime-200 dark:border-lime-900/30">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-lime-700 dark:text-lime-300">
                    Your PIN
                  </p>
                  <p className="text-2xl font-black text-lime-600 dark:text-lime-400 mt-0.5">
                    {trackingData.pickupPin}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Share this PIN only with the assigned driver at pickup. This authorizes the vehicle release.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tracking status */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-lime-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trip Status</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Navigation className="h-3.5 w-3.5 text-lime-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Session</div>
                    <div className="text-xs text-slate-500">
                      {trackingData.trackingSession?.status?.replace('_', ' ') || 'Not started'}
                    </div>
                  </div>
                </div>
                {trackingData.trackingSession?.startedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Flag className="h-3.5 w-3.5 text-lime-500" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Started at</div>
                      <div className="text-xs text-slate-500">{formatTime(trackingData.trackingSession.startedAt)}</div>
                    </div>
                  </div>
                )}
                {trackingData.trackingSession?.drivenMiles != null && trackingData.trackingSession.drivenMiles > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-lime-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Target className="h-3.5 w-3.5 text-lime-500" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Distance driven</div>
                      <div className="text-xs text-slate-500">{trackingData.trackingSession.drivenMiles.toFixed(1)} mi</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Driver contact */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-lime-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Driver</span>
              </div>
              {trackingData.driver ? (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 mb-3">
                    <div className="w-10 h-10 rounded-full bg-lime-500/15 flex items-center justify-center">
                      <User className="h-5 h-5 text-lime-500" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {trackingData.driver.name || 'Your driver'}
                      </div>
                      {trackingData.driver.phone && (
                        <div className="text-xs text-slate-500">{trackingData.driver.phone}</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {trackingData.driver.phone && (
                      <>
                        <Button
                          className="w-full gap-2 rounded-2xl font-bold"
                          variant="outline"
                          onClick={() => window.open(`tel:${trackingData.driver.phone}`, '_self')}
                        >
                          <Phone className="h-4 w-4 text-lime-500" />
                          Call
                        </Button>
                        <Button
                          className="w-full gap-2 rounded-2xl font-bold"
                          variant="outline"
                          onClick={() => window.open(`sms:${trackingData.driver.phone}`, '_self')}
                        >
                          <MessageCircle className="h-4 w-4 text-lime-500" />
                          Message
                        </Button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  {isTripCompleted ? 'Driver info hidden after delivery.' : 'Driver contact becomes available when the trip starts.'}
                </p>
              )}
            </CardContent>
          </Card>
        </section>}

        {/* Footer */}
        {!mapExpanded && (
        <footer className="mt-10 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-lime-500 transition-colors">
            <MapPin className="h-4 w-4" />
            101drivers.techbee.et
          </Link>
          <p className="text-xs text-slate-400 mt-2">Powered by 101 Drivers Inc.</p>
        </footer>
        )}
      </main>

      {tripEndedDialog}
    </div>
  )
}
