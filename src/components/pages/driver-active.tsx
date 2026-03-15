// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useJsApiLoader } from '@react-google-maps/api'
import RouteMap from '@/components/map/RouteMap' // adjust path as needed
import {
  ArrowLeft as ArrowBack,
  LogOut,
  Sun,
  Moon,
  Truck as LocalShipping,
  Ruler as Distance,
  Clock as Schedule,
  Bolt,
  UserCheck as SupportAgent,
  Map,
  Gauge as Speed,
  Route,
  Repeat as TrackChanges,
  CheckCircle,
  Circle as RadioButtonUnchecked,
  Camera as PhotoCamera,
  Upload,
  ImagePlus as AddAPhoto,
  MailCheck as MarkEmailRead,
  MapPin as NearMe,
  CheckSquare as DoneAll,
  PauseCircle,
  CheckCircle2 as TaskAlt,
  ArrowRight as ArrowForward,
  MapPin as LocationOn,
  Flag,
  Info,
  AlertCircle,
  Check,
  X,
  Menu,
  X as XIcon,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  Calendar,
  User,
  Building2,
  Car,
  Fuel,
  Gauge,
  Navigation,
  Compass,
  MapPin,
  Home,
  Briefcase,
  CreditCard,
  DollarSign,
  Receipt,
  TrendingUp,
  TrendingDown,
  Activity,
  Fingerprint,
  Key,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Verified,
  AlertTriangle,
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'

// Mock delivery data
const MOCK_DELIVERY = {
  id: 'DLV-20418',
  route: 'San Jose → Los Angeles',
  distance: '342 mi',
  started: '10:18am',
  bonus: '$20',
  payout: 248.00,
  status: 'In Progress',
  eta: '3:45pm',
  timeline: [
    {
      id: 1,
      title: 'Pickup checklist complete',
      description: 'VIN last-4, pickup photos, odometer start captured.',
      time: '10:12am',
      icon: CheckCircle,
      status: 'complete',
    },
    {
      id: 2,
      title: 'Delivery in progress',
      description: 'Tracking enabled. Share updates via "Check-in".',
      time: 'Now',
      icon: LocalShipping,
      status: 'active',
    },
    {
      id: 3,
      title: 'Drop-off evidence',
      description: 'Drop-off photos + odometer end required to complete.',
      time: 'Locked',
      icon: RadioButtonUnchecked,
      status: 'locked',
    },
  ],
  pickupEvidence: {
    photos: Array(6).fill(null),
    complete: true,
  },
  dropoffEvidence: {
    photos: Array(6).fill(null),
    complete: false,
  },
}

// Navigation items for mobile menu (optional)
const navItems = [
  { href: '/driver-dashboard', label: 'Dashboard' },
  { href: '/driver-active-delivery', label: 'Active Delivery', active: true },
]

export default function DriverActiveDeliveryPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [odometerEnd, setOdometerEnd] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
//   const params = useParams({ from: '/driver/active-delivery/$deliveryId' })

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places'],
  })

  // Geocode pickup and dropoff addresses when API loads
  useEffect(() => {
    if (!isLoaded) return

    const geocoder = new google.maps.Geocoder()
    
    geocoder.geocode({ address: 'San Jose, CA' }, (results, status) => {
      if (status === 'OK' && results && results[0].geometry.location) {
        const location = results[0].geometry.location
        setPickupCoords({ lat: location.lat(), lng: location.lng() })
      } else {
        console.error('Geocode failed for San Jose')
      }
    })

    geocoder.geocode({ address: 'Los Angeles, CA' }, (results, status) => {
      if (status === 'OK' && results && results[0].geometry.location) {
        const location = results[0].geometry.location
        setDropoffCoords({ lat: location.lat(), lng: location.lng() })
      } else {
        console.error('Geocode failed for Los Angeles')
      }
    })
  }, [isLoaded])

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  // Mobile menu handling
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/dealer-signin?userType=driver' })
  }

  const handlePause = () => {
    toast.info('Delivery paused', {
      description: 'You can resume anytime.',
    })
  }

  const handleCheckIn = () => {
    toast.success('Check-in sent', {
      description: 'Update sent to Ops and stakeholders.',
    })
  }

  const handleCompleteDelivery = () => {
    if (!odometerEnd) {
      toast.error('Odometer end required', {
        description: 'Please enter the final odometer reading.',
      })
      return
    }
    toast.success('Delivery completed', {
      description: 'Thank you! The delivery has been marked as complete.',
    })
    // Navigate to completion page or dashboard
    navigate({ to: '/driver-dashboard' })
  }

  const handleCheckInAction = (action: string) => {
    toast.info(`Check-in: ${action}`, {
      description: `Update sent: ${action}`,
    })
  }

  const handleSupport = () => {
    toast.info('Contacting support', {
      description: 'Support will reach out shortly.',
    })
  }

  const handleAddPhoto = (index: number) => {
    toast.success('Photo added', {
      description: `Photo ${index + 1} uploaded successfully.`,
    })
  }

  // Timeline step component
  const TimelineStep = ({ step }: { step: typeof MOCK_DELIVERY.timeline[0] }) => {
    const getStatusStyles = () => {
      switch (step.status) {
        case 'complete':
          return 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
        case 'active':
          return 'border border-primary/25 bg-primary/10'
        case 'locked':
          return 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
        default:
          return 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
      }
    }

    const getIconStyles = () => {
      switch (step.status) {
        case 'complete':
          return 'text-primary'
        case 'active':
          return 'text-primary'
        case 'locked':
          return 'text-slate-400'
        default:
          return 'text-slate-400'
      }
    }

    return (
      <div className={cn("p-4 rounded-2xl flex items-start justify-between gap-4", getStatusStyles())}>
        <div className="flex items-start gap-3">
          <step.icon className={cn("w-5 h-5 mt-0.5", getIconStyles())} />
          <div>
            <p className={cn(
              "text-sm font-extrabold",
              step.status === 'locked' ? 'text-slate-900 dark:text-white' : 'text-slate-900'
            )}>
              {step.title}
            </p>
            <p className={cn(
              "text-[11px] mt-1",
              step.status === 'active' ? 'text-slate-700/80' : 'text-slate-600 dark:text-slate-400'
            )}>
              {step.description}
            </p>
          </div>
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
          {step.time}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-dashboard"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back to driver dashboard"
            >
              <ArrowBack className="w-5 h-5" />
            </Link>

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Active Delivery
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {MOCK_DELIVERY.id}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            {/* Mobile menu button - optional */}
            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile menu - optional */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="max-w-[980px] mx-auto px-5 py-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm font-semibold transition-colors",
                    item.active
                      ? "bg-primary/15 text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-36">
        {/* Status / route */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                    <LocalShipping className="w-4 h-4 text-primary" />
                    {MOCK_DELIVERY.status}
                  </div>

                  <h1 className="mt-4 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {MOCK_DELIVERY.route}
                  </h1>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      <Distance className="w-4 h-4 text-primary mr-1" />
                      {MOCK_DELIVERY.distance}
                    </Badge>
                    <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <Schedule className="w-4 h-4 text-primary mr-1" />
                      Started {MOCK_DELIVERY.started}
                    </Badge>
                    <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <Bolt className="w-4 h-4 text-primary mr-1" />
                      Bonus {MOCK_DELIVERY.bonus}
                    </Badge>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-3xl font-black text-primary">
                    ${MOCK_DELIVERY.payout.toFixed(2)}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Payout (est.)
                  </p>
                  <div className="mt-3">
                    <Button
                      onClick={handleSupport}
                      variant="link"
                      className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-700 dark:text-slate-200 hover:text-primary transition p-0 h-auto"
                    >
                      <SupportAgent className="w-4 h-4 text-primary" />
                      Support
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Map preview (replaced with real map) */}
            <div className="relative min-h-[260px] sm:min-h-[320px] bg-slate-50 dark:bg-slate-950 overflow-hidden">
              {isLoaded && pickupCoords && dropoffCoords ? (
                <RouteMap
                  pickup={pickupCoords}
                  dropoff={dropoffCoords}
                  isLoaded={isLoaded}
                />
              ) : (
                // Fallback while loading
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                  Loading map...
                </div>
              )}

              {/* Overlay badges - exactly as before but positioned absolutely */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                  <Map className="w-4 h-4 text-primary" />
                  Live Route
                </div>

                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 w-fit">
                  <Speed className="w-4 h-4 text-primary" />
                  ETA: {MOCK_DELIVERY.eta}
                </div>
              </div>

              <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700 z-10">
                <Route className="w-4 h-4 text-primary" />
                Pickup → Drop-off
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress timeline */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Progress</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Proof-driven steps. Some actions are locked until required evidence is uploaded.
                </CardDescription>
              </div>
              <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                <TrackChanges className="w-4 h-4 text-primary mr-1" />
                Tracking On
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_DELIVERY.timeline.map((step) => (
                <TimelineStep key={step.id} step={step} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evidence uploads */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pickup evidence */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black">Pickup evidence</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Complete ✓
                  </CardDescription>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <PhotoCamera className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {MOCK_DELIVERY.pickupEvidence.photos.map((_, index) => (
                  <div
                    key={index}
                    className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700"
                  />
                ))}
              </div>

              <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
                Prototype thumbnails. In production, each photo is time-stamped and linked to the delivery record.
              </p>
            </CardContent>
          </Card>

          {/* Drop-off evidence */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black">Drop-off evidence</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Pending
                  </CardDescription>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-amber-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {MOCK_DELIVERY.dropoffEvidence.photos.map((_, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-16 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-primary/5 transition flex items-center justify-center p-0"
                    onClick={() => handleAddPhoto(index)}
                  >
                    <AddAPhoto className="w-5 h-5 text-primary" />
                  </Button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Odometer End
                  </Label>
                  <Input
                    value={odometerEnd}
                    onChange={(e) => setOdometerEnd(e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                    placeholder="Enter miles (end)"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Notes
                  </Label>
                  <Input
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                    placeholder="Optional delivery note"
                  />
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
                Drop-off completion requires photos + odometer end. If issues occur, use Support.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Check-in / updates */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Check-in</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Send an update to Ops / stakeholders (email-first; SMS optional by policy).
                </CardDescription>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                <MarkEmailRead className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant="outline"
                onClick={() => handleCheckInAction('On the way')}
                className="py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-extrabold hover:bg-primary/5 transition flex items-center justify-center gap-2"
              >
                <NearMe className="w-4 h-4 text-primary" />
                On the way
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCheckInAction('Running late')}
                className="py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-extrabold hover:bg-primary/5 transition flex items-center justify-center gap-2"
              >
                <Schedule className="w-4 h-4 text-primary" />
                Running late
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCheckInAction('Arrived')}
                className="py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-extrabold hover:bg-primary/5 transition flex items-center justify-center gap-2"
              >
                <DoneAll className="w-4 h-4 text-primary" />
                Arrived
              </Button>
            </div>

            <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
              Prototype actions. In production, each check-in writes an audit/event record visible in Admin and Delivery details.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Action Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={handlePause}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 font-extrabold hover:bg-primary/5 transition flex items-center justify-center gap-2"
          >
            <PauseCircle className="w-5 h-5 text-primary" />
            Pause
          </Button>

          <Button
            onClick={handleCheckIn}
            className="bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl py-4 font-extrabold hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <TaskAlt className="w-5 h-5" />
            Check-in
          </Button>

          <Button
            onClick={handleCompleteDelivery}
            className="lime-btn rounded-2xl py-4 hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2"
          >
            Complete Delivery
            <ArrowForward className="w-5 h-5" />
          </Button>
        </div>
      </nav>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10 mt-6">
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
                Driver • Active Delivery • California-only operations
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}