// @ts-nocheck
import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import { toast } from 'sonner'

const formatTime = (dateString?: string) => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; className: string }> = {
    BOOKED: { label: 'Booked', className: 'bg-amber-50 text-amber-900 border-amber-200' },
    ACTIVE: { label: 'In Transit', className: 'bg-blue-50 text-blue-900 border-blue-200' },
    COMPLETED: { label: 'Completed', className: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  }
  const c = cfg[status] ?? { label: status, className: '' }
  return (
    <Badge variant="outline" className={cn("gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest border", c.className)}>
      <Navigation className="h-3 w-3" />
      {c.label}
    </Badge>
  )
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
    publicEndpoint: true,
    refetchInterval: 5000,
  })

  // Update coordinates and route points when tracking data arrives
  useEffect(() => {
    if (trackingData?.pickup) {
      setPickupCoords({ lat: trackingData.pickup.lat, lng: trackingData.pickup.lng })
    }
    if (trackingData?.dropoff) {
      setDropoffCoords({ lat: trackingData.dropoff.lat, lng: trackingData.dropoff.lng })
    }
    if (trackingData?.trackingSession?.latestPoint) {
      const point = trackingData.trackingSession.latestPoint
      setDriverPosition({ lat: point.lat, lng: point.lng })
    } else {
      setDriverPosition(null)
    }
    if (trackingData?.trackingSession?.points && Array.isArray(trackingData.trackingSession.points)) {
      setRoutePoints(trackingData.trackingSession.points.map((p: any) => ({
        lat: p.lat,
        lng: p.lng,
      })))
    } else {
      setRoutePoints([])
    }
  }, [trackingData])

  // Handle token expiration
  useEffect(() => {
    if (errorObj?.message?.includes('expired') || (trackingData?.expiresAt && new Date(trackingData.expiresAt) < new Date())) {
      toast.error('Tracking link expired', { description: 'Please request a new tracking link from 101 Drivers.' })
    }
  }, [errorObj, trackingData])

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
  if (isError) {
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
              : errorObj?.message || 'Could not load tracking data. The link may be invalid or expired.'}
          </p>
          <Button
            onClick={() => refetchTracking()}
            className="mt-6 bg-lime-500 text-slate-950 font-extrabold rounded-2xl"
          >
            Try Again
          </Button>
        </Card>
      </div>
    )
  }

  const isTripCompleted = trackingData.trackingSession?.status === 'STOPPED' || trackingData.status === 'COMPLETED'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header — clean, branded, no nav links */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
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

      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-10">
        {/* Page heading */}
        <section className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {isTripCompleted ? 'Delivery Completed' : 'Live Tracking'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isTripCompleted
              ? 'This delivery has been completed successfully.'
              : 'Real-time location of your vehicle delivery. Updates every 5 seconds.'}
          </p>

          {/* Status indicators */}
          <div className="flex items-center gap-3 mt-3">
            {!isTripCompleted && (
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
          </div>
        </section>

        {/* Map */}
        <Card className="border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg mb-6">
          <div className="relative min-h-[350px] sm:min-h-[450px] bg-slate-50 dark:bg-slate-950">
            {isLoaded && pickupCoords && dropoffCoords ? (
              <RouteMap
                pickup={pickupCoords}
                dropoff={dropoffCoords}
                driverPosition={driverPosition}
                points={routePoints}
                isLoaded={isLoaded}
                focusOnDriver={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center min-h-[350px] sm:min-h-[450px]">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-lime-500 mx-auto" />
                  <p className="mt-2 text-sm text-slate-500">Loading map...</p>
                </div>
              </div>
            )}

            {/* Overlay badges */}
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-10">
              <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-2xl text-[11px] font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-green-500" />
                Pickup
              </div>
              <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-2xl text-[11px] font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-red-500" />
                Drop-off
              </div>
              {driverPosition && !isTripCompleted && (
                <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-2xl text-[11px] font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 text-blue-500" />
                  Driver
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Info cards grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <Truck className="h-5 w-5 text-lime-500" />
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
                {trackingData.expiresAt && !isTripCompleted && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    Link expires at {new Date(trackingData.expiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
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
                      <User className="h-5 w-5 text-lime-500" />
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
        </section>

        {/* Footer */}
        <footer className="mt-10 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-lime-500 transition-colors">
            <MapPin className="h-4 w-4" />
            101drivers.techbee.et
          </Link>
          <p className="text-xs text-slate-400 mt-2">Powered by 101 Drivers Inc.</p>
        </footer>
      </main>
    </div>
  )
}
