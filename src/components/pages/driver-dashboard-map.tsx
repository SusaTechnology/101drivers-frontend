// app/pages/driver/dashboard-map.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Home,
  LogOut,
  Sun,
  Moon,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Bell,
  Inbox,
  Menu,
  X,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  User,
  Settings,
  Sliders,
  SlidersHorizontal as Tune,
  Route,
  Map,
  Navigation,
  Compass,
  Car,
  Fuel,
  Gauge,
  Bolt,
  Bolt as BoltIcon,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  TriangleAlert as Warning,
  Verified,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Phone,
  Mail,
  MessageSquare,
  CalendarDays,
  Timer,
  Award,
  Star,
  CreditCard,
  DollarSign as DollarSignIcon,
  Receipt,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MoreVertical,
  List,
  Briefcase,
  Funnel,
  LocateFixed,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getUser, useDataQuery, clearAuth, stopSessionKeepAlive } from '@/lib/tanstack/dataQuery'
import { useJsApiLoader, GoogleMap, Marker } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import PickupZoneOverlay from '@/components/map/PickupZoneOverlay'
import { usePickupZones } from '@/hooks/usePickupZones'
import type { NotificationInboxResponse } from '@/types/notification'
import DriverBottomNav from '../layout/DriverBottomNav'

// ── Helper functions (duplicated to keep files independent) ──────
const formatDate = (isoString?: string): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const formatFullWeekdayDate = (isoString?: string): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

const formatTimeRange = (startIso?: string, endIso?: string): string => {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endStr = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${startStr} - ${endStr}`
}

const formatDuration = (minutes?: number): string => {
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

const serviceTypeLabels: Record<string, string> = {
  HOME_DELIVERY: 'Car Transfer',
  BETWEEN_LOCATIONS: 'Car Transfer',
  SERVICE_PICKUP_RETURN: 'Car Transfer',
}

// Mock pickup locations for jobs without coordinates
const mockPickupLocations = [
  { lat: 33.94, lng: -118.40 }, // Santa Monica
  { lat: 34.05, lng: -118.25 }, // Downtown LA
  { lat: 34.15, lng: -118.15 }, // Pasadena
  { lat: 33.87, lng: -118.36 }, // Hawthorne/LAX
  { lat: 34.02, lng: -118.45 }, // Culver City
  { lat: 33.98, lng: -118.22 }, // Montebello
  { lat: 34.06, lng: -118.30 }, // Echo Park
  { lat: 33.92, lng: -118.20 }, // Downey
  { lat: 34.08, lng: -118.38 }, // West Hollywood
  { lat: 33.96, lng: -118.48 }, // El Segundo
  { lat: 34.18, lng: -118.30 }, // Altadena
  { lat: 33.83, lng: -118.30 }, // Torrance
]

// Job type used in the map
interface JobItem {
  id: string
  urgent: boolean
  type: string
  date: string
  timeWindow: string
  pickup: string
  dropoff: string
  service: string
  miles: number | null
  duration: string
  payout: number | null
  bonus: number | null
  requirements?: { icon: any; label: string }[]
  pickupAddressFull?: string
  dropoffAddressFull?: string
  pickupWindowStartFull?: string
  pickupWindowEndFull?: string
  etaMinutes?: number
  isUrgent?: boolean
  lat: number
  lng: number
  dropoffLat: number | null
  dropoffLng: number | null
}

export default function DriverMapPage() {
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const driverId = user?.profileId
  const displayName = user?.fullName?.split(' ')[0] || user?.username || 'Driver'
  const navigate = useNavigate()

  // Fetch deliveries with default (no) filters for the map
  const {
    data: deliveriesData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${driverId}?limit=20`,
    noFilter: true,
    enabled: Boolean(driverId)
  })

  // Notification count
  const { data: inboxData } = useDataQuery<NotificationInboxResponse>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/notificationEvents/my/inbox?take=1`,
    noFilter: true,
    enabled: Boolean(driverId),
  })
  const unreadCount = inboxData?.unreadCount || 0

  // Service district zones for overlay
  const { zones: pickupZones } = usePickupZones()
  const mapRef = useRef<google.maps.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || pickupZones.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    pickupZones.forEach((zone: any) => {
      const ring = zone.geoJson?.geometry?.coordinates?.[0]
      if (!ring) return
      ring.forEach((coord: number[]) => bounds.extend({ lat: coord[1], lng: coord[0] }))
    })
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { top: 60, right: 30, bottom: 60, left: 30 })
    }
  }, [pickupZones])

  // Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Proof cam onboarding guard
  useEffect(() => {
    try {
      const seen = localStorage.getItem('hasSeenProofCam')
      if (seen !== 'true') {
        navigate({ to: '/driver/proof-cam' })
      }
    } catch {
      // localStorage may not be available
    }
  }, [navigate])

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    clearAuth()
    stopSessionKeepAlive()
    toast.success('Signed out successfully')
    navigate({ to: '/landing' })
  }

  const handleRefresh = () => {
    refetch()
    toast.success('Refreshed', { description: 'Map feed updated.' })
  }

  // Navigate to job details
  const handleViewJob = (jobId: string) => {
    navigate({ to: `/driver/job-details`, search: { jobId } })
  }

  // Open bottom sheet for a selected job
  const handleSelectJob = useCallback((job: JobItem) => {
    setSelectedJob(job)
    setShowSheet(true)
  }, [])

  // Transform API data to UI-friendly array
  const jobs: JobItem[] = useMemo(() => {
    return deliveriesData?.items?.map((item: any, index: number) => ({
      id: item.deliveryId,
      urgent: item.isUrgent || false,
      type: serviceTypeLabels[item.serviceType] || item.serviceType,
      date: formatDate(item.pickupWindowStart),
      timeWindow: formatTimeRange(item.pickupWindowStart, item.pickupWindowEnd),
      pickup: extractRouteLabel(item.pickupAddress || ''),
      dropoff: extractRouteLabel(item.dropoffAddress || ''),
      service: serviceTypeLabels[item.serviceType] || item.serviceType,
      miles: item.pickupDistanceMiles || null,
      duration: formatDuration(item.etaMinutes),
      payout: item.payoutPreviewAmount,
      bonus: item.urgentBonusAmount,
      requirements: [],
      pickupAddressFull: item.pickupAddress || '',
      dropoffAddressFull: item.dropoffAddress || '',
      pickupWindowStartFull: item.pickupWindowStart || '',
      pickupWindowEndFull: item.pickupWindowEnd || '',
      etaMinutes: item.etaMinutes || null,
      isUrgent: item.isUrgent || false,
      lat: item.pickupLat && item.pickupLng ? item.pickupLat : mockPickupLocations[index % mockPickupLocations.length].lat,
      lng: item.pickupLat && item.pickupLng ? item.pickupLng : mockPickupLocations[index % mockPickupLocations.length].lng,
      dropoffLat: item.dropoffLat || null,
      dropoffLng: item.dropoffLng || null,
    })) || []
  }, [deliveriesData])

  // Map marker icons
  const driverDotIcon = useMemo(() => {
    if (!isLoaded || typeof google === 'undefined') return null
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="14" fill="white" stroke="#4285F4" stroke-width="3"/><circle cx="20" cy="20" r="7" fill="#4285F4"/></svg>`),
      scaledSize: new google.maps.Size(32, 32),
      anchor: new google.maps.Point(16, 16),
    }
  }, [isLoaded])

  const createPayBubbleIcon = useCallback((amount: string) => {
    if (!isLoaded || typeof google === 'undefined') return null
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40" width="80" height="40"><rect x="2" y="2" width="76" height="36" rx="18" fill="#16a34a" stroke="white" stroke-width="2"/><text x="40" y="26" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="14" font-weight="bold">${amount}</text></svg>`),
      scaledSize: new google.maps.Size(80, 40),
      anchor: new google.maps.Point(40, 20),
    }
  }, [isLoaded])

  const clusterIcon = useMemo(() => {
    if (!isLoaded || typeof google === 'undefined') return null
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50"><circle cx="25" cy="25" r="22" fill="#15803d" stroke="white" stroke-width="3"/><text x="25" y="31" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="16" font-weight="bold">${jobs.length}</text></svg>`),
      scaledSize: new google.maps.Size(50, 50),
      anchor: new google.maps.Point(25, 25),
    }
  }, [isLoaded, jobs.length])

  const mapOptions = useMemo(() => ({
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    zoomControl: true,
    gestureHandling: 'auto' as const,
    disableDefaultUI: false,
    styles: [
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'on' }] },
      { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'on' }] },
    ],
  }), [])

  const formatFullDate = (isoString?: string): string => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex flex-col overflow-hidden">
      {/* Top App Bar for Map View */}
      <header className="shrink-0 z-40 w-full bg-white/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-9 h-9 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <div className="leading-tight">
              <div className="text-[13px] font-black text-slate-900 dark:text-white">
                Map View
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Desktop driver pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {displayName}
              </span>
            </div>

            {/* Notifications */}
            <Link
              to="/driver/inbox"
              className="relative w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-slate-950 text-[11px] font-black flex items-center justify-center border border-white dark:border-slate-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              to="/driver/dashboard"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Settings"
            >
              <Map className="w-4 h-4" />
            </Link>
            {/* Settings */}
            <Link
              to="/driver/preferences"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Map Content */}
      <div className="flex-1 min-h-0 relative">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            center={{ lat: 33.94, lng: -118.40 }}
            zoom={11}
            options={mapOptions}
            onLoad={(map) => { mapRef.current = map }}
          >
            {/* Driver location */}
            <Marker
              position={{ lat: 33.94, lng: -118.40 }}
              icon={driverDotIcon}
            />

            {/* Cluster marker */}
            {jobs.length > 8 && (
              <Marker
                position={{ lat: 34.0, lng: -118.3 }}
                icon={clusterIcon}
                onClick={() => toast.info(`${jobs.length} gigs in this area`)}
              />
            )}

            {/* Service district overlay */}
            {pickupZones.length > 0 && <PickupZoneOverlay zones={pickupZones} />}

            {/* Job pay bubbles */}
            {jobs.map((job) => (
              <Marker
                key={job.id}
                position={{ lat: job.lat, lng: job.lng }}
                icon={createPayBubbleIcon(formatCurrency(job.payout))}
                onClick={() => handleSelectJob(job)}
              />
            ))}
          </GoogleMap>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet for selected job (same as original) */}
      <Sheet
        open={showSheet}
        onOpenChange={(open) => {
          setShowSheet(open)
          if (!open) setSelectedJob(null)
        }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[70vh] overflow-y-auto p-0"
          showCloseButton={true}
        >
          {selectedJob && (
            <div className="px-6 pt-6 pb-4">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-5" />

              <SheetHeader className="px-0 mb-4">
                <SheetTitle className="text-lg font-black text-slate-900 dark:text-white text-left">
                  {selectedJob.urgent ? (
                    <span className="inline-flex items-center gap-2">
                      <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold">
                        <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
                        Urgent
                      </Badge>
                      <span>{selectedJob.type}</span>
                    </span>
                  ) : (
                    <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                      <Car className="w-3.5 h-3.5 text-primary" />
                      {selectedJob.type}
                    </Badge>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                      Date
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatFullDate(selectedJob.pickupWindowStartFull)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                      Pickup Time
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedJob.timeWindow}
                    </div>
                  </div>
                </div>

                <Separator className="bg-slate-100 dark:bg-slate-800" />

                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                    Pickup
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {selectedJob.pickupAddressFull || selectedJob.pickup}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                    Drop-off
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    {selectedJob.dropoffAddressFull || selectedJob.dropoff}
                  </div>
                </div>

                <Separator className="bg-slate-100 dark:bg-slate-800" />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                      Mileage
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedJob.miles ? `${selectedJob.miles} mi` : '\u2014'}
                    </div>
                  </div>
                </div>

                <Separator className="bg-slate-100 dark:bg-slate-800" />

                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Pay
                  </div>
                  <div className="text-2xl font-black text-green-600 dark:text-green-400">
                    {formatCurrency(selectedJob.payout)}
                  </div>
                </div>
                {selectedJob.bonus && selectedJob.bonus > 0 && (
                  <div className="flex items-center gap-1.5 justify-end">
                    <Bolt className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      + {formatCurrency(selectedJob.bonus)} urgent bonus
                    </span>
                  </div>
                )}

                {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedJob.requirements.map((req, idx) => (
                      <Badge key={idx} variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                        <req.icon className="w-3 h-3 text-primary mr-1" />
                        {req.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSheet(false)
                    setSelectedJob(null)
                  }}
                  className="flex-1 h-12 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-600 dark:text-slate-300"
                >
                  Decline
                </Button>
                <Button
                  onClick={() => {
                    setShowSheet(false)
                    handleViewJob(selectedJob.id)
                  }}
                  className="flex-1 h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white transition text-sm font-bold"
                >
                  Accept
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Bottom Navigation */}
    </div>
  )
}
