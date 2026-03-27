// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { Link, useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useJsApiLoader } from '@react-google-maps/api'
import RouteMap from '@/components/map/RouteMap'
import {
  ArrowLeft,
  Menu,
  X,
  Truck,
  MapPin,
  Clock,
  Navigation,
  Map,
  AlertCircle,
  User,
  Phone,
  MessageCircle,
  Home,
  Flag,
  Target,
  Loader2,
  RefreshCw,
  Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'
import { toast } from 'sonner'

// Helper to format time
const formatTime = (dateString?: string) => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Status badge component (same as in details page)
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'BOOKED':
        return {
          label: 'Booked',
          icon: Navigation,
          variant: 'secondary' as const,
          className: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/10 dark:text-amber-200 dark:border-amber-900/30',
        }
      case 'ACTIVE':
        return {
          label: 'Active',
          icon: Navigation,
          variant: 'default' as const,
          className: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-900/30',
        }
      case 'COMPLETED':
        return {
          label: 'Completed',
          icon: Truck,
          variant: 'default' as const,
          className: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-200 dark:border-emerald-900/30',
        }
      default:
        return {
          label: status,
          icon: Truck,
          variant: 'outline' as const,
          className: '',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={cn("gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest border", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// Header (copied from dealer details page)
const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center" aria-label="101 Drivers">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-create-delivery"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Create Delivery
            </Link>
            <Link
              // to="/dealer/notifications"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
            >
              Notifications
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/dealer-dashboard"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Deliveries
          </Link>

          <Link
            to="/dealer-create-delivery"
            className="inline-flex items-center gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 px-6 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-lime-500/20 transition-all font-extrabold"
          >
            New Delivery
            <span className="sr-only">Plus</span> {/* Plus icon omitted for brevity, add if needed */}
          </Link>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-create-delivery"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Create Delivery
            </Link>
            <Link
              // to="/dealer/notifications"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Notifications
            </Link>
            <Separator className="my-2" />
            <Link
              to="/dealer-dashboard"
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors"
            >
              Back to Deliveries
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

// Footer (copied from dealer details page)
const Footer = () => (
  <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
    <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
            <img
              src="/assets/101drivers-logo.jpg"
              alt="101 Drivers logo"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            California-only operations • Email-first notifications
          </p>
        </div>
        <p className="text-xs text-slate-500 font-medium">© 2024 101 Drivers Inc. All rights reserved.</p>
      </div>
    </div>
  </footer>
)

export default function DealerLiveTrack() {
  // Get deliveryId from query string
  const { deliveryId } = useSearch({ strict: false }) as { deliveryId: string }
  const navigate = useNavigate()
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [driverPosition, setDriverPosition] = useState<google.maps.LatLngLiteral | null>(null)
  const [routePoints, setRoutePoints] = useState<google.maps.LatLngLiteral[]>([]) // 👈 new state for route points
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)

  const user = getUser()
  const dealerId = user?.profileId

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places'],
  })

  // 1. Fetch tracking link to get token
  const {
    data: trackingLink,
    isLoading: linkLoading,
    isError: linkError,
    error: linkErrorObj,
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/tracking-link`,
    enabled: !!dealerId && !!deliveryId,
    noFilter: true,
  })

  const token = trackingLink?.token

  // 2. Fetch public tracking data using token
  const {
    data: trackingData,
    isLoading: trackingLoading,
    isError: trackingError,
    error: trackingErrorObj,
    refetch: refetchTracking,
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/public/tracking/${token}`,
    enabled: !!token,
    noFilter: true,
    refetchInterval: 5000, // poll every 5 seconds for live updates
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
    // 👇 set route points from the points array (if present)
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
    if (trackingErrorObj?.message?.includes('expired') || trackingData?.expiresAt && new Date(trackingData.expiresAt) < new Date()) {
      toast.error('Tracking link expired. Please request a new one.')
    }
  }, [trackingErrorObj, trackingData])

  // Check if tracking data is stale (no update for more than 2 minutes)
  const isDataStale = (() => {
    if (!trackingData?.trackingSession?.latestPoint?.recordedAt) return false
    const lastUpdate = new Date(trackingData.trackingSession.latestPoint.recordedAt).getTime()
    const now = Date.now()
    return (now - lastUpdate) > 2 * 60 * 1000 // 2 minutes
  })()

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true)
    try {
      await refetchTracking()
      toast.success('Location updated')
    } catch (error) {
      toast.error('Failed to refresh location')
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500) // minimum visual feedback
    }
  }

  // Format relative time for last update
  const getLastUpdateText = () => {
    const recordedAt = trackingData?.trackingSession?.latestPoint?.recordedAt
    if (!recordedAt) return 'No data yet'
    
    const lastUpdate = new Date(recordedAt)
    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000)
    
    if (diffSeconds < 60) return 'Just now'
    if (diffSeconds < 120) return '1 min ago'
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`
    return formatTime(recordedAt)
  }

  // Loading state
  if (linkLoading || (token && trackingLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-lime-500 mx-auto" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading live tracking...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Error: no tracking link
  if (linkError || !trackingLink) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Tracking unavailable</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {linkErrorObj?.message || 'Could not generate tracking link.'}
            </p>
            <Button onClick={() => navigate({ to: `/dealer/delivery/${deliveryId}` })} className="mt-6 bg-lime-500 text-slate-950">
              Back to Delivery
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // Error: public tracking data failed
  if (trackingError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Tracking data failed</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{trackingErrorObj?.message}</p>
            <Button onClick={() => refetchTracking()} className="mt-6 bg-lime-500 text-slate-950">
              Retry
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Page header */}
        <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-lime-500/15 flex items-center justify-center mt-1">
              <Navigation className="h-6 w-6 text-lime-500" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  Live Tracking
                </h1>
                <StatusBadge status={trackingData?.status} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Real‑time location of the driver. Updates every 5 seconds.
              </p>
              
              {/* Last update status bar */}
              <div className="flex items-center gap-3 mt-3">
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
                  {getLastUpdateText()}
                </div>
                
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
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate({ to: `/dealer/delivery/${deliveryId}` })}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-extrabold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Delivery
          </Button>
        </section>

        {/* Map and info */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Map */}
          <div className="lg:col-span-8">
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
              <div className="relative min-h-[400px] sm:min-h-[500px] bg-slate-50 dark:bg-slate-950">
                {isLoaded && pickupCoords && dropoffCoords ? (
                  <RouteMap
                    pickup={pickupCoords}
                    dropoff={dropoffCoords}
                    driverPosition={driverPosition}
                    points={routePoints} // 👈 pass the historical route points
                    isLoaded={isLoaded}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Map loading…</p>
                  </div>
                )}

                {/* Overlay badges */}
                <div className="absolute bottom-5 left-5 flex flex-wrap gap-2 z-10">
                  <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Map className="h-4 w-4 text-lime-500" />
                    Live View
                  </div>

                  {trackingData?.trackingSession?.latestPoint && (
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-lime-500" />
                      Last update: {formatTime(trackingData.trackingSession.latestPoint.recordedAt)}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar info */}
          <div className="lg:col-span-4 space-y-6">
            {/* Delivery details */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Delivery info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Service type</div>
                  <div className="font-black text-slate-900 dark:text-white mt-1">{trackingData?.serviceType?.replace('_', ' ') || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pickup</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{trackingData?.pickup?.address || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Drop-off</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{trackingData?.dropoff?.address || '—'}</div>
                </div>
              </CardContent>
            </Card>

            {/* Vehicle info */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Car className="h-5 w-5 text-lime-500" />
                  Vehicle
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Vehicle display */}
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-lime-500/15 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-lime-500" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">
                      {trackingData?.vehicle?.year 
                        ? `${trackingData.vehicle.year} ` 
                        : ''}
                      {trackingData?.vehicle?.make || '—'}{' '}
                      {trackingData?.vehicle?.model || ''}
                    </div>
                    <div className="text-sm text-slate-500">
                      {trackingData?.vehicle?.color || 'Color not specified'}
                    </div>
                  </div>
                </div>
                
                {/* Vehicle details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">License Plate</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1">
                      {trackingData?.vehicle?.licensePlate || '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">VIN Last 4</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1">
                      {trackingData?.vehicle?.vinLast4 || trackingData?.vehicle?.vinVerificationCode || '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 col-span-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transmission</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1">
                      {trackingData?.vehicle?.transmission || 'Not specified'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking status */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Tracking status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-lime-500/15 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-lime-500" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">Session status</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {trackingData?.trackingSession?.status?.replace('_', ' ') || 'Not started'}
                    </div>
                  </div>
                </div>

                {trackingData?.trackingSession?.startedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-lime-500/15 flex items-center justify-center">
                      <Flag className="h-4 w-4 text-lime-500" />
                    </div>
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">Started</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {formatTime(trackingData.trackingSession.startedAt)}
                      </div>
                    </div>
                  </div>
                )}

                {trackingData?.trackingSession?.drivenMiles ? (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-lime-500/15 flex items-center justify-center">
                      <Target className="h-4 w-4 text-lime-500" />
                    </div>
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">Driven miles</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {trackingData.trackingSession.drivenMiles.toFixed(1)} mi
                      </div>
                    </div>
                  </div>
                ) : null}

                {trackingData?.expiresAt && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                    Tracking link expires {formatTime(trackingData.expiresAt)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Quick actions</h3>
                
                {/* Driver info if available */}
                {trackingData?.driver && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 mb-4">
                    <div className="w-10 h-10 rounded-full bg-lime-500/15 flex items-center justify-center">
                      <User className="h-5 w-5 text-lime-500" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {trackingData.driver.name || 'Driver'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {trackingData.driver.phone || 'No phone'}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {trackingData?.driver?.phone ? (
                    <>
                      <Button 
                        className="w-full gap-2" 
                        variant="outline"
                        onClick={() => window.open(`tel:${trackingData.driver.phone}`, '_self')}
                      >
                        <Phone className="h-4 w-4 text-lime-500" />
                        Call driver
                      </Button>
                      <Button 
                        className="w-full gap-2" 
                        variant="outline"
                        onClick={() => window.open(`sms:${trackingData.driver.phone}`, '_self')}
                      >
                        <MessageCircle className="h-4 w-4 text-lime-500" />
                        Message driver
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button className="w-full gap-2" variant="outline" disabled>
                        <Phone className="h-4 w-4 text-slate-400" />
                        Call driver
                      </Button>
                      <Button className="w-full gap-2" variant="outline" disabled>
                        <MessageCircle className="h-4 w-4 text-slate-400" />
                        Message driver
                      </Button>
                      <p className="text-xs text-slate-500 text-center">
                        Driver contact not available until trip starts
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}