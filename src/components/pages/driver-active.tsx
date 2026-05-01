// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useJsApiLoader, DirectionsService, DirectionsRenderer } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
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
  CloudUpload,
  Save,
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
import { Skeleton } from '@/components/ui/skeleton' // make sure you have this component
import {
  getUser,
  useDataQuery,
  useDataMutation,
  useFileUpload,
  useCreate,
} from '@/lib/tanstack/dataQuery'

// Default delivery data (fallback while loading) – updated to match API shape
const MOCK_DELIVERY = {
  id: 'DLV-20418',
  pickupAddress: '',
  dropoffAddress: '',
  pickupLat: 37.3382,
  pickupLng: -121.8863,
  dropoffLat: 34.0522,
  dropoffLng: -118.2437,
  route: 'San Jose → Los Angeles',
  distance: '342 mi',
  started: '10:18am',
  bonus: '$20',
  payout: 248.00,
  status: 'In Progress',
  eta: '3:45pm',
  quote: { distanceMiles: 342, estimatedPrice: 248.00 },
  compliance: {
    pickupCompletedAt: '2026-03-14T22:38:38.025Z',
    odometerEnd: null,
  },
  trackingSession: {
    startedAt: '2026-03-14T22:38:38.029Z',
  },
  evidence: Array(6).fill(null).map((_, i) => ({
    slotIndex: i + 1,
    imageUrl: null,
    phase: 'PICKUP',
    type: 'PICKUP_PHOTO',
  })),
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
}

// Navigation items for mobile menu (optional)
const navItems = [
  { href: '/driver-dashboard', label: 'Dashboard' },
  { href: '/driver-active', label: 'Active Delivery', active: true },
]

