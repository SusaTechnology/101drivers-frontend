// app/pages/driver/dashboard.tsx
import React, { useState, useEffect } from 'react'
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
import { getUser, useDataQuery, clearAuth, stopSessionKeepAlive } from '@/lib/tanstack/dataQuery'
import type { NotificationInboxResponse } from '@/types/notification'

// Filter options matching backend API
const FILTER_OPTIONS = {
  radiusOptions: [
    { value: '25', label: 'Within 25 miles' },
    { value: '50', label: 'Within 50 miles' },
    { value: '100', label: 'Within 100 miles' },
    { value: 'ANY', label: 'Any distance' },
  ],
  datePresetOptions: [
    { value: 'TODAY', label: 'Today' },
    { value: 'TOMORROW', label: 'Tomorrow' },
    { value: 'ALL', label: 'Any date' },
  ],
  serviceTypeOptions: [
    { value: 'ALL', label: 'All services' },
    { value: 'HOME_DELIVERY', label: 'Home Delivery' },
    { value: 'BETWEEN_LOCATIONS', label: 'Between Locations' },
    { value: 'SERVICE_PICKUP_RETURN', label: 'Pickup & Return' },
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
  HOME_DELIVERY: 'Home Delivery',
  BETWEEN_LOCATIONS: 'Between Locations',
  SERVICE_PICKUP_RETURN: 'Pickup & Return',
}

// Bottom nav items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home, active: true },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: Menu },
]

export default function DriverDashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const driverId = user?.profileId
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

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    // Clear auth tokens and user data
    clearAuth()
    stopSessionKeepAlive()
    toast.success('Signed out successfully')
    // Navigate to landing page
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
    navigate({ to: `/driver-job-details`, search: { jobId }}) // adjust route as needed
  }

  // Transform API data to UI-friendly array
  const jobs = deliveriesData?.items?.map((item: any) => ({
    id: item.deliveryId,
    urgent: item.isUrgent || false,
    type: serviceTypeLabels[item.serviceType] || item.serviceType,
    date: formatDate(item.pickupWindowStart),
    timeWindow: formatTimeRange(item.pickupWindowStart, item.pickupWindowEnd),
    pickup: item.pickupAddress?.split(',')[0] || item.pickupAddress,
    dropoff: item.dropoffAddress?.split(',')[0] || item.dropoffAddress,
    service: serviceTypeLabels[item.serviceType] || item.serviceType,
    miles: item.pickupDistanceMiles || null, // not trip distance, but we'll show
    duration: formatDuration(item.etaMinutes),
    payout: item.payoutPreviewAmount,
    bonus: item.urgentBonusAmount,
    requirements: [
      { icon: QrCode, label: 'VIN required' },
      { icon: PhotoCamera, label: 'Photos (12)' },
      { icon: Speed, label: 'Odometer' },
    ],
  })) || []

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Top App Bar (unchanged) */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <div className="leading-tight">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
                Driver
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Job Feed
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            <Link
              to="/driver-inbox"
              className="relative w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Inbox"
            >
              <Inbox className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-slate-950 text-[11px] font-black flex items-center justify-center border border-white dark:border-slate-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-28">
        {/* Hero (unchanged) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
                <MapPin className="w-3.5 h-3.5 text-primary font-bold" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700">
                  California Operations Only
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-4 leading-tight">
                Available jobs near you
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
                Browse jobs like an airport board. Book a job to claim it. Pickup and drop-off checklists are required before you can start or complete.
              </p>
            </div>

            <Link
              to="/driver-preferences"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm font-extrabold"
            >
              <Tune className="w-4 h-4 text-primary" />
              Preferences
            </Link>
          </div>

          {/* Filters */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Search */}
                <div className="sm:col-span-5 space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={filters.search}
                      onChange={(e) => updateFilter('search', e.target.value)}
                      className="h-12 w-full pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                      placeholder="City, ZIP, dealer, delivery ID..."
                    />
                  </div>
                </div>

                {/* Radius */}
                <div className="sm:col-span-3 space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Distance
                  </Label>
                  <Select
                    value={filters.radiusMiles}
                    onValueChange={(value) => updateFilter('radiusMiles', value)}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                      <SelectValue placeholder="Within 25 miles" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPTIONS.radiusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Preset */}
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    When
                  </Label>
                  <Select
                    value={filters.datePreset}
                    onValueChange={(value) => updateFilter('datePreset', value)}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                      <SelectValue placeholder="Today" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPTIONS.datePresetOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Type */}
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Service
                  </Label>
                  <Select
                    value={filters.serviceType}
                    onValueChange={(value) => updateFilter('serviceType', value)}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                      <SelectValue placeholder="All services" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPTIONS.serviceTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <Bell className="w-3.5 h-3.5 text-primary mr-1" />
                    Alerts ON
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Map className="w-3.5 h-3.5 text-primary mr-1" />
                    CA Only
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-extrabold"
                  >
                    Clear
                  </Button>
                  
                  <Link
                    to="/driver-preferences"
                    className="sm:hidden inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm font-extrabold"
                  >
                    Preferences
                    <Tune className="w-4 h-4 text-primary" />
                  </Link>

                  <Button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold"
                  >
                    {isFetching ? 'Refreshing...' : 'Refresh'}
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Results respect your service-area preferences (district/city/ZIP/radius) and alert rules.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Job Board */}
        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Job board</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Tap a job to view details, requirements, and book it.
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Sort
              </span>
              <Select
                value={filters.sortBy}
                onValueChange={(value) => updateFilter('sortBy', value)}
              >
                <SelectTrigger className="h-10 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm min-w-[140px]">
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
            <Card className="mt-4 border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading available jobs...</p>
              </div>
            </Card>
          )}

          {isError && (
            <Card className="mt-4 border-red-200 dark:border-red-900 shadow-lg overflow-hidden p-8">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-semibold">Failed to load jobs. Please try again.</p>
              </div>
            </Card>
          )}

          {!isLoading && !isError && jobs.length === 0 && (
            <Card className="mt-4 border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden p-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Inbox className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">No jobs available at the moment.</p>
              </div>
            </Card>
          )}

          {jobs.length > 0 && (
            <Card className="mt-4 border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              {/* Header row - desktop only */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Time</div>
                <div className="col-span-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pickup → Drop-off</div>
                <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Miles</div>
                <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Payout</div>
                <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Action</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleViewJob(job.id)}
                    className="w-full text-left hover:bg-slate-50 dark:hover:bg-slate-950/40 transition cursor-pointer"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 sm:px-6 py-5">
                      {/* Time column */}
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-2">
                          {job.urgent ? (
                            <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold">
                              <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
                              Urgent
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              {job.type}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                          {job.date} • {job.timeWindow}
                        </div>
                      </div>

                      {/* Route column */}
                      <div className="md:col-span-4">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {job.pickup} → {job.dropoff}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                          Service: {job.service}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {job.requirements.map((req, idx) => (
                            <Badge key={idx} variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                              <req.icon className="w-3.5 h-3.5 text-primary mr-1" />
                              {req.label}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Miles column */}
                      <div className="md:col-span-2 flex md:block items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 md:hidden">
                          Miles
                        </div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">
                          {job.miles ? `${job.miles} mi` : '—'}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                          Est. {job.duration}
                        </div>
                      </div>

                      {/* Payout column */}
                      <div className="md:col-span-2 flex md:block items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 md:hidden">
                          Payout
                        </div>
                        <div className="text-lg font-black text-primary">
                          {formatCurrency(job.payout)}
                        </div>
                        {job.bonus > 0 && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                            + {formatCurrency(job.bonus)} bonus
                          </div>
                        )}
                      </div>

                      {/* Action column */}
                      <div className="md:col-span-2 flex items-center justify-between md:justify-end">
                        <div className="md:hidden text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Action
                        </div>
                        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                          View
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {jobs.length} job{jobs.length !== 1 ? 's' : ''} available. Booking is first-come/first-served; if another driver books it first, you'll see "Already booked".
                  </p>
                  <Link
                    to="/driver-preferences"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition text-sm font-extrabold"
                  >
                    Update preferences
                    <Tune className="w-4 h-4 text-primary" />
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </section>

        {/* Tips (unchanged) */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Checklist required
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Before you can start: VIN code + 6 pickup photos + starting odometer.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Verified className="w-5 h-5 text-primary font-bold" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    No cancel in Driver UI
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    If an issue happens, report it and Ops will assist. All actions are logged.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-500 font-bold" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Bottom Navigation (unchanged) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-background-dark/85 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-4 gap-2 py-3">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 relative",
                  item.href === '/driver-dashboard' ? "text-primary" : "text-slate-500 dark:text-slate-400 hover:text-primary transition"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {item.label}
                </span>
                {item.href === '/driver-inbox' && unreadCount > 0 && (
                  <span className="absolute top-0 right-[22%] w-5 h-5 rounded-full bg-primary text-slate-950 text-[11px] font-black flex items-center justify-center border border-white dark:border-slate-900">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}