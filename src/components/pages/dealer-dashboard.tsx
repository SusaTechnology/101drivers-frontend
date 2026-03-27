// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Home,
  Truck,
  Wrench,
  Search,
  Filter,
  RefreshCw,
  Eye,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Hourglass,
  Gavel,
  ArrowLeftRight as SwapHorizontal,
  Bolt,
  User,
  Star,
  Settings,
  Plus,
  Bell,
  ArrowRight,
  Navigation,
  Images,
  Mail,
  Menu,
  X,
  LayoutDashboard as Dashboard,
  Package,
  Navigation as NearMe,
  CheckSquare,
  Calendar,
  Phone,
  Sun,
  Moon,
  LogOut,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, authFetch, clearAuth, stopSessionKeepAlive } from '@/lib/tanstack/dataQuery'
import NotificationBell from '@/components/notifications/NotificationBell'
import LiveTrackingWidget from '@/components/dashboard/LiveTrackingWidget'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Rocket } from 'lucide-react'

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

// Helper to format time window
const formatTimeWindow = (start: string, end: string) => {
  if (!start || !end) return ''
  const startTime = new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const endTime = new Date(end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${startTime}–${endTime}`
}

// Map service type to icon and label
const serviceTypeMap: Record<string, { icon: React.ReactNode; label: string }> = {
  BETWEEN_LOCATIONS: { icon: <Truck className="h-4 w-4" />, label: 'Between Locations' },
  HOME_DELIVERY: { icon: <Home className="h-4 w-4" />, label: 'Home Delivery' },
  SERVICE_PICKUP_RETURN: { icon: <Wrench className="h-4 w-4" />, label: 'Service Pick-up & Return' },
  // fallback
  default: { icon: <Truck className="h-4 w-4" />, label: 'Delivery' },
}

export default function DealerDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeStatus, setActiveStatus] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceType, setServiceType] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [mounted, setMounted] = useState(false)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser();
  const dealerId = user?.profileId;
  const queryClient = useQueryClient();

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

  // Fetch customer profile for header display
  const {
    data: customerProfile,
  } = useDataQuery<{
    id: string;
    businessName: string | null;
    contactName: string;
    contactEmail: string;
    customerType: 'PRIVATE' | 'BUSINESS';
    approvalStatus: string;
    postpaidEnabled: boolean;
  }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${dealerId}`,
    noFilter: true,
    enabled: Boolean(dealerId),
  })

  // Determine if this is a private (individual) or business customer
  const isPrivateCustomer = customerProfile?.customerType === 'PRIVATE';
  const isBusinessCustomer = customerProfile?.customerType === 'BUSINESS';

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
  // requiresAuth: true
  // pagination: { pageIndex: 0, pageSize: 20 },
  // columnFilters: {
  //   status: activeStatus !== 'ALL' ? activeStatus : undefined,
  //   serviceType: serviceType !== 'ALL' ? serviceType : undefined,
  //   dateFrom: dateFrom || undefined,
  //   dateTo: dateTo || undefined,
  // },
  // globalFilter: searchQuery || undefined,
  // enabled: true,
  // staleTime: 5 * 60 * 1000, // 5 minutes
})

