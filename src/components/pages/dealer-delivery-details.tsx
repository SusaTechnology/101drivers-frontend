// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, useLocation } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { useJsApiLoader } from '@react-google-maps/api'
import RouteMap from '@/components/map/RouteMap'
import {
  ArrowLeft,
  Plus,
  Menu,
  X,
  Truck,
  MapPin,
  Ruler,
  Clock,
  Home,
  Wrench,
  Navigation,
  CheckCircle,
  Hourglass,
  Package,
  CheckSquare,
  Download,
  Edit,
  Phone,
  MessageCircle,
  Star,
  Shield,
  QrCode,
  Gauge,
  Camera,
  Map,
  Mail,
  MessageSquare,
  Send,
  Settings,
  AlertCircle,
  User,
  ShieldCheck,
  FileText,
  Calendar,
  CreditCard,
  Headphones,
  Flag,
  Target,
  Award,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'

// Helper to format date
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const formatDateTime = (dateString: string) => {
  if (!dateString) return ''
  return `${formatDate(dateString)} ${formatTime(dateString)}`
}

// Map service type to icon and label
const serviceTypeMap: Record<string, { icon: React.ReactNode; label: string }> = {
  BETWEEN_LOCATIONS: { icon: <Truck className="h-4 w-4" />, label: 'Between Locations' },
  HOME_DELIVERY: { icon: <Home className="h-4 w-4" />, label: 'Home Delivery' },
  SERVICE_PICKUP_RETURN: { icon: <Wrench className="h-4 w-4" />, label: 'Service Pick-up & Return' },
  default: { icon: <Truck className="h-4 w-4" />, label: 'Delivery' },
}

export default function DealerDeliveryDetails() {
  const { state } = useLocation()
const id = state?.id
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)

  const user = getUser()
  const dealerId = user?.profileId

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places'],
  })

  // Fetch delivery details
  const {
    data: deliveryData,
    isLoading,
    isError,
    error,
    refetch
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${dealerId}/deliveries/${id}`,
    noFilter: true,
    enabled: !!dealerId && !!id,
  })

  // Geocode addresses when data is loaded
  useEffect(() => {
    if (!isLoaded || !deliveryData) return

    const geocoder = new google.maps.Geocoder()

    if (deliveryData.pickupAddress) {
      geocoder.geocode({ address: deliveryData.pickupAddress }, (results, status) => {
        if (status === 'OK' && results && results[0].geometry.location) {
          const location = results[0].geometry.location
          setPickupCoords({ lat: location.lat(), lng: location.lng() })
        } else {
          console.error('Geocode failed for pickup address')
        }
      })
    }

    if (deliveryData.dropoffAddress) {
      geocoder.geocode({ address: deliveryData.dropoffAddress }, (results, status) => {
        if (status === 'OK' && results && results[0].geometry.location) {
          const location = results[0].geometry.location
          setDropoffCoords({ lat: location.lat(), lng: location.lng() })
        } else {
          console.error('Geocode failed for dropoff address')
        }
      })
    }
  }, [isLoaded, deliveryData])

  // Derive schedule display based on customerChose
  const scheduleDisplay = (() => {
    if (!deliveryData) return { date: '—', time: '—' }
    if (deliveryData.customerChose === 'PICKUP_WINDOW' && deliveryData.pickupWindowStart && deliveryData.pickupWindowEnd) {
      return {
        date: formatDate(deliveryData.pickupWindowStart),
        time: `Pickup: ${formatTime(deliveryData.pickupWindowStart)} – ${formatTime(deliveryData.pickupWindowEnd)}`
      }
    } else if (deliveryData.customerChose === 'DROPOFF_WINDOW' && deliveryData.dropoffWindowStart && deliveryData.dropoffWindowEnd) {
      return {
        date: formatDate(deliveryData.dropoffWindowStart),
        time: `Drop-off: ${formatTime(deliveryData.dropoffWindowStart)} – ${formatTime(deliveryData.dropoffWindowEnd)}`
      }
    } else {
      return { date: '—', time: '—' }
    }
  })()

  // Build vehicle string
  const vehicleString = deliveryData
    ? [deliveryData.vehicleYear, deliveryData.vehicleMake, deliveryData.vehicleModel, deliveryData.vehicleColor]
        .filter(Boolean).join(' ') || 'Not provided'
    : '—'

  // Price
  const price = deliveryData?.payment?.amount || deliveryData?.quote?.estimatedAmount
  const priceType = deliveryData?.payment ? 'Final' : (deliveryData?.quote ? 'Est.' : '—')

  // Timeline based on status and timestamps
  const timelineItems = [
    {
      status: 'Request submitted',
      time: deliveryData?.createdAt ? formatDateTime(deliveryData.createdAt) : '—',
      completed: !!deliveryData?.createdAt,
      icon: CheckCircle,
    },
    {
      status: 'Booked (driver assigned)',
      time: deliveryData?.bookedAt ? formatDateTime(deliveryData.bookedAt) : (deliveryData?.status !== 'LISTED' ? 'Pending' : '—'),
      completed: deliveryData?.status !== 'LISTED',
      icon: Hourglass,
    },
    {
      status: 'Active (pickup → in transit)',
      time: deliveryData?.activeAt ? formatDateTime(deliveryData.activeAt) : (deliveryData?.status === 'ACTIVE' || deliveryData?.status === 'COMPLETED' ? 'In progress' : '—'),
      completed: deliveryData?.status === 'ACTIVE' || deliveryData?.status === 'COMPLETED',
      icon: Package,
    },
    {
      status: 'Completed',
      time: deliveryData?.completedAt ? formatDateTime(deliveryData.completedAt) : (deliveryData?.status === 'COMPLETED' ? 'Completed' : '—'),
      completed: deliveryData?.status === 'COMPLETED',
      icon: CheckSquare,
    },
  ]

  // Driver info (if available)
  const driver = deliveryData?.driver ? {
    name: deliveryData.driver.name || 'Driver',
    rating: deliveryData.driver.rating || '—',
    deliveries: deliveryData.driver.deliveryCount || '—',
    verified: deliveryData.driver.verified || false,
    phone: deliveryData.driver.phone || '—',
  } : null

  // Proofs data
  const proofs = {
    vin: deliveryData?.vinVerificationCode || '—',
    odometerStart: deliveryData?.compliance?.odometerStart || '—',
    odometerEnd: deliveryData?.compliance?.odometerEnd || '—',
    trackingStatus: deliveryData?.trackingSession ? 'Started' : 'Not started',
    trackingStart: deliveryData?.trackingSession?.startedAt ? formatDateTime(deliveryData.trackingSession.startedAt) : '—',
    trackingEnd: deliveryData?.trackingSession?.endedAt ? formatDateTime(deliveryData.trackingSession.endedAt) : '—',
  }

  // Messages (static for prototype)
  const [messages, setMessages] = useState([
    { sender: 'driver', text: 'Hi! I\'m on my way to pickup. I\'ll confirm VIN last-4 and take photos.', time: '10:45 AM' },
    { sender: 'you', text: 'Great—please keep us posted. Thanks!', time: '10:50 AM' },
  ])
  const [newMessage, setNewMessage] = useState('')

  // Status badge component (same as before)
  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'BOOKED':
          return {
            label: 'Booked',
            icon: Hourglass,
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
            icon: CheckSquare,
            variant: 'default' as const,
            className: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-200 dark:border-emerald-900/30',
          }
        case 'LISTED':
          return {
            label: 'Listed',
            icon: Package,
            variant: 'outline' as const,
            className: '',
          }
        default:
          return {
            label: status,
            icon: Package,
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

  // Header component (unchanged except for dynamic dealer name)
  const Header = () => (
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
            <Plus className="h-4 w-4" />
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

  // Footer (unchanged)
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading delivery details...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Error state
  if (isError || !deliveryData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load delivery</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
            <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950">Retry</Button>
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
              <Truck className="h-6 w-6 text-lime-500" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                  Delivery #{deliveryData.id?.slice(-6).toUpperCase() || id?.slice(-6).toUpperCase()}
                </h1>

                <StatusBadge status={deliveryData.status} />

                <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest">
                  <MapPin className="h-3 w-3" />
                  CA Only
                </Badge>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Track status, view driver identity (after booking), and review compliance proofs.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-extrabold"
            >
              <Calendar className="h-4 w-4 text-lime-500" />
              Edit Schedule
            </Button>

            <Button className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90">
              <Headphones className="h-4 w-4" />
              Contact Support
            </Button>
          </div>
        </section>

        {/* Main layout */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Map + route + tabs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Map section */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-7 relative min-h-[280px] sm:min-h-[360px] bg-slate-50 dark:bg-slate-950">
                  {isLoaded && pickupCoords && dropoffCoords ? (
                    <RouteMap
                      pickup={pickupCoords}
                      dropoff={dropoffCoords}
                      isLoaded={isLoaded}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                      <p className="text-sm text-slate-500">Map loading or addresses not geocoded</p>
                    </div>
                  )}

                  {/* Overlay badges */}
                  <div className="absolute bottom-5 left-5 flex flex-wrap gap-2 z-10">
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Map className="h-4 w-4 text-lime-500" />
                      Route Map
                    </div>

                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-lime-500" />
                      {deliveryData.etaMinutes ? `${deliveryData.etaMinutes} min` : '—'}
                    </div>

                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-lime-500" />
                      {scheduleDisplay.time}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 sm:p-8 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Route</Label>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <Target className="h-5 w-5 text-lime-500 mt-0.5" />
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">Pickup</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {deliveryData.pickupAddress || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Flag className="h-5 w-5 text-rose-500 mt-0.5" />
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">Drop-off</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {deliveryData.dropoffAddress || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Estimated Price</div>
                        <div className="text-3xl font-black text-lime-500 mt-1">
                          {price ? `$${price.toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <Link
                        // to="/dealer/payment"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
                      >
                        <CreditCard className="h-4 w-4 text-lime-500" />
                        Payment
                      </Link>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      {priceType} price based on category and mileage.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="proofs" className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Proofs
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Messages
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6 mt-6">
                {/* Timeline */}
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Status timeline</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Track delivery status end-to-end (Requested → Booked → Active → Completed).
                      </p>
                    </div>

                    <Badge variant="secondary" className="gap-2">
                      <Mail className="h-3 w-3" />
                      <span className="text-[11px] font-black uppercase tracking-widest">Email-first</span>
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-6 space-y-4">
                      {timelineItems.map((item, index) => {
                        const Icon = item.icon
                        return (
                          <div key={index}>
                            {index > 0 && <Separator className="my-4" />}
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center",
                                item.completed 
                                  ? "bg-lime-500/15" 
                                  : "bg-slate-100 dark:bg-slate-800/60"
                              )}>
                                <Icon className={cn(
                                  "h-5 w-5",
                                  item.completed 
                                    ? "text-lime-500" 
                                    : "text-slate-500 dark:text-slate-300"
                                )} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="font-black text-slate-900 dark:text-white">{item.status}</div>
                                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{item.time}</div>
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                  {index === 0 && 'Confirmation email sent to dealer contact.'}
                                  {index === 1 && 'Driver identity is visible after booking (name + photo + profile).'}
                                  {index === 2 && 'Tracking begins when driver taps Start and ends on completion.'}
                                  {index === 3 && 'Post-trip report available with photos and odometer evidence.'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                      <Button className="flex-1 py-4 rounded-2xl gap-2">
                        <Download className="h-4 w-4" />
                        Download Report (Prototype)
                      </Button>
                      <Button variant="outline" className="flex-1 py-4 rounded-2xl gap-2">
                        <Edit className="h-4 w-4 text-lime-500" />
                        Edit Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Vehicle summary */}
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Vehicle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-5">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Vehicle</div>
                          <div className="font-black text-slate-900 dark:text-white mt-2">{vehicleString}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Plate: {deliveryData.licensePlate || '—'}</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-5">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Verification</div>
                          <div className="font-black text-slate-900 dark:text-white mt-2">VIN last-4: {deliveryData.vinVerificationCode || '—'}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Used at pickup for verification (101 Standard).
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Proofs Tab */}
              <TabsContent value="proofs" className="space-y-6 mt-6">
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Compliance proofs</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        VIN last-4, pickup/drop-off photos, odometer start/end, and tracking records.
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-2">
                      <Shield className="h-3 w-3" />
                      <span className="text-[11px] font-black uppercase tracking-widest">101 Standard</span>
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* VIN */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <QrCode className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">VIN last-4 verification</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">Required at pickup</div>
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                            Verified value: <span className="font-black">{proofs.vin}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Odometer */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <Gauge className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">Odometer start/end</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">Photos at both ends</div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Start</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.odometerStart}</div>
                              </CardContent>
                            </Card>
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">End</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.odometerEnd}</div>
                              </CardContent>
                            </Card>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Photos (placeholder) */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 md:col-span-2">
                        <CardContent className="p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                                <Camera className="h-5 w-5 text-lime-500" />
                              </div>
                              <div>
                                <div className="font-black text-slate-900 dark:text-white">Photo documentation</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  Pickup + drop-off required photos (prototype thumbnails)
                                </div>
                              </div>
                            </div>

                            <Button variant="outline" className="gap-2">
                              <ChevronRight className="h-4 w-4 text-lime-500" />
                              View all
                            </Button>
                          </div>

                          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="aspect-[4/3] rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 flex items-center justify-center">
                                <Camera className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Tracking */}
                      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 md:col-span-2">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-lime-500/15 flex items-center justify-center">
                              <Navigation className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">Start/stop tracking</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Tracking starts when driver taps Start; ends at completion.
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.trackingStatus}</div>
                              </CardContent>
                            </Card>
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Start time</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.trackingStart}</div>
                              </CardContent>
                            </Card>
                            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                              <CardContent className="p-4">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">End time</div>
                                <div className="font-black text-slate-900 dark:text-white mt-1">{proofs.trackingEnd}</div>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {deliveryData.trackingSession ? 'Live GPS tracking available in real app.' : 'Tracking not yet started.'}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {/* Post-trip report */}
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardContent className="p-6 sm:p-8">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Post-trip report</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Final report becomes available after completion.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-6 gap-2 py-4 w-full sm:w-auto"
                      disabled={deliveryData.status !== 'COMPLETED'}
                    >
                      <Download className="h-4 w-4 text-lime-500" />
                      {deliveryData.status === 'COMPLETED' ? 'Download Report' : 'Report not ready'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Messages Tab (static for prototype) */}
              <TabsContent value="messages" className="space-y-6 mt-6">
                <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Messages</CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Prototype: in-app chat. Primary notifications remain email-first (SMS optional).
                      </p>
                    </div>
                    <Button className="gap-2">
                      <Phone className="h-4 w-4" />
                      Call Driver
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {/* Chat area */}
                    <Card className="rounded-3xl border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="p-5 bg-slate-50 dark:bg-slate-950">
                        <div className="space-y-3">
                          {messages.map((msg, index) => (
                            <div key={index} className={cn(
                              "flex",
                              msg.sender === 'driver' ? "justify-start" : "justify-end"
                            )}>
                              <div className={cn(
                                "max-w-[85%] sm:max-w-[70%] p-4 rounded-3xl",
                                msg.sender === 'driver' 
                                  ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" 
                                  : "bg-lime-500/15 border border-lime-500/25"
                              )}>
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                  {msg.sender === 'driver' ? 'Driver' : 'You'}
                                </div>
                                <div className={cn(
                                  "text-sm mt-1",
                                  msg.sender === 'driver' 
                                    ? "text-slate-700 dark:text-slate-300" 
                                    : "text-slate-800"
                                )}>
                                  {msg.text}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex gap-3">
                          <Input
                            className="flex-1 h-12 rounded-2xl text-sm px-4"
                            placeholder="Type a message…"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                          />
                          <Button className="gap-2">
                            Send
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          Email-first remains the primary channel; SMS is optional if enabled by Admin policy.
                        </p>
                      </div>
                    </Card>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Driver card + contact + rating/tip */}
          <div className="lg:col-span-5 space-y-6">
            {/* Driver identity */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Assigned driver</div>
                  <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">Driver identity</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Visible after booking (name, photo, profile).
                  </p>
                </div>

                <Badge variant="secondary" className="gap-2">
                  <ShieldCheck className="h-3 w-3" />
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    {deliveryData.status !== 'LISTED' ? 'Booked' : 'Listed'}
                  </span>
                </Badge>
              </CardHeader>
              <CardContent>
                {driver ? (
                  <>
                    <div className="mt-6 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-slate-800 border border-slate-300/50 dark:border-slate-700 overflow-hidden flex items-center justify-center">
                        <User className="h-8 w-8 text-slate-600 dark:text-slate-300" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-black text-slate-900 dark:text-white text-lg">{driver.name}</div>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="h-4 w-4 fill-amber-500" />
                            <span className="text-sm font-black text-slate-900 dark:text-white">{driver.rating}</span>
                          </div>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {driver.deliveries} deliveries • ID verified
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button className="gap-2">
                        <Phone className="h-4 w-4" />
                        Call Driver
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <MessageCircle className="h-4 w-4 text-lime-500" />
                        Message
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 p-6 text-center text-slate-500">
                    <User className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                    <p className="text-sm font-medium">Driver not yet assigned</p>
                    <p className="text-xs mt-1">Driver details appear after the delivery is booked.</p>
                  </div>
                )}

                <div className="mt-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    {driver ? 'Driver profile from onboarding approval.' : 'Driver will appear once booked.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notifications & contact */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Notifications & contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-lime-500 mt-0.5" />
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">Email-first updates</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Dealer contact receives status updates by email.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-lime-500 mt-0.5" />
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">SMS optional</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Only used if enabled by Admin policy and user opts in.
                      </div>
                    </div>
                  </div>

                  <Link
                    // to="/dealer/notifications"
                    className="mt-2 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-extrabold hover:opacity-90 transition border border-slate-200 dark:border-slate-700 w-full"
                  >
                    <Settings className="h-4 w-4 text-lime-500" />
                    Notification Settings
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Rating & tip */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">Rate & tip (after completion)</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Available when the delivery is marked Completed.
                </p>
              </CardHeader>
              <CardContent>
                <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-black text-slate-900 dark:text-white">Your rating</div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className="h-5 w-5 fill-amber-500" />
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button variant="outline" className="py-3" disabled={deliveryData.status !== 'COMPLETED'}>
                        Tip $5
                      </Button>
                      <Button variant="outline" className="py-3" disabled={deliveryData.status !== 'COMPLETED'}>
                        Tip $10
                      </Button>
                      <Button variant="outline" className="py-3" disabled={deliveryData.status !== 'COMPLETED'}>
                        Custom
                      </Button>
                    </div>

                    <Button 
                      className="mt-4 w-full py-4 gap-2" 
                      disabled={deliveryData.status !== 'COMPLETED'}
                    >
                      {deliveryData.status === 'COMPLETED' ? 'Submit Rating' : 'Rating disabled until Complete'}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card className="bg-white/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Need changes?</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Editing depends on status (schedule can be updated during Active).
                    </p>
                  </div>
                  <Link
                    to="/driver-issue-report"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition"
                  >
                    Report Issue
                    <AlertCircle className="h-4 w-4" />
                  </Link>
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