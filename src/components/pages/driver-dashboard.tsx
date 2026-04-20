// app/pages/driver/dashboard.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  QrCode,
  Gauge as Speed,
  Camera as PhotoCamera,
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
import type { NotificationInboxResponse } from '@/types/notification'

// Filter options matching backend API
const FILTER_OPTIONS = {
  radiusOptions: [
    { value: '10', label: 'Within 10 miles' },
    { value: '25', label: 'Within 25 miles' },
    { value: 'ANY', label: 'Any' },
  ],
  datePresetOptions: [
    { value: 'TODAY', label: 'Today' },
    { value: 'TOMORROW', label: 'Tomorrow' },
    { value: 'ALL', label: 'Any' },
  ],
  serviceTypeOptions: [
    { value: 'ALL', label: 'All Transfers' },
  ],
  sortOptions: [
    { value: 'SOONEST', label: 'Soonest' },
    { value: 'BEST_MATCH', label: 'Best match' },
    { value: 'NEAREST', label: 'Nearest' },
    { value: 'NEWEST', label: 'Newest' },
  ],
}

// Helper functions for formatting
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

const formatTimeRange = (startIso?: string, endIso?: string): string => {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endStr = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${startStr}–${endStr}`
}

const formatDuration = (minutes?: number): string => {
  if (!minutes) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const formatCurrency = (amount?: number | null): string => {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Service type to display name mapping
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

// Type for job data used in the component
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
  requirements: { icon: any; label: string }[]
  // Full data for bottom sheet
  pickupAddressFull?: string
  dropoffAddressFull?: string
  pickupWindowStartFull?: string
  pickupWindowEndFull?: string
  etaMinutes?: number
  isUrgent?: boolean
  // Coordinates for map
  lat: number
  lng: number
}

export default function DriverDashboardPage() {
  const [activeView, setActiveView] = useState<'map' | 'list'>('map')
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const driverId = user?.profileId
  const displayName = user?.fullName?.split(' ')[0] || user?.username || 'Driver'
  const navigate = useNavigate()

  // Filter state - maps directly to backend API params
  const [filters, setFilters] = useState({
    search: '',
    radiusMiles: 'ANY',
    datePreset: 'ALL',
    serviceType: 'ALL',
    sortBy: 'SOONEST',
  })

  // Build query params from filter state
  const buildQueryParams = () => {
    const params = new URLSearchParams()
    params.append('limit', '20')

    if (filters.search.trim()) {
      params.append('search', filters.search.trim())
    }
    if (filters.radiusMiles && filters.radiusMiles !== 'ANY') {
      params.append('radiusMiles', filters.radiusMiles)
    }
    if (filters.datePreset && filters.datePreset !== 'ALL') {
      params.append('datePreset', filters.datePreset)
    }
    if (filters.serviceType && filters.serviceType !== 'ALL') {
      params.append('serviceType', filters.serviceType)
    }
    if (filters.sortBy) {
      params.append('sortBy', filters.sortBy)
    }

    return params.toString()
  }

  const queryParams = buildQueryParams()

  // Real data fetch with query params
  const {
    data: deliveriesData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${driverId}?${queryParams}`,
    noFilter: true,
    enabled: Boolean(driverId)
  })

  // Fetch notification count
  const { data: inboxData } = useDataQuery<NotificationInboxResponse>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/notificationEvents/my/inbox?take=1`,
    noFilter: true,
    enabled: Boolean(driverId),
  })
  const unreadCount = inboxData?.unreadCount || 0

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Proof cam onboarding guard: redirect first-time drivers
  useEffect(() => {
    try {
      const seen = localStorage.getItem('hasSeenProofCam')
      if (seen !== 'true') {
        navigate({ to: '/driver-proof-cam' })
      }
    } catch {
      // localStorage may not be available (SSR, private browsing, etc.)
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

  // Update a single filter value
  const updateFilter = (key: keyof typeof filters, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Clear all filters to defaults
  const clearFilters = () => {
    setFilters({
      search: '',
      radiusMiles: 'ANY',
      datePreset: 'ALL',
      serviceType: 'ALL',
      sortBy: 'SOONEST',
    })
    toast.success('Filters reset to defaults')
  }

  const handleRefresh = () => {
    refetch()
    toast.success('Refreshed', {
      description: 'Job feed updated.',
    })
  }

  const handleViewJob = (jobId: string) => {
    navigate({ to: `/driver-job-details`, search: { jobId } })
  }

  // Open bottom sheet for a specific job
  const handleSelectJob = useCallback((job: JobItem) => {
    setSelectedJob(job)
    setShowSheet(true)
  }, [])

  // View on Map from list view card
  const handleViewOnMap = useCallback((job: JobItem) => {
    setSelectedJob(job)
    setShowSheet(true)
    setActiveView('map')
  }, [])

  // Transform API data to UI-friendly array
  const jobs: JobItem[] = useMemo(() => {
    return deliveriesData?.items?.map((item: any, index: number) => ({
      id: item.deliveryId,
      urgent: item.isUrgent || false,
      type: serviceTypeLabels[item.serviceType] || item.serviceType,
      date: formatDate(item.pickupWindowStart),
      timeWindow: formatTimeRange(item.pickupWindowStart, item.pickupWindowEnd),
      pickup: item.pickupAddress?.split(',')[0] || item.pickupAddress,
      dropoff: item.dropoffAddress?.split(',')[0] || item.dropoffAddress,
      service: serviceTypeLabels[item.serviceType] || item.serviceType,
      miles: item.pickupDistanceMiles || null,
      duration: formatDuration(item.etaMinutes),
      payout: item.payoutPreviewAmount,
      bonus: item.urgentBonusAmount,
      requirements: [
        { icon: QrCode, label: 'VIN required' },
        { icon: PhotoCamera, label: 'Photos (12)' },
        { icon: Speed, label: 'Odometer' },
      ],
      pickupAddressFull: item.pickupAddress || '',
      dropoffAddressFull: item.dropoffAddress || '',
      pickupWindowStartFull: item.pickupWindowStart || '',
      pickupWindowEndFull: item.pickupWindowEnd || '',
      etaMinutes: item.etaMinutes || null,
      isUrgent: item.isUrgent || false,
      lat: item.pickupLat && item.pickupLng ? item.pickupLat : mockPickupLocations[index % mockPickupLocations.length].lat,
      lng: item.pickupLat && item.pickupLng ? item.pickupLng : mockPickupLocations[index % mockPickupLocations.length].lng,
    })) || []
  }, [deliveriesData])

  // Map marker icons (only create when Google Maps API is loaded)
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
      labelOrigin: new google.maps.Point(40, 26),
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

  // Map options
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

  // Format full date string for the bottom sheet
  const formatFullDate = (isoString?: string): string => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Format pickup time for list cards
  const formatPickupTime = (isoString?: string): string => {
    if (!isoString) return ''
    const date = new Date(isoString)
    const dateStr = date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const timeStr = date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
    return `${dateStr} - ${timeStr}`
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex flex-col">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: Logo + Title */}
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
                {activeView === 'map' ? 'Map View' : 'Gig Feed'}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {/* Driver identity pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {displayName}
              </span>
            </div>

            {/* Filter button */}
            <Link
              to="/driver-preferences"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Filter"
            >
              <Funnel className="w-4.5 h-4.5" />
            </Link>

            {/* Preferences */}
            <Link
              to="/driver-preferences"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Preferences"
            >
              <Settings className="w-4.5 h-4.5" />
            </Link>

            {/* Active Deliveries */}
            <Link
              to="/driver-active"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Active deliveries"
            >
              <Briefcase className="w-4.5 h-4.5" />
            </Link>

            {/* View toggle button: Map/List */}
            <button
              onClick={() => setActiveView(activeView === 'map' ? 'list' : 'map')}
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label={activeView === 'map' ? 'Switch to list view' : 'Switch to map view'}
            >
              {activeView === 'map' ? (
                <List className="w-4.5 h-4.5" />
              ) : (
                <Map className="w-4.5 h-4.5" />
              )}
            </button>

            {/* Notifications */}
            <Link
              to="/driver-inbox"
              className="relative w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Inbox"
            >
              <Inbox className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-slate-950 text-[11px] font-black flex items-center justify-center border border-white dark:border-slate-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Theme toggle */}
            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-4.5 h-4.5" />
              ) : (
                <Moon className="w-4.5 h-4.5" />
              )}
            </Button>

            {/* Sign out */}
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Mobile identity indicator */}
        <div className="sm:hidden max-w-[480px] mx-auto px-4 pb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              Online as {displayName}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {activeView === 'map' ? (
        /* ============================== */
        /* MAP VIEW                        */
        /* ============================== */
        <div className="flex-1">
          {isLoaded ? (
            <GoogleMap
              mapContainerClassName="w-full"
              mapContainerStyle={{ width: '100%', height: 'calc(100vh - 120px)' }}
              center={{ lat: 33.95, lng: -118.35 }}
              zoom={11}
              options={mapOptions}
            >
              {/* Driver location dot */}
              <Marker
                position={{ lat: 33.95, lng: -118.35 }}
                icon={driverDotIcon}
              />

              {/* Cluster marker if many jobs */}
              {jobs.length > 8 && (
                <Marker
                  position={{ lat: 34.0, lng: -118.3 }}
                  icon={clusterIcon}
                />
              )}

              {/* Job pay bubble markers */}
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
            <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ============================== */
        /* GIG FEED / LIST VIEW            */
        /* ============================== */
        <main className="flex-1 w-full max-w-[480px] mx-auto px-4 sm:px-6 py-4 pb-24">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="h-11 w-full pl-11 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
              placeholder="Search pickup location by city or ZIP"
            />
          </div>

          {/* Filters Section */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Pickup Distance dropdown */}
                <Select
                  value={filters.radiusMiles}
                  onValueChange={(value) => updateFilter('radiusMiles', value)}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm min-w-[130px]">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.radiusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date dropdown */}
                <Select
                  value={filters.datePreset}
                  onValueChange={(value) => updateFilter('datePreset', value)}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm min-w-[110px]">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.datePresetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* All Transfers - disabled */}
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-sm text-slate-400 pointer-events-none opacity-50"
                  disabled
                >
                  <Car className="w-3.5 h-3.5" />
                  All Transfers
                </button>

                <div className="flex-1" />

                {/* Clear */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-xs font-bold"
                >
                  Clear
                </Button>

                {/* Refresh */}
                <Button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-xs font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section Header */}
          <div className="flex items-end justify-between gap-4 mb-3">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              GIGS NEARBY ({jobs.length})
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Sort
              </span>
              <Select
                value={filters.sortBy}
                onValueChange={(value) => updateFilter('sortBy', value)}
              >
                <SelectTrigger className="h-8 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-xs min-w-[110px]">
                  <SelectValue placeholder="Soonest" />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loading / Error / Empty states */}
          {isLoading && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading available gigs...</p>
              </div>
            </Card>
          )}

          {isError && (
            <Card className="border-red-200 dark:border-red-900 shadow-lg overflow-hidden p-8">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-semibold">Failed to load gigs. Please try again.</p>
              </div>
            </Card>
          )}

          {!isLoading && !isError && jobs.length === 0 && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden p-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Inbox className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">No gigs available at the moment.</p>
              </div>
            </Card>
          )}

          {/* Job Cards */}
          {jobs.length > 0 && (
            <div className="flex flex-col gap-3">
              {jobs.map((job) => (
                <Card
                  key={job.id}
                  className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => handleSelectJob(job)}
                >
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {/* Map Thumb Placeholder */}
                      <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-slate-400" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {/* Date & Time */}
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">
                              {formatPickupTime(job.pickupWindowStartFull || deliveriesData?.items?.find((i: any) => i.deliveryId === job.id)?.pickupWindowStart)}
                            </div>
                            {/* Pickup */}
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                              {job.pickup}
                            </div>
                            {/* Dropoff */}
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              → {job.dropoff}
                            </div>
                          </div>
                          {/* Pay amount */}
                          <div className="text-lg font-black text-green-600 dark:text-green-400 shrink-0">
                            {formatCurrency(job.payout)}
                          </div>
                        </div>

                        {/* Bottom: mileage + View on Map */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {job.miles ? `${job.miles} mi` : ''}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewOnMap(job)
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                          >
                            <Map className="w-3 h-3" />
                            View on Map
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Tips Section */}
          <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Checklist required
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Before you can start: VIN code + 6 pickup photos + starting odometer.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Verified className="w-4 h-4 text-primary font-bold" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      No cancel in Driver UI
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      If an issue happens, report it and Ops will assist. All actions are logged.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-amber-500 font-bold" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      )}

      {/* ============================== */}
      {/* DETAILS BOTTOM SHEET            */}
      {/* ============================== */}
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
              {/* Drag handle */}
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

              {/* Job Details */}
              <div className="space-y-3">
                {/* Date */}
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

                {/* Pickup Location */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                    Pickup
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {selectedJob.pickupAddressFull || selectedJob.pickup}
                  </div>
                </div>

                {/* Drop-off Location */}
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

                {/* Mileage & Est. Time */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                      Mileage
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedJob.miles ? `${selectedJob.miles} mi` : '—'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                      Est. Time
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedJob.duration}
                    </div>
                  </div>
                </div>

                <Separator className="bg-slate-100 dark:bg-slate-800" />

                {/* Pay */}
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

                {/* Requirements */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedJob.requirements.map((req, idx) => (
                    <Badge key={idx} variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      <req.icon className="w-3 h-3 text-primary mr-1" />
                      {req.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSheet(false)
                    setSelectedJob(null)
                  }}
                  className="flex-1 h-12 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-700 dark:text-slate-200"
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

      {/* ============================== */}
      {/* BOTTOM TAB BAR                  */}
      {/* ============================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[480px] mx-auto">
          <div className="grid grid-cols-2 gap-0">
            <button
              onClick={() => setActiveView('map')}
              className={cn(
                "flex flex-col items-center gap-1 py-3 transition",
                activeView === 'map' ? 'text-primary' : 'text-slate-400'
              )}
            >
              <Map className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Map</span>
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={cn(
                "flex flex-col items-center gap-1 py-3 transition",
                activeView === 'list' ? 'text-primary' : 'text-slate-400'
              )}
            >
              <List className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Gigs</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  )
}