// Extract deliveries array from response
// const deliveries = deliveriesData?.data || deliveriesData || []
  // Delivery data
  

   // Transform API data to match table structure
  const deliveries = deliveriesData?.map((item: any) => {
    // Determine which time window to show (pickup or dropoff based on customerChose)
    const scheduleDate = item.customerChose === 'PICKUP_WINDOW' 
      ? formatDate(item.pickupWindowStart)
      : formatDate(item.dropoffWindowStart)
    const scheduleTime = item.customerChose === 'PICKUP_WINDOW'
      ? `Pickup: ${formatTimeWindow(item.pickupWindowStart, item.pickupWindowEnd)}`
      : `Drop-off: ${formatTimeWindow(item.dropoffWindowStart, item.dropoffWindowEnd)}`

    // Map service type
    const serviceInfo = serviceTypeMap[item.serviceType] || serviceTypeMap.default

    // Extract driver info if available (adjust based on actual API structure)
    const driver = item.driver ? {
      name: item.driver.name || 'Driver',
      rating: item.driver.rating,
      verified: item.driver.verified,
      status: item.driver.status,
      proof: item.driver.proof,
    } : null

    return {
      id: item.id,
      ref: item.id.slice(-6).toUpperCase(), // Use last 6 chars as reference
      created: formatDate(item.createdAt),
      service: item.serviceType,
      serviceLabel: serviceInfo.label,
      // category: maybe from somewhere else? We'll omit or use placeholder
      pickup: item.pickupAddress?.split(',')[0] || 'Pickup',
      dropoff: item.dropoffAddress?.split(',')[0] || 'Dropoff',
      scheduleDate,
      scheduleTime,
      miles: item.etaMinutes ? item.etaMinutes : '—', // etaMinutes is minutes, not miles; we'll show minutes as placeholder
      price: item.quote?.estimatedAmount || item.payment?.amount || '—',
      priceType: item.payment ? 'Final' : 'Est.',
      status: item.status,
      urgent: item.isUrgent || false,
      driver,
    }
  }) || []

  // Filter deliveries (based on transformed data)
// Note: DRAFT status is excluded from main dashboard - drafts have their own page
const filteredDeliveries = deliveries.filter((delivery) => {
  // Exclude DRAFT status from main list
  if (delivery.status === 'DRAFT') return false;
  if (activeStatus !== 'ALL' && delivery.status !== activeStatus) return false;
  if (serviceType !== 'ALL' && delivery.service !== serviceType) return false;
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    if (
      !delivery.ref.toLowerCase().includes(query) &&
      !delivery.pickup.toLowerCase().includes(query) &&
      !delivery.dropoff.toLowerCase().includes(query)
    ) return false;
  }

  // Date filtering
  if (dateFrom && delivery.scheduleDate < dateFrom) return false;
  if (dateTo && delivery.scheduleDate > dateTo) return false;

  return true;
});

  // Status badge component
  const StatusBadge = ({ status, urgent }: { status: string; urgent?: boolean }) => {
    const config: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      DRAFT: {
        label: 'Draft',
        icon: <FileText className="h-3 w-3" />,
        variant: 'outline',
      },
      QUOTED: {
        label: 'Quoted',
        icon: <FileText className="h-3 w-3" />,
        variant: 'secondary',
      },
      LISTED: {
        label: 'Listed',
        icon: <Package className="h-3 w-3" />,
        variant: 'secondary',
      },
      BOOKED: {
        label: 'Booked',
        icon: <CheckCircle className="h-3 w-3" />,
        variant: 'default',
      },
      ACTIVE: {
        label: 'Active',
        icon: <NearMe className="h-3 w-3" />,
        variant: 'default',
      },
      COMPLETED: {
        label: 'Completed',
        icon: <CheckSquare className="h-3 w-3" />,
        variant: 'default',
      },
      EXPIRED: {
        label: 'Expired',
        icon: <Hourglass className="h-3 w-3" />,
        variant: 'secondary',
      },
      CANCELLED: {
        label: 'Cancelled',
        icon: <XCircle className="h-3 w-3" />,
        variant: 'destructive',
      },
      DISPUTED: {
        label: 'Disputed',
        icon: <Gavel className="h-3 w-3" />,
        variant: 'outline',
      },
      REASSIGNED: {
        label: 'Reassigned',
        icon: <SwapHorizontal className="h-3 w-3" />,
        variant: 'outline',
      },
    }

    const configItem = config[status] || {
      label: status,
      icon: null,
      variant: 'outline' as const,
    }

    return (
      <div className="flex items-center gap-2">
        <Badge variant={configItem.variant} className="gap-1">
          {configItem.icon}
          {configItem.label}
        </Badge>
        {urgent && (
          <Badge variant="default" className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 gap-1">
            <Bolt className="h-3 w-3" />
            Urgent
          </Badge>
        )}
      </div>
    )
  }

  // Service icon component
  const ServiceIcon = ({ service }: { service: string }) => {
    switch (service) {
      case 'HOME':
        return <Home className="h-4 w-4" />
      case 'BETWEEN':
        return <Truck className="h-4 w-4" />
      case 'SERVICE':
        return <Wrench className="h-4 w-4" />
      default:
        return <Truck className="h-4 w-4" />
    }
  }

  // Header component
  const Header = () => (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center" aria-label="101 Drivers">
            <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              {isPrivateCustomer ? 'Customer Portal' : 'Dealer Portal'}
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {isPrivateCustomer ? 'My Deliveries' : 'Delivery Dashboard'}
            </span>
          </div>

          <div
            className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-500/10 text-slate-900 border border-lime-500/25 ml-2"
            title="California-only (MVP)"
          >
            <CheckCircle className="h-3 w-3 font-bold text-lime-500" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700">CA ONLY</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          
          {/* Theme Toggle */}
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

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Link
            to="/dealer-settings"
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <User className="h-5 w-5 text-lime-500" />
            <div className="leading-tight">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                {isPrivateCustomer 
                  ? (user?.username || 'Customer')
                  : (customerProfile?.businessName || user?.username || 'Dealer')
                }
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                {customerProfile?.contactEmail || user?.username || ''}
              </div>
            </div>
          </Link>

          {/* Sign Out Button */}
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/dealer-create-delivery"
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors"
            >
              Create Delivery
            </Link>
            <Link
               to="/dealer-settings"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Settings
            </Link>
            <Link
              to="/"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Public Site
            </Link>
            <Separator className="my-2" />
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              {mounted && theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  Dark Mode
                </>
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <Separator className="my-2" />
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              CA-only MVP • Email-first notifications
            </div>
          </div>
        </div>
      )}
    </header>
  )

  // Footer component
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
              {isPrivateCustomer ? 'Customer Portal' : 'Dealer Portal'} • California-only operations • Email-first notifications
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">© {new Date().getFullYear()} 101 Drivers Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )

  // Release to market mutation
  const releaseToMarketMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      return authFetch(
        `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/release-to-marketplace`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    },
    onSuccess: (_, deliveryId) => {
      toast.success('Released to market', { 
        description: 'Your delivery is now visible to drivers. You will be notified when a driver books it.' 
      })
      setReleasingId(null)
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      refetch()
    },
    onError: (error: Error, deliveryId) => {
      toast.error('Failed to release to market', { description: error.message })
      setReleasingId(null)
    }
  })

  // Handle release to market
  const handleReleaseToMarket = (deliveryId: string) => {
    setReleasingId(deliveryId)
    releaseToMarketMutation.mutate(deliveryId)
  }

  // Status tabs
  const statusTabs = [
    { id: 'ALL', label: 'All', icon: <Dashboard className="h-4 w-4" /> },
    { id: 'QUOTED', label: 'Quoted', icon: <FileText className="h-4 w-4" /> },
    { id: 'LISTED', label: 'Listed', icon: <Package className="h-4 w-4" /> },
    { id: 'BOOKED', label: 'Booked', icon: <CheckCircle className="h-4 w-4" /> },
    { id: 'ACTIVE', label: 'Active', icon: <NearMe className="h-4 w-4" /> },
    { id: 'COMPLETED', label: 'Completed', icon: <CheckSquare className="h-4 w-4" /> },
    { id: 'EXPIRED', label: 'Expired', icon: <Hourglass className="h-4 w-4" /> },
    { id: 'CANCELLED', label: 'Cancelled', icon: <XCircle className="h-4 w-4" /> },
    { id: 'DISPUTED', label: 'Disputed', icon: <Gavel className="h-4 w-4" /> },
    { id: 'REASSIGNED', label: 'Reassigned', icon: <SwapHorizontal className="h-4 w-4" /> },
  ]

  const resetFilters = () => {
    setActiveStatus('ALL')
    setSearchQuery('')
    setServiceType('ALL')
    setDateFrom('')
    setDateTo('')
  }
  if (isLoading || isFetching) {
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />
      
      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        {/* Page header */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Your deliveries
            </h1>
            <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
              Track status across the lifecycle <span className="font-bold">Listed → Booked → Active → Completed</span>.
              Exceptions like Cancelled/Expired/Disputed/Reassigned may appear, and "Urgent" is shown as a flag.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/dealer-drafts"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-extrabold"
            >
              <FileText className="h-4 w-4 text-slate-500" />
              Drafts
            </Link>
            <Link
              to="/dealer-create-delivery"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20 transition font-extrabold"
            >
              <Plus className="h-4 w-4" />
              New Delivery
            </Link>
            {/* <Link
               to="/dealer-settings"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition font-extrabold"
            >
              <Bell className="h-4 w-4" />
              Notification Settings
            </Link> */}
          </div>
        </section>

        {/* Live Tracking Section - Show for ACTIVE deliveries */}
        {deliveriesData?.filter((d: any) => d.status === 'ACTIVE').length > 0 && (
          <section className="mt-8">
            <div className="space-y-4">
              {deliveriesData
                .filter((d: any) => d.status === 'ACTIVE')
                .map((activeDelivery: any) => {
                  const assignment = activeDelivery.assignments?.[0]
                  const driver = assignment?.driver
                  
                  return (
                    <LiveTrackingWidget
                      key={activeDelivery.id}
                      deliveryId={activeDelivery.id}
                      deliveryRef={activeDelivery.id.slice(-6).toUpperCase()}
                      vehicle={{
                        make: activeDelivery.vehicleMake,
                        model: activeDelivery.vehicleModel,
                        color: activeDelivery.vehicleColor,
                        licensePlate: activeDelivery.licensePlate,
                      }}
                      pickup={{
                        address: activeDelivery.pickupAddress,
                        lat: activeDelivery.pickupLat,
                        lng: activeDelivery.pickupLng,
                      }}
                      dropoff={{
                        address: activeDelivery.dropoffAddress,
                        lat: activeDelivery.dropoffLat,
                        lng: activeDelivery.dropoffLng,
                      }}
                      driver={driver ? {
                        name: driver.user?.fullName || driver.name || 'Driver',
                        phone: driver.phone,
                        rating: driver.rating,
                      } : undefined}
                    />
                  )
                })}
            </div>
          </section>
        )}

        {/* Status tabs */}
        <section className="mt-8">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeStatus === tab.id ? "default" : "outline"}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest h-auto",
                  activeStatus === tab.id ? "bg-lime-500 text-slate-950" : ""
                )}
                onClick={() => setActiveStatus(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
          </div>
        </section>

        {/* Filters */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                <div className="lg:col-span-4">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Search</Label>
                  <div className="mt-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="w-full h-12 pl-12 pr-4 rounded-2xl text-sm"
                      placeholder="Search by reference, pickup city, drop-off city..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Service Type</Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger className="mt-2 h-12 rounded-2xl text-sm">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="HOME">Home Delivery</SelectItem>
                      <SelectItem value="BETWEEN">Between Locations</SelectItem>
                      <SelectItem value="SERVICE">Service Pick-up & Return</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date From</Label>
                  <Input
                    type="date"
                    className="mt-2 h-12 rounded-2xl text-sm"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="lg:col-span-2">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date To</Label>
                  <Input
                    type="date"
                    className="mt-2 h-12 rounded-2xl text-sm"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                <div className="lg:col-span-2 flex gap-2">
                  <Button
                    className="flex-1 h-12 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20"
                    onClick={() => {/* Apply filters logic */}}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 rounded-2xl"
                    onClick={resetFilters}
                    title="Reset"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Deliveries are sorted by scheduled time window. Use filters to find specific deliveries quickly.
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Desktop table */}
        <section className="mt-6 hidden lg:block">
          <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Deliveries</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sorted by scheduled time window</p>
              </div>
              <Badge variant="secondary" className="gap-2">
                <Mail className="h-3 w-3" />
                <span className="text-[11px] font-black uppercase tracking-widest">Email-first</span>
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Ref</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Service</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Pickup → Drop-off</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Schedule (US)</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Miles</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Price</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black">Driver</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-widest font-black text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <div className="font-black text-slate-900 dark:text-white">{delivery.ref}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                            Created: {delivery.created}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ServiceIcon service={delivery.service} />
                            <div>
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {delivery.serviceLabel}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                {delivery.category}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {delivery.pickup}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                            → {delivery.dropoff}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {delivery.scheduleDate}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                            {delivery.scheduleTime}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            {delivery.miles}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">mi</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            ${delivery.price}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                            {delivery.priceType}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={delivery.status} urgent={delivery.urgent} />
                        </TableCell>
                        <TableCell>
                          {delivery.driver ? (
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                <User className="h-4 w-4 text-lime-500" />
                              </div>
                              <div className="leading-tight">
                                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                                  {delivery.driver.name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                  {delivery.driver.rating ? `${delivery.driver.rating} ★ • Verified` : delivery.driver.status || delivery.driver.proof}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Hidden</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                Shown after booking
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {delivery.status === 'QUOTED' && (
                              <Button
                                onClick={() => handleReleaseToMarket(delivery.id)}
                                disabled={releasingId === delivery.id}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-500 text-slate-950 font-extrabold hover:bg-lime-600"
                              >
                                {releasingId === delivery.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950"></div>
                                    Releasing...
                                  </>
                                ) : (
                                  <>
                                    <Rocket className="h-4 w-4" />
                                    Release
                                  </>
                                )}
                              </Button>
                            )}
                            <Link
                               to="/dealer-delivery-details"
                               state={{ id: delivery.id}}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition"
                            >
                              {delivery.status === 'ACTIVE' ? 'Track' : delivery.status === 'COMPLETED' ? 'View Proof' : 'View'}
                              {delivery.status === 'ACTIVE' ? (
                                <Navigation className="h-4 w-4" />
                              ) : delivery.status === 'COMPLETED' ? (
                                <Images className="h-4 w-4" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-400 font-semibold">
                  Showing <span className="text-slate-900 dark:text-white font-black">{filteredDeliveries.length}</span> deliveries
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full">
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full">
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Mobile cards */}
        <section className="mt-6 lg:hidden space-y-4">
          {filteredDeliveries.map((delivery) => (
            <Card key={delivery.id} className="rounded-3xl hover:shadow-xl transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">{delivery.ref}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      {delivery.scheduleDate} • {delivery.scheduleTime.split(': ')[1]}
                    </div>
                  </div>
                  <StatusBadge status={delivery.status} urgent={delivery.urgent} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4">
                      <div className="text-[11px] uppercase tracking-widest text-slate-400 font-black">Route</div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {delivery.pickup.split(',')[0]}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        → {delivery.dropoff.split(',')[0]}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4">
                      <div className="text-[11px] uppercase tracking-widest text-slate-400 font-black">Miles / Price</div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                        {delivery.miles} mi
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        ${delivery.price} {delivery.priceType.toLowerCase()}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    Driver:{' '}
                    <span className="font-black">
                      {delivery.driver
                        ? `${delivery.driver.name}${delivery.driver.rating ? ` (${delivery.driver.rating} ★)` : ''}`
                        : 'Hidden until booked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {delivery.status === 'QUOTED' && (
                      <Button
                        onClick={() => handleReleaseToMarket(delivery.id)}
                        disabled={releasingId === delivery.id}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-500 text-slate-950 font-extrabold hover:bg-lime-600"
                      >
                        {releasingId === delivery.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-950"></div>
                            Releasing...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4" />
                            Release
                          </>
                        )}
                      </Button>
                    )}
                    <Link
                      to="/dealer-delivery-details"
                      state={{ id: delivery.id }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition"
                    >
                      {delivery.status === 'ACTIVE' ? 'Track' : delivery.status === 'COMPLETED' ? 'View Proof' : 'View'}
                      {delivery.status === 'ACTIVE' ? (
                        <Navigation className="h-4 w-4" />
                      ) : delivery.status === 'COMPLETED' ? (
                        <Images className="h-4 w-4" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
      
      <Footer />
    </div>
  )
}