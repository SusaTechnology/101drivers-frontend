// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Home,
  Truck,
  Wrench,
  Search,
  Plus,
  MapPin,
  Flag,
  Clock,
  CheckCircle,
  User,
  Navigation,
  Package,
  Calendar,
  Phone,
  Sun,
  Moon,
  LogOut,
  FileText,
  History,
  Eye,
  EyeOff,
  Bell,
  Menu,
  X,
  Car,
  ChevronRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, authFetch, clearAuth, stopSessionKeepAlive } from '@/lib/tanstack/dataQuery'
import NotificationBell from '@/components/notifications/NotificationBell'
import { useMutation, useQueryClient } from '@tanstack/react-query'

// Helper functions
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const formatTimeWindow = (start: string, end: string) => {
  if (!start || !end) return ''
  return `${formatTime(start)} – ${formatTime(end)}`
}

// Status configuration with colors
const statusConfig = {
  LISTED: {
    label: 'Listed',
    color: 'slate',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    textColor: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
  BOOKED: {
    label: 'Booked',
    color: 'blue',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
  },
  ACTIVE: {
    label: 'Active',
    color: 'lime',
    bgColor: 'bg-lime-50 dark:bg-lime-950/30',
    textColor: 'text-lime-600 dark:text-lime-400',
    borderColor: 'border-lime-200 dark:border-lime-800',
    dotColor: 'bg-lime-500',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'green',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'red',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
  EXPIRED: {
    label: 'Expired',
    color: 'amber',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
}

// Service type icons
const serviceIcons = {
  HOME_DELIVERY: <Home className="h-4 w-4" />,
  BETWEEN_LOCATIONS: <Truck className="h-4 w-4" />,
  SERVICE_PICKUP_RETURN: <Wrench className="h-4 w-4" />,
}

export default function DealerDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'ACTIVE' | 'LISTED' | 'BOOKED' | 'HISTORY'>('ACTIVE')
  const [showAll, setShowAll] = useState(true) // All/My toggle - default to All
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const dealerId = user?.profileId
  const queryClient = useQueryClient()

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

  // Fetch customer profile
  const { data: customerProfile } = useDataQuery<{
    id: string
    businessName: string | null
    contactName: string
    contactEmail: string
    customerType: 'PRIVATE' | 'BUSINESS'
    approvalStatus: string
    postpaidEnabled: boolean
  }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${dealerId}`,
    noFilter: true,
    enabled: Boolean(dealerId),
  })

  const isPrivateCustomer = customerProfile?.customerType === 'PRIVATE'

  // Fetch deliveries
  const {
    data: deliveriesData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${dealerId}/deliveries`,
    noFilter: true,
    enabled: Boolean(dealerId)
  })

  // Transform and filter deliveries
  const deliveries = useMemo(() => {
    if (!deliveriesData) return []
    
    return deliveriesData
      .filter((item: any) => item.status !== 'DRAFT') // Exclude drafts
      .map((item: any) => {
        const assignment = item.assignments?.[0]
        const driver = assignment?.driver ? {
          id: assignment.driver.id,
          name: assignment.driver.user?.fullName || assignment.driver.name || 'Driver',
          phone: assignment.driver.phone,
          rating: assignment.driver.rating,
          avatar: assignment.driver.user?.avatar || assignment.driver.avatar,
          verified: assignment.driver.status === 'APPROVED',
        } : null

        // Get schedule display
        const scheduleDate = item.customerChose === 'PICKUP_WINDOW'
          ? formatDate(item.pickupWindowStart)
          : formatDate(item.dropoffWindowStart)
        const scheduleTime = item.customerChose === 'PICKUP_WINDOW'
          ? formatTimeWindow(item.pickupWindowStart, item.pickupWindowEnd)
          : formatTimeWindow(item.dropoffWindowStart, item.dropoffWindowEnd)

        // Get car photo from proofs (if active/completed)
        const carPhoto = item.proofs?.find(p => p.type === 'PICKUP_START' || p.type === 'PICKUP_PHOTO')?.photoUrl

        return {
          id: item.id,
          ref: item.id.slice(-6).toUpperCase(),
          status: item.status,
          serviceType: item.serviceType,
          vehicle: {
            make: item.vehicleMake,
            model: item.vehicleModel,
            color: item.vehicleColor,
            licensePlate: item.licensePlate,
          },
          pickup: item.pickupAddress?.split(',')[0] || 'Pickup',
          pickupFull: item.pickupAddress,
          dropoff: item.dropoffAddress?.split(',')[0] || 'Dropoff',
          dropoffFull: item.dropoffAddress,
          scheduleDate,
          scheduleTime,
          pickupWindowStart: item.pickupWindowStart,
          price: item.quote?.estimatedPrice || item.payment?.amount,
          driver,
          carPhoto,
          createdById: item.createdBy || item.customer?.id, // For All/My filtering
        }
      })
  }, [deliveriesData])

  // Filter by status tab
  const filteredDeliveries = useMemo(() => {
    let result = deliveries

    // Filter by status tab
    if (activeFilter === 'ACTIVE') {
      result = result.filter(d => d.status === 'ACTIVE')
    } else if (activeFilter === 'LISTED') {
      result = result.filter(d => d.status === 'LISTED' || d.status === 'QUOTED')
    } else if (activeFilter === 'BOOKED') {
      result = result.filter(d => d.status === 'BOOKED')
    } else if (activeFilter === 'HISTORY') {
      result = result.filter(d => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(d.status))
    }

    // Filter by All/My toggle (if My, show only current user's deliveries)
    if (!showAll && dealerId) {
      result = result.filter(d => d.createdById === dealerId)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(d => 
        d.ref.toLowerCase().includes(query) ||
        d.vehicle.licensePlate?.toLowerCase().includes(query) ||
        d.vehicle.make?.toLowerCase().includes(query) ||
        d.vehicle.model?.toLowerCase().includes(query) ||
        d.pickup.toLowerCase().includes(query) ||
        d.dropoff.toLowerCase().includes(query) ||
        d.driver?.name?.toLowerCase().includes(query)
      )
    }

    return result
  }, [deliveries, activeFilter, showAll, searchQuery, dealerId])

  // Pull to refresh handler
  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading deliveries...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load deliveries</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
          <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950">Retry</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {isPrivateCustomer ? 'My Deliveries' : 'Delivery Dashboard'}
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* All/My Toggle */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className={cn("text-xs font-bold transition-colors", !showAll ? "text-lime-600" : "text-slate-400")}>My</span>
              <Switch
                checked={showAll}
                onCheckedChange={setShowAll}
                className="data-[state=checked]:bg-lime-500"
              />
              <span className={cn("text-xs font-bold transition-colors", showAll ? "text-lime-600" : "text-slate-400")}>All</span>
            </div>

            <NotificationBell />

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl"
              onClick={toggleTheme}
            >
              {mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden w-10 h-10 rounded-xl"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="max-w-[980px] mx-auto px-4 py-4 space-y-3">
              {/* All/My Toggle - Mobile */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-sm font-bold">View Mode</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold", !showAll && "text-lime-600")}>My</span>
                  <Switch checked={showAll} onCheckedChange={setShowAll} className="data-[state=checked]:bg-lime-500" />
                  <span className={cn("text-xs font-bold", showAll && "text-lime-600")}>All</span>
                </div>
              </div>
              
              <Link to="/dealer-drafts" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">
                <FileText className="h-4 w-4 inline mr-2" />
                Drafts
              </Link>
              <Link to="/dealer-settings" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">
                <User className="h-4 w-4 inline mr-2" />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 font-bold text-left"
              >
                <LogOut className="h-4 w-4 inline mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Search Bar */}
      <div className="sticky top-16 z-40 bg-slate-50 dark:bg-slate-950 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              className="w-full h-12 pl-12 pr-12 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              placeholder="Search by VIN, plate, driver name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isFetching && (
              <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 animate-spin" />
            )}
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="px-4 py-3">
        <div className="max-w-[980px] mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'ACTIVE', label: 'Active', icon: <Navigation className="h-4 w-4" />, count: deliveries.filter(d => d.status === 'ACTIVE').length },
              { id: 'LISTED', label: 'Listed', icon: <Package className="h-4 w-4" />, count: deliveries.filter(d => ['LISTED', 'QUOTED'].includes(d.status)).length },
              { id: 'BOOKED', label: 'Booked', icon: <CheckCircle className="h-4 w-4" />, count: deliveries.filter(d => d.status === 'BOOKED').length },
              { id: 'HISTORY', label: 'History', icon: <History className="h-4 w-4" />, count: deliveries.filter(d => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(d.status)).length },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={activeFilter === tab.id ? "default" : "outline"}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full h-auto shrink-0",
                  activeFilter === tab.id 
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                    : "bg-white dark:bg-slate-900"
                )}
                onClick={() => setActiveFilter(tab.id)}
              >
                {tab.icon}
                <span className="font-bold">{tab.label}</span>
                {tab.count > 0 && (
                  <Badge variant="secondary" className="ml-1 px-2 py-0.5 text-xs rounded-full">
                    {tab.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <main className="px-4 py-2">
        <div className="max-w-[980px] mx-auto space-y-4">
          {filteredDeliveries.length === 0 ? (
            // Empty State
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  {activeFilter === 'ACTIVE' ? (
                    <Navigation className="h-8 w-8 text-slate-400" />
                  ) : activeFilter === 'HISTORY' ? (
                    <History className="h-8 w-8 text-slate-400" />
                  ) : (
                    <Package className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  No {activeFilter.toLowerCase()} deliveries
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {activeFilter === 'ACTIVE' 
                    ? "You don't have any active deliveries right now"
                    : activeFilter === 'HISTORY'
                    ? "Completed and past deliveries will appear here"
                    : "Create a new delivery to get started"}
                </p>
                {activeFilter !== 'HISTORY' && (
                  <Link
                    to="/dealer-create-delivery"
                    className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-600 transition"
                  >
                    <Plus className="h-5 w-5" />
                    New Delivery
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            // Delivery Cards
            filteredDeliveries.map((delivery) => {
              const config = statusConfig[delivery.status] || statusConfig.LISTED
              
              return (
                <Card 
                  key={delivery.id}
                  className={cn(
                    "border-2 rounded-3xl overflow-hidden transition-all hover:shadow-lg",
                    config.borderColor,
                    delivery.status === 'ACTIVE' && "ring-2 ring-lime-500/20"
                  )}
                >
                  {/* Status Header */}
                  <div className={cn("px-4 py-2 flex items-center justify-between", config.bgColor)}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2.5 h-2.5 rounded-full", config.dotColor, delivery.status === 'ACTIVE' && "animate-pulse")} />
                      <span className={cn("text-sm font-black uppercase tracking-wider", config.textColor)}>
                        {config.label}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      #{delivery.ref}
                    </span>
                  </div>

                  <CardContent className="p-4">
                    {/* Vehicle Info */}
                    <div className="flex items-start gap-4">
                      {/* Car Photo or Placeholder */}
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {delivery.carPhoto ? (
                          <img 
                            src={delivery.carPhoto} 
                            alt={`${delivery.vehicle.color} ${delivery.vehicle.make}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Car className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                      </div>

                      {/* Vehicle Details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-900 dark:text-white truncate">
                          {[delivery.vehicle.make, delivery.vehicle.model]
                            .filter(Boolean)
                            .join(' ') || 'Unknown Vehicle'}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {delivery.vehicle.color} • {delivery.vehicle.licensePlate || 'No plate'}
                        </div>

                        {/* Route */}
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-lime-500 shrink-0" />
                          <span className="truncate text-slate-600 dark:text-slate-300">{delivery.pickup}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Flag className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="truncate text-slate-600 dark:text-slate-300">{delivery.dropoff}</span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{delivery.scheduleDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{delivery.scheduleTime}</span>
                      </div>
                    </div>

                    {/* Driver Info (if booked or active) */}
                    {delivery.driver && (
                      <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-lime-500">
                            <AvatarImage src={delivery.driver.avatar} alt={delivery.driver.name} />
                            <AvatarFallback className="bg-lime-100 text-lime-700 font-bold">
                              {delivery.driver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {delivery.driver.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              {delivery.driver.rating && (
                                <>
                                  <Sparkles className="h-3 w-3 text-amber-500" />
                                  <span>{delivery.driver.rating.toFixed(1)}</span>
                                </>
                              )}
                              {delivery.driver.verified && (
                                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 border-lime-500 text-lime-600">
                                  Verified
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <a 
                          href={`tel:${delivery.driver.phone}`}
                          className="w-10 h-10 rounded-xl bg-lime-500 flex items-center justify-center text-slate-950 hover:bg-lime-600 transition"
                        >
                          <Phone className="h-5 w-5" />
                        </a>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 flex gap-2">
                      {delivery.status === 'ACTIVE' ? (
                        <Link
                          to="/dealer-delivery-details"
                          state={{ id: delivery.id }}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-600 transition"
                        >
                          <Navigation className="h-5 w-5" />
                          Track Live
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      ) : delivery.status === 'BOOKED' ? (
                        <Link
                          to="/dealer-delivery-details"
                          state={{ id: delivery.id }}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition"
                        >
                          <Eye className="h-5 w-5" />
                          View Details
                        </Link>
                      ) : delivery.status === 'LISTED' || delivery.status === 'QUOTED' ? (
                        <>
                          <Link
                            to="/dealer-delivery-details"
                            state={{ id: delivery.id }}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                          >
                            <EyeOff className="h-5 w-5" />
                            Waiting for Driver
                          </Link>
                        </>
                      ) : (
                        <Link
                          to="/dealer-delivery-details"
                          state={{ id: delivery.id }}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                        >
                          View Details
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-area-pb">
        <div className="max-w-[980px] mx-auto px-4">
          <div className="flex items-center justify-around h-16">
            <Link
              to="/dealer-create-delivery"
              className="flex flex-col items-center gap-1 py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-lime-600 dark:hover:text-lime-400 transition"
            >
              <Plus className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Create</span>
            </Link>
            
            <Link
              to="/dealer-dashboard"
              className="flex flex-col items-center gap-1 py-2 px-4 text-lime-600 dark:text-lime-400"
            >
              <Navigation className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
            </Link>
            
            <Link
              to="/dealer-drafts"
              className="flex flex-col items-center gap-1 py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-lime-600 dark:hover:text-lime-400 transition"
            >
              <FileText className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Drafts</span>
            </Link>
            
            <Link
              to="/dealer-settings"
              className="flex flex-col items-center gap-1 py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-lime-600 dark:hover:text-lime-400 transition"
            >
              <User className="h-6 w-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Floating Action Button */}
      <Link
        to="/dealer-create-delivery"
        className="fixed right-4 bottom-20 w-14 h-14 rounded-2xl bg-lime-500 text-slate-950 flex items-center justify-center shadow-lg shadow-lime-500/30 hover:bg-lime-600 hover:scale-105 transition-all z-40 sm:hidden"
      >
        <Plus className="h-7 w-7" />
      </Link>
    </div>
  )
}