export default function DriverActiveDeliveryPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [odometerEnd, setOdometerEnd] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [driverPosition, setDriverPosition] = useState<google.maps.LatLngLiteral | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<any>(null)

  // State for multiple routes
  const [routes, setRoutes] = useState<google.maps.DirectionsResult[]>([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0) // 0 = best route

  // Dropoff photo upload state
  const [dropoffPhotoSlots, setDropoffPhotoSlots] = useState<Array<{ file: File | null; preview: string | null }>>(
    Array(6).fill(null).map(() => ({ file: null, preview: null }))
  )
  const [uploadedDropoffPhotos, setUploadedDropoffPhotos] = useState<Array<{ slotIndex: number; imageUrl: string }>>([])
  const [dropoffPhotosSaved, setDropoffPhotosSaved] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentSlotIndex = useRef<number | null>(null)
  const trackingInterval = useRef<NodeJS.Timeout>()
  // 👇 NEW: ref to store latest position for interval
  const latestPositionRef = useRef<google.maps.LatLngLiteral | null>(null)

  // Location health tracking
  const [locationHealth, setLocationHealth] = useState<'healthy' | 'warning' | 'lost'>('healthy')
  const [lastLocationTime, setLastLocationTime] = useState<Date>(new Date())
  const consecutiveMissedRef = useRef(0)

  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const driverId = user?.profileId
  const userId = user?.id

    // Main query: fetch active delivery for this driver
  // Uses dedicated endpoint — returns { assignment + delivery } or null
  const activeDeliveryQuery = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/active-delivery/${driverId}`,
    noFilter: true,
    enabled: Boolean(driverId),
    refetchInterval: 10000, // refresh every 10s
    onSuccess: (data) => {
      // Optionally sync workflow status if needed, but we'll keep separate
      // setWorkflowStatus(data); // if you want to set something else
    },
    onError: (error) => {
      toast.error('Failed to fetch active delivery')
    },
  })

  // Extract delivery from the assignment wrapper
  const delivery = activeDeliveryQuery.data?.delivery || null
  const deliveryLoading = activeDeliveryQuery.isLoading
  const deliveryError = activeDeliveryQuery.error
  const hasNoData = !deliveryLoading && !deliveryError && !delivery

  // Use real data when available, otherwise fallback to defaults (only during loading)
  const deliveryData = delivery || (deliveryLoading ? MOCK_DELIVERY : null)
  const deliveryId = delivery?.id;
  // Get deliveryId from search params (still used for mutations, but we'll also validate)
  // const { jobId: deliveryId } = useSearch({ strict: false }) as { jobId: string }

  // ==================== MUTATIONS & QUERIES ====================

  // NEW: Location ping mutation (every 3 seconds)
  const locationPingMutation = useDataMutation<any, { lat: number; lng: number; recordedAt: string }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/location-ping`,
    method: 'POST',
    onError: (error) => {
      console.error('Location ping failed', error)
    },
  })

  // Query for workflow status (manually triggered)
  const workflowQuery = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/driver-workflow/${driverId}`,
    enabled: false, // we'll trigger manually
    onSuccess: (data) => {
      setWorkflowStatus(data)
    },
    onError: (error) => {
      toast.error('Failed to fetch workflow status')
    },
  })


  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Set coordinates directly from delivery data when available
  useEffect(() => {
    if (delivery) {
      if (delivery.pickupLat && delivery.pickupLng) {
        setPickupCoords({ lat: delivery.pickupLat, lng: delivery.pickupLng })
      }
      if (delivery.dropoffLat && delivery.dropoffLng) {
        setDropoffCoords({ lat: delivery.dropoffLat, lng: delivery.dropoffLng })
      }
    }
  }, [delivery])

  // 👇 UPDATED: geolocation with health tracking
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) return
    // Real-time geolocation tracking:
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLastLocationTime(new Date())
        consecutiveMissedRef.current = 0
        setLocationHealth('healthy')
      },
      (err) => {
        console.error(err)
        consecutiveMissedRef.current += 1
        if (err.code === 1) {
          // PERMISSION_DENIED
          setLocationHealth('lost')
        } else if (consecutiveMissedRef.current >= 3) {
          setLocationHealth('warning')
        }
      },
      { enableHighAccuracy: true }
    );
    console.log("setDriverPosition",watchId, driverPosition)
    return () => navigator.geolocation.clearWatch(watchId);
  }, [pickupCoords, dropoffCoords])

  // Monitor location health: show warning if no update for 120s
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastLocationTime.getTime()) / 1000
      if (elapsed > 120 && locationHealth === 'healthy') {
        setLocationHealth('warning')
      }
      if (elapsed > 180) {
        setLocationHealth('lost')
      }
    }, 30000) // check every 30s
    return () => clearInterval(interval)
  }, [lastLocationTime, locationHealth])

  // 👇 NEW: update ref when driverPosition changes
  useEffect(() => {
    latestPositionRef.current = driverPosition
  }, [driverPosition])

  // Fetch multiple routes using Directions API
  useEffect(() => {
    if (!isLoaded || !pickupCoords || !dropoffCoords) return

    const directionsService = new google.maps.DirectionsService()

    directionsService.route(
      {
        origin: pickupCoords,
        destination: dropoffCoords,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setRoutes([result])
        } else {
          console.error('Directions request failed:', status)
        }
      }
    )
  }, [isLoaded, pickupCoords, dropoffCoords])

  // Send location ping (used by interval and manual check-in)
  const sendLocationPing = (position: google.maps.LatLngLiteral) => {
    if (!deliveryId) return // 👈 ensure we have a deliveryId
    const payload = {
      lat: position.lat,
      lng: position.lng,
      recordedAt: new Date().toISOString(),
    }
    locationPingMutation.mutate(payload)
  }

  // 👇 UPDATED: stable interval that reads from ref
  useEffect(() => {
    const interval = setInterval(() => {
      if (latestPositionRef.current) {
        sendLocationPing(latestPositionRef.current)
      }
    }, 60000) // every 60 seconds

    return () => clearInterval(interval)
  }, []) // empty dependency array – runs once

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
    navigate({ to: '/driver-signin' })
  }

  const handlePause = () => {
    toast.info('Delivery paused', {
      description: 'You can resume anytime.',
    })
  }

  // Check-in: send location ping and fetch workflow status
  const handleCheckIn = async () => {
    if (!driverPosition) return

    sendLocationPing(driverPosition)
    workflowQuery.refetch()
  }

  const handleCheckInAction = (action: string) => {
    if (driverPosition) {
      sendLocationPing(driverPosition)
    }
    toast.info(`Check-in: ${action}`, {
      description: `Update sent: ${action}`,
    })
  }

  const handleSupport = () => {
    // Navigate to support request page with delivery context
    navigate({ 
      to: '/driver-issue-report',
      state: { deliveryId: deliveryId }
    })
  }

  // Dropoff photo handlers
  const handleAddDropoffPhoto = (index: number) => {
    currentSlotIndex.current = index
    fileInputRef.current?.click()
  }

  const handleDropoffFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || currentSlotIndex.current === null) return

    const index = currentSlotIndex.current
    const previewUrl = URL.createObjectURL(file)

    setDropoffPhotoSlots(prev => {
      const newSlots = [...prev]
      if (newSlots[index].preview) {
        URL.revokeObjectURL(newSlots[index].preview!)
      }
      newSlots[index] = { file, preview: previewUrl }
      return newSlots
    })

    e.target.value = ''
  }

  // Upload dropoff photos
  const uploadDropoffPhotosMutation = useFileUpload<{ ok: boolean; files: Array<{ slotIndex: number; url: string }> }>(
    `${import.meta.env.VITE_API_URL}/api/uploads/delivery-evidence`,
    {
      onSuccess: (data) => {
        const photos = data.files.map(f => ({
          slotIndex: f.slotIndex,
          imageUrl: f.url,
        }))
        setUploadedDropoffPhotos(photos)
        setDropoffPhotosSaved(true)
        toast.success('Dropoff photos uploaded')
      },
      onError: (error) => {
        toast.error('Upload failed', { description: error.message })
      },
    }
  )

  const handleUploadDropoffPhotos = () => {
    const allAdded = dropoffPhotoSlots.every(slot => slot.file !== null)
    if (!allAdded) {
      toast.error('Missing photos', { description: 'Please add all 6 dropoff photos.' })
      return
    }

    const formData = new FormData()
    dropoffPhotoSlots.forEach(slot => {
      if (slot.file) formData.append('files', slot.file)
    })
    formData.append('deliveryId', deliveryId)
    formData.append('phase', 'DROPOFF')

    uploadDropoffPhotosMutation.mutate(formData)
  }

  // Submit dropoff compliance
  const submitComplianceMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/dropoff-compliance`,
    {
      onSuccess: () => {
        toast.success('Dropoff compliance submitted')
      },
      onError: (error) => {
        toast.error('Compliance submission failed', { description: error.message })
      },
    }
  )

  const handleSubmitDropoffCompliance = () => {
    if (!odometerEnd || isNaN(Number(odometerEnd))) {
      toast.error('Odometer end required', { description: 'Please enter a valid number.' })
      return
    }
    if (uploadedDropoffPhotos.length !== 6) {
      toast.error('Photos not uploaded', { description: 'Please upload all dropoff photos first.' })
      return
    }

    const payload = {
      driverId,
      odometerEnd: Number(odometerEnd),
      photos: uploadedDropoffPhotos.map(p => ({
        slotIndex: p.slotIndex,
        imageUrl: p.imageUrl,
      })),
    }

    submitComplianceMutation.mutate(payload)
  }

  // Complete trip
  const completeTripMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/complete-trip`,
    {
      onSuccess: () => {
        toast.success('Trip completed', { description: 'Thank you! Redirecting to dashboard.' })
        navigate({ to: '/driver-dashboard' })
      },
      onError: (error) => {
        toast.error('Failed to complete trip', { description: error.message })
      },
    }
  )

  const handleCompleteDelivery = () => {
    if (!driverId || !userId) return

    // Block completion if location is lost
    if (locationHealth === 'lost') {
      toast.error('Location signal lost', {
        description: 'Please enable location services and ensure GPS is working before completing the delivery.',
        duration: 8000,
      })
      return
    }

    const payload = {
      driverId,
      actorUserId: userId,
      actorRole: 'DRIVER',
    }
    completeTripMutation.mutate(payload)
  }

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      dropoffPhotoSlots.forEach(slot => {
        if (slot.preview) URL.revokeObjectURL(slot.preview)
      })
    }
  }, [dropoffPhotoSlots])

  // Helper to format time from ISO string
  const formatTime = (isoString?: string) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Build timeline dynamically from actual data
  const hasTrackingSession = !!deliveryData?.trackingSession?.startedAt
  const timelineSteps = deliveryData ? [
    {
      id: 1,
      title: 'Pickup checklist complete',
      description: 'VIN, photos, and odometer start captured.',
      time: formatTime(deliveryData.compliance?.pickupCompletedAt),
      icon: CheckCircle,
      status: deliveryData.compliance?.pickupCompletedAt ? 'complete' : (hasTrackingSession ? 'locked' : 'locked'),
    },
    {
      id: 2,
      title: 'Delivery in progress',
      description: hasTrackingSession
        ? 'Tracking enabled. Share updates via "Check-in".'
        : 'Waiting for trip to start.',
      time: hasTrackingSession ? formatTime(deliveryData.trackingSession.startedAt) : 'Pending',
      icon: LocalShipping,
      status: hasTrackingSession ? 'active' : 'locked',
    },
    {
      id: 3,
      title: 'Drop-off evidence',
      description: deliveryData.compliance?.odometerEnd
        ? 'Drop-off completed'
        : 'Drop-off photos + odometer end required.',
      time: deliveryData.compliance?.odometerEnd ? formatTime(deliveryData.updatedAt) : 'Locked',
      icon: deliveryData.compliance?.odometerEnd ? CheckCircle : RadioButtonUnchecked,
      status: deliveryData.compliance?.odometerEnd ? 'complete' : 'locked',
    },
  ] : []

  // Timeline step component
  const TimelineStep = ({ step }: { step: typeof timelineSteps[0] }) => {
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

  // Filter pickup photos from evidence
  const pickupPhotos = deliveryData?.evidence?.filter(
    (e: any) => e.phase === 'PICKUP' && e.type === 'PICKUP_PHOTO'
  ) || []

  // If there's no data (and not loading), show a message
  if (hasNoData) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex items-center justify-center">
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">No Active Delivery</CardTitle>
            <CardDescription className="text-sm mt-1">
              You don't have any active delivery at the moment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate({ to: '/driver-dashboard' })}
              className="w-full lime-btn rounded-2xl py-3 font-extrabold"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
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
        {/* Location health warning banner */}
        {locationHealth === 'warning' && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">GPS signal weak</p>
              <p className="text-[12px] text-amber-800/80 dark:text-amber-200/80 mt-1">Location updates are delayed. Please make sure GPS is enabled on your phone for accurate tracking.</p>
            </div>
          </div>
        )}
        {locationHealth === 'lost' && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-extrabold text-red-900 dark:text-red-200">Location signal lost</p>
              <p className="text-[12px] text-red-800/80 dark:text-red-200/80 mt-1">GPS tracking is not working. Please enable location services to continue tracking and complete this delivery.</p>
            </div>
          </div>
        )}

        {/* Status / route card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800">
              {deliveryLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                      <LocalShipping className="w-4 h-4 text-primary" />
                      {deliveryData?.status || 'In Progress'}
                    </div>

                    <h1 className="mt-4 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {deliveryData?.pickupAddress || '—'} → {deliveryData?.dropoffAddress || '—'}
                    </h1>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {deliveryData?.quote?.distanceMiles && (
                        <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                          <Distance className="w-4 h-4 text-primary mr-1" />
                          {deliveryData.quote.distanceMiles} mi
                        </Badge>
                      )}
                      {deliveryData?.trackingSession?.startedAt && (
                        <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                          <Schedule className="w-4 h-4 text-primary mr-1" />
                          Started {formatTime(deliveryData.trackingSession.startedAt)}
                        </Badge>
                      )}
                      {deliveryData?.urgentBonusAmount > 0 && (
                        <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                          <Bolt className="w-4 h-4 text-primary mr-1" />
                          Bonus ${deliveryData.urgentBonusAmount}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-3xl font-black text-primary">
                      ${deliveryData?.quote?.estimatedPrice ? deliveryData.quote.estimatedPrice.toFixed(2) : '—'}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Est. payout
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
              )}
            </div>

            {/* Map with driver position and multiple routes */}
            <div className="relative min-h-[260px] sm:min-h-[320px] bg-slate-50 dark:bg-slate-950 overflow-hidden">
              {deliveryLoading ? (
                <Skeleton className="w-full h-full" />
              ) : isLoaded && pickupCoords && dropoffCoords ? (
                <RouteMap
                  pickup={pickupCoords}
                  dropoff={dropoffCoords}
                  driverPosition={driverPosition}
                  directionsResult={routes[0]}
                  selectedRouteIndex={selectedRouteIndex}
                  isLoaded={isLoaded}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                  Loading map...
                </div>
              )}

              {/* Overlay badges */}
              {!deliveryLoading && (
                <>
                  <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                      <Map className="w-4 h-4 text-primary" />
                      Live Route
                    </div>

                    {deliveryData?.etaMinutes && (
                      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 w-fit">
                        <Speed className="w-4 h-4 text-primary" />
                        ETA: {Math.round(deliveryData.etaMinutes)} min
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2 rounded-2xl text-xs font-extrabold text-slate-900 dark:text-white shadow-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700 z-10">
                    <Route className="w-4 h-4 text-primary" />
                    Pickup → Drop-off
                  </div>
                </>
              )}
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
            {deliveryLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : (
              <div className="space-y-3">
                {timelineSteps.map((step) => (
                  <TimelineStep key={step.id} step={step} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evidence uploads */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pickup evidence - with actual photos */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black">Pickup evidence</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {deliveryLoading ? <Skeleton className="h-4 w-16" /> : (deliveryData?.compliance?.pickupCompletedAt ? 'Complete' : 'Pending')}
                  </CardDescription>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <PhotoCamera className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {deliveryLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array(6).fill(null).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-2xl" />
                  ))}
                </div>
              ) : pickupPhotos.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {pickupPhotos.map((photo: any, index: number) => (
                      <div
                        key={index}
                        className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 overflow-hidden"
                      >
                        {photo?.imageUrl ? (
                          <img
                            src={photo.imageUrl}
                            alt={`Pickup ${photo.slotIndex}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                            No photo
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
                    Photos captured at pickup. Time-stamped and linked to delivery.
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center h-16 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-400">No pickup photos yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drop-off evidence - upload functionality */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
            <CardHeader>
              <div>
                <CardTitle className="text-lg font-black">Drop-off evidence</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {dropoffPhotosSaved ? 'Uploaded' : 'Pending'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleDropoffFileChange}
                className="hidden"
              />

              <div className="grid grid-cols-3 gap-2">
                {dropoffPhotoSlots.map((slot, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    onClick={() => handleAddDropoffPhoto(index)}
                    className={cn(
                      "h-16 rounded-2xl border-2 border-dashed flex items-center justify-center p-0 hover:bg-primary/5 transition overflow-hidden",
                      slot.file ? "border-primary bg-primary/10" : "border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {slot.preview ? (
                      <img src={slot.preview} alt={`Dropoff ${index + 1}`} className="h-full w-full object-cover" />
                    ) : slot.file ? (
                      <Check className="w-5 h-5 text-primary" />
                    ) : (
                      <AddAPhoto className="w-5 h-5 text-primary" />
                    )}
                  </Button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <Button
                  onClick={handleUploadDropoffPhotos}
                  disabled={true}
                  className="w-full bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-400 font-extrabold rounded-2xl py-3 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CloudUpload className="w-4 h-4" />
                  Upload photos
                </Button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Odometer Reading <span className="text-red-500">*</span>
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

                <Button
                  onClick={handleCompleteDelivery}
                  disabled={completeTripMutation.isPending}
                  className="w-full lime-btn rounded-2xl py-3 font-extrabold flex items-center justify-center gap-2"
                >
                  {completeTripMutation.isPending ? 'Completing...' : 'Complete Delivery'}
                  <ArrowForward className="w-5 h-5" />
                </Button>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                  Requires all 6 photos + odometer reading
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Workflow Status Display */}
        {workflowStatus && (
          <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Workflow Status
                  </p>
                  <pre className="text-xs mt-1 text-slate-600 dark:text-slate-300">
                    {JSON.stringify(workflowStatus, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

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