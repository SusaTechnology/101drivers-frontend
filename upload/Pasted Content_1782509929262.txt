// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSocketEvent } from '@/hooks/useSocket'
import { socketJoinDelivery, socketLeaveDelivery, getSocket } from '@/lib/socket'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
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
  Maximize,
  Minimize,
  Inbox,
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
import PostTripCompletion from '@/components/shared/PostTripCompletion'

import { compressPhoto, compressPhotos, buildCompressedUploadPayload } from '@/lib/image-compress'

import { BUSINESS_TZ } from '@/lib/timezone'
import DriverBottomNav from '../layout/DriverBottomNav'

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
  payout: 148.80,
  status: 'In Progress',
  eta: '3:45pm',
  quote: { distanceMiles: 342, estimatedPrice: 248.00, estimatedDriverPayout: 148.80 },
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
      title: 'Vehicle Drop-off Proof',
      description: 'Drop-off photos + odometer end required to complete.',
      time: 'Locked',
      icon: RadioButtonUnchecked,
      status: 'locked',
    },
  ],
}

// Navigation items for mobile menu (optional)
const navItems = [
  { href: '/driver/dashboard', label: 'Dashboard' },
  { href: '/driver/active', label: 'Active Delivery', active: true },
]

export default function DriverActiveDeliveryPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [drivingMode, setDrivingMode] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionPayout, setCompletionPayout] = useState<number | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [odometerEnd, setOdometerEnd] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [driverPosition, setDriverPosition] = useState<google.maps.LatLngLiteral | null>(null)
  const [driverHeading, setDriverHeading] = useState<number | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<any>(null)

  // Detect desktop (no touch screen + not small screen)
  useEffect(() => {
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isSmallScreen = window.innerWidth < 1024
    setIsDesktop(!hasTouchScreen && !isSmallScreen)
  }, [])

  // State for multiple routes
  const [routes, setRoutes] = useState<google.maps.DirectionsResult[]>([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0) // 0 = best route

  // Dropoff photo upload state
  const [dropoffPhotoSlots, setDropoffPhotoSlots] = useState<Array<{ file: File | null; preview: string | null }>>(
    Array(6).fill(null).map(() => ({ file: null, preview: null }))
  )
  const [uploadedDropoffPhotos, setUploadedDropoffPhotos] = useState<Array<{ slotIndex: number; imageUrl: string }>>([])
  const [dropoffPhotosSaved, setDropoffPhotosSaved] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentSlotIndex = useRef<number | null>(null)
  const trackingInterval = useRef<NodeJS.Timeout>()
  // 👇 NEW: ref to store latest position for interval
  const latestPositionRef = useRef<google.maps.LatLngLiteral | null>(null)
  const deliveryIdRef = useRef<string | undefined>(undefined)
  const dropoffSectionRef = useRef<HTMLDivElement>(null)
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const prevGpsTimeRef = useRef<number>(0) // timestamp of last accepted GPS reading
  // Smoothed position ref — used to prevent UI jitter from bad GPS
  const smoothedPositionRef = useRef<google.maps.LatLngLiteral | null>(null)

  // ── Geofence: distance to dropoff ──
  const GEO_RADIUS_MILES = 0.1
  const [distanceToDropoff, setDistanceToDropoff] = useState<number | null>(null)
  const lastCheckedPositionRef = useRef<google.maps.LatLngLiteral | null>(null)

  function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const isWithinGeofence = distanceToDropoff !== null && distanceToDropoff <= GEO_RADIUS_MILES

  // Update distance with throttling: only recompute when moved >25 meters
  useEffect(() => {
    if (!driverPosition || !dropoffCoords) return
    const last = lastCheckedPositionRef.current
    if (last) {
      const movedMeters = haversineMiles(last.lat, last.lng, driverPosition.lat, driverPosition.lng) * 1609.34
      if (movedMeters < 25) return
    }
    lastCheckedPositionRef.current = driverPosition
    const dist = haversineMiles(driverPosition.lat, driverPosition.lng, dropoffCoords.lat, dropoffCoords.lng)
    setDistanceToDropoff(dist)
  }, [driverPosition, dropoffCoords])

  // Open detail mode focused on dropoff section (when geofence passes)
  const handleOpenCompleteFlow = () => {
    if (!isWithinGeofence) return
    setDrivingMode(false)
    setTimeout(() => {
      dropoffSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }

  // Location health tracking
  const [locationHealth, setLocationHealth] = useState<'healthy' | 'warning' | 'lost'>('healthy')
  const [lastLocationTime, setLastLocationTime] = useState<Date>(new Date())
  const consecutiveMissedRef = useRef(0)

  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const driverId = user?.profileId
  const userId = user?.id

    // Main query: fetch active + booked deliveries for this driver
  // Returns an array sorted: ACTIVE first, then BOOKED by pickup time
  const activeDeliveryQuery = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/active-delivery/${driverId}`,
    noFilter: true,
    enabled: Boolean(driverId),
    staleTime: 0, // always refetch on mount — critical after start-trip navigation
    refetchInterval: 60000, // SOCKET.IO: slowed from 10s to 60s as fallback (location via socket)
    onError: (error) => {
      toast.error('Failed to fetch deliveries')
    },
  })

  // Backend now returns an array: [{ delivery, ... }, ...]
  const assignments = Array.isArray(activeDeliveryQuery.data) ? activeDeliveryQuery.data : []

  // Split into active (currently in-progress) and queue (booked for later)
  const activeAssignment = assignments.find((a: any) => a.delivery?.status === 'ACTIVE')
  const queuedAssignments = assignments.filter((a: any) => a.delivery?.status === 'BOOKED')

  // Extract the current active delivery (null if none)
  const delivery = activeAssignment?.delivery || null
  const deliveryLoading = activeDeliveryQuery.isLoading
  const deliveryError = activeDeliveryQuery.error
  // If there's no data (and not loading), but there are queued bookings, show queue only
  const hasOnlyBooked = !deliveryLoading && !deliveryError && !delivery && queuedAssignments.length > 0

  const hasNoData = !deliveryLoading && !deliveryError && assignments.length === 0 && !hasOnlyBooked

  // Use real data when available, otherwise fallback to defaults (only during loading)
  const deliveryData = delivery || (deliveryLoading ? MOCK_DELIVERY : null)
  const deliveryId = delivery?.id;

  // ── Driver payout: prefer stored estimatedDriverPayout, fallback to estimate ──
  // For legacy quotes without estimatedDriverPayout, compute on-the-fly.
  const driverPayoutEstimate = (() => {
    if (deliveryData?.quote?.estimatedDriverPayout != null) {
      return deliveryData.quote.estimatedDriverPayout
    }
    // Fallback for old quotes: estimatePrice × 60% (same logic as backend fallback)
    if (deliveryData?.quote?.estimatedPrice != null) {
      return deliveryData.quote.estimatedPrice * 0.60
    }
    return null
  })()

  // ── Dropoff readiness: disable Complete Delivery button until required fields are filled ──
  const photosUploaded = uploadedDropoffPhotos.length >= 6
  const odometerEndNum = odometerEnd && !isNaN(Number(odometerEnd)) ? Number(odometerEnd) : null
  const odometerStartNum = deliveryData?.compliance?.odometerStart ?? null
  const odometerValid = odometerEndNum !== null && (odometerStartNum === null || odometerEndNum > odometerStartNum)
  const dropoffReady = photosUploaded && odometerValid && locationHealth !== 'lost'
  const missingItems: string[] = []
  if (!photosUploaded) missingItems.push(`${6 - uploadedDropoffPhotos.length} dropoff photo(s)`)
  if (!odometerValid) {
    if (odometerEndNum === null) missingItems.push('Odometer reading')
    else missingItems.push('Odometer must be greater than start')
  }
  if (locationHealth === 'lost') missingItems.push('GPS signal')

  // ==================== MUTATIONS & QUERIES ====================

  // Location ping mutation (every 10 seconds via interval)
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

  // Throttle: only emit to server every 3 seconds (GPS may fire every 1-2s)
  const lastEmitTimeRef = useRef(0)
  const EMIT_THROTTLE_MS = 3000

  // ── GPS quality constants (Kalman-lite filtering — same approach Uber uses) ──
  // A simple EMA has two fatal flaws:
  //   1. No velocity awareness → lags behind when driving (icon appears 10-20m behind car)
  //   2. Jitter filter compares raw-to-raw → multipath jumps (20-40m) pass through
  // A Kalman filter predicts position from velocity, then corrects with GPS.
  // When stationary: prediction = current, GPS noise is tiny innovation → icon stays frozen ✅
  // When driving: prediction moves forward with velocity, GPS corrects small errors ✅
  // When multipath: prediction is far from bogus GPS → innovation is large → rejected ✅
  const GPS_WARMUP_READINGS = 0     // skip first N readings (cold start = garbage coords)
  const MAX_GPS_ACCURACY = 100      // meters — reject low-confidence readings
  const MAX_INNOVATION_METERS = 50  // meters — reject if GPS too far from KF prediction
  const KF_ALPHA = 0.3              // position correction weight (0=predict, 1=GPS)
  const KF_BETA = 0.15              // velocity update weight (how fast velocity adapts)
  const MAX_SPEED_DEG_PER_SEC = 50 / 111000 // ~112 mph velocity clamp (prevents divergence)

  // Haversine distance in meters between two points
  function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // Geolocation: GPS fires → filter → Kalman predict+correct → update UI → emit via socket (throttled)
  // Starts IMMEDIATELY — not gated on pickup/dropoff coords.
  // The driver needs to see their position even before route is calculated.
  useEffect(() => {

    // ── FAST INITIAL FIX: getCurrentPosition is faster than watchPosition's
    // first callback. Gets the car icon on the map 1-2s sooner.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (Math.abs(pos.coords.latitude) < 1 && Math.abs(pos.coords.longitude) < 1) return
        if (pos.coords.accuracy > MAX_GPS_ACCURACY) return
        setDriverPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {}, // ignore errors — watchPosition will handle retries
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
    )

    // Reset all tracking state when watchPosition restarts
    smoothedPositionRef.current = null
    prevCoordsRef.current = null
    prevGpsTimeRef.current = 0
    const warmupCount = { value: 0 }

    // ── Kalman-lite filter state (local to this watchPosition lifecycle) ──
    // Recreated each time the useEffect re-runs, so no stale state leaks.
    const kf = { lat: 0, lng: 0, vLat: 0, vLng: 0, init: false }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const rawLat = pos.coords.latitude
        const rawLng = pos.coords.longitude
        const accuracy = pos.coords.accuracy
        const now = Date.now()

        // ── FILTER 0: GPS cold start — skip first readings entirely ──
        // GPS chip returns garbage (often near 0,0) and LIES about accuracy.
        // The only fix: skip until satellite lock settles.
        if (warmupCount.value < GPS_WARMUP_READINGS) {
          warmupCount.value++
          setLastLocationTime(new Date())
          consecutiveMissedRef.current = 0
          return
        }

        // ── FILTER 0b: Null-island sanity check ──
        if (Math.abs(rawLat) < 1 && Math.abs(rawLng) < 1) {
          return
        }

        // ── FILTER 1: Accuracy — reject low-confidence readings ──
        if (accuracy > MAX_GPS_ACCURACY) {
          return
        }

        // ── Compute time delta from last ACCEPTED reading ──
        const dt = prevGpsTimeRef.current > 0 ? (now - prevGpsTimeRef.current) / 1000 : 0

        // ── KALMAN PREDICT STEP ──
        let predLat = rawLat
        let predLng = rawLng
        if (kf.init && dt > 0.1) {
          predLat = kf.lat + kf.vLat * dt
          predLng = kf.lng + kf.vLng * dt

          // ── FILTER 2: Innovation outlier — reject if GPS too far from prediction ──
          // This replaces both the old speed filter AND jitter filter.
          // It's strictly better because it accounts for the car's current velocity.
          //   Stationary + 30m multipath → innovation = 30m → rejected ✅
          //   Driving 20m/s + correct GPS → innovation ≈ 2m → accepted ✅
          //   Driving 20m/s + 80m multipath → innovation ≈ 65m → rejected ✅
          const innovDist = haversineMeters(predLat, predLng, rawLat, rawLng)
          if (innovDist > MAX_INNOVATION_METERS) {
            return // outlier — don't update any state
          }
        }

        // ── KALMAN CORRECT STEP ──
        if (!kf.init || dt <= 0.1) {
          // First valid reading — initialize filter
          kf.lat = rawLat
          kf.lng = rawLng
          kf.vLat = 0
          kf.vLng = 0
          kf.init = true
        } else {
          // Innovation = how far GPS is from where we predicted
          const innovLat = rawLat - predLat
          const innovLng = rawLng - predLng

          // Correct position: prediction + alpha * innovation
          kf.lat = predLat + KF_ALPHA * innovLat
          kf.lng = predLng + KF_ALPHA * innovLng

          // Update velocity estimate from innovation
          // If car accelerated, innovation is consistently positive → velocity adapts
          kf.vLat = kf.vLat + KF_BETA * (innovLat / dt)
          kf.vLng = kf.vLng + KF_BETA * (innovLng / dt)

          // Clamp velocity to prevent filter divergence from bad readings
          kf.vLat = Math.max(-MAX_SPEED_DEG_PER_SEC, Math.min(MAX_SPEED_DEG_PER_SEC, kf.vLat))
          kf.vLng = Math.max(-MAX_SPEED_DEG_PER_SEC, Math.min(MAX_SPEED_DEG_PER_SEC, kf.vLng))
        }

        const finalCoords = { lat: kf.lat, lng: kf.lng }

        // ── Accept this reading ──
        prevCoordsRef.current = { lat: rawLat, lng: rawLng }
        prevGpsTimeRef.current = now
        latestPositionRef.current = finalCoords

        // 1. Update driver UI — skip if position barely changed (prevents
        //    unnecessary re-renders and panTo calls when stationary)
        const prevSmoothed = smoothedPositionRef.current
        smoothedPositionRef.current = finalCoords
        if (prevSmoothed &&
            Math.abs(finalCoords.lat - prevSmoothed.lat) < 0.000001 &&
            Math.abs(finalCoords.lng - prevSmoothed.lng) < 0.000001) {
          // Position didn't change (~0.1mm) — skip setState, still update health
          setLastLocationTime(new Date())
          consecutiveMissedRef.current = 0
          setLocationHealth('healthy')
          // Still emit if throttle allows (dealer needs periodic confirmation driver is alive)
          const emitNow = Date.now()
          if (emitNow - lastEmitTimeRef.current >= EMIT_THROTTLE_MS) {
            lastEmitTimeRef.current = emitNow
            if (deliveryIdRef.current) {
              const socket = getSocket()
              const payload = { lat: finalCoords.lat, lng: finalCoords.lng, recordedAt: new Date().toISOString() }
              if (socket?.connected) {
                socket.emit('driver:location', payload)
              } else {
                locationPingMutation.mutate(payload)
              }
            }
          }
          return
        }

        setDriverPosition(finalCoords)

        // 2. Compute heading from raw coords (not smoothed — raw shows real direction)
        const nativeHeading = pos.coords.heading
        if (nativeHeading != null && !isNaN(nativeHeading) && nativeHeading !== 0) {
          setDriverHeading(nativeHeading)
        } else {
          const prev = prevCoordsRef.current
          if (prev && (Math.abs(rawLat - prev.lat) > 0.00001 || Math.abs(rawLng - prev.lng) > 0.00001)) {
            setDriverHeading((Math.atan2(rawLng - prev.lng, rawLat - prev.lat) * 180 / Math.PI + 360) % 360)
          }
        }
        setLastLocationTime(new Date())
        consecutiveMissedRef.current = 0
        setLocationHealth('healthy')

        // 3. Emit to server via socket, throttled to every 3s
        if (now - lastEmitTimeRef.current >= EMIT_THROTTLE_MS) {
          lastEmitTimeRef.current = now
          if (deliveryIdRef.current) {
            const socket = getSocket()
            const payload = { lat: finalCoords.lat, lng: finalCoords.lng, recordedAt: new Date().toISOString() }
            if (socket?.connected) {
              socket.emit('driver:location', payload)
            } else {
              // Socket not connected — HTTP fallback
              locationPingMutation.mutate(payload)
            }
          }
        }
      },
      (err) => {
        console.error(err)
        consecutiveMissedRef.current += 1
        if (err.code === 1) {
          setLocationHealth('lost')
        } else if (consecutiveMissedRef.current >= 3) {
          setLocationHealth('warning')
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []) // GPS starts once on mount — NOT gated on pickup/dropoff coords

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

  // Keep deliveryId ref in sync (used by watchPosition callback above)
  useEffect(() => {
    deliveryIdRef.current = deliveryId
  }, [deliveryId])

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

  // Send location ping — prefers Socket.io (lightweight), falls back to HTTP POST
  // Returns a Promise so the caller can await it (needed before complete-trip)
  const sendLocationPing = (position: google.maps.LatLngLiteral): Promise<void> => {
    return new Promise((resolve) => {
      if (!deliveryIdRef.current) { resolve(); return }
      const payload = {
        lat: position.lat,
        lng: position.lng,
        recordedAt: new Date().toISOString(),
      }

      // Prefer socket.io — open WebSocket connection, no HTTP overhead
      const socket = getSocket()
      if (socket?.connected) {
        socket.emit('driver:location', payload, (ack: any) => {
          // Ack callback — server confirms receipt (fire-and-forget if no ack)
          if (ack?.ok === false) {
            // Socket server rejected — fall back to HTTP
            console.warn('[Driver] Socket location rejected, falling back to HTTP')
            locationPingMutation.mutate(payload, {
              onSuccess: () => resolve(),
              onError: () => resolve(),
            })
          } else {
            resolve()
          }
        })
        // Timeout fallback: if server doesn't ack within 3s, don't block
        setTimeout(() => resolve(), 3000)
      } else {
        // Socket not connected — use HTTP POST as fallback
        locationPingMutation.mutate(payload, {
          onSuccess: () => resolve(),
          onError: () => resolve(), // resolve even on error — don't block completion
        })
      }
    })
  }

  // Location sending is now handled directly inside watchPosition callback (GPS → socket).
  // No polling interval needed — every GPS reading is pushed immediately (throttled 3s).

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  // ── SOCKET.IO: Join delivery room so driver gets real-time status updates ──
  useEffect(() => {
    if (deliveryId) {
      socketJoinDelivery(deliveryId)
    }
    return () => {
      if (deliveryId) {
        socketLeaveDelivery(deliveryId)
      }
    }
  }, [deliveryId])

  // ── SOCKET.IO: Listen for status changes from backend (e.g. admin completes delivery) ──
  const handleDriverStatusChanged = useCallback((data: any) => {
    if (data.deliveryId === deliveryId) {
      toast.info(`Delivery status updated: ${data.status}`, {
        description: 'Refreshing delivery details...',
      })
      activeDeliveryQuery.refetch()
    }
  }, [deliveryId, activeDeliveryQuery])
  useSocketEvent('delivery:status-changed', handleDriverStatusChanged)

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
      to: '/driver/issue-report',
      state: { deliveryId: deliveryId }
    })
  }

  // Dropoff photo handlers
  const handleAddDropoffPhoto = (index: number) => {
    if (isDesktop) {
      toast.error('Use your phone', {
        description: 'Drop-off photos must be taken with your phone camera. Please open this page on your mobile device.',
        duration: 5000,
      })
      return
    }
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
        setIsUploading(false)
        const photos = data.files.map(f => ({
          slotIndex: f.slotIndex,
          imageUrl: f.url,
        }))
        setUploadedDropoffPhotos(photos)
        setDropoffPhotosSaved(true)
        toast.success('Dropoff photos uploaded')
      },
      onError: (error) => {
        setIsUploading(false)
        toast.error('Upload failed', { description: error.message })
      },
    }
  )

  const handleUploadDropoffPhotos = async () => {
    const selectedCount = dropoffPhotoSlots.filter(slot => slot.file !== null).length
    if (selectedCount < 6) {
      toast.error('Need 6 photos', { description: `Please take all 6 dropoff photos. You have ${selectedCount}/6.` })
      return
    }

    setIsUploading(true)
    try {
      const rawFiles = dropoffPhotoSlots.map(slot => slot.file!).filter(Boolean)
      const formData = await buildCompressedUploadPayload(rawFiles, deliveryId, 'DROPOFF')
      uploadDropoffPhotosMutation.mutate(formData)
    } catch (err) {
      setIsUploading(false)
      toast.error('Photo compression failed', { description: 'Please try again.' })
    }
  }

  // Complete trip mutation
  const completeTripMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/complete-trip`,
    {
      onSuccess: (response) => {
        toast.success('Trip completed')
        // Use the actual net payout from backend if available, otherwise fall back to the estimate
        const netAmount = response?.payout?.netAmount
        setCompletionPayout(netAmount != null ? netAmount : driverPayoutEstimate)
        setShowCompletion(true)
      },
      onError: (error) => {
        toast.error('Failed to complete trip', { description: error.message })
      },
    }
  )

  // Actual trip completion — only called after compliance succeeds
  const handleCompleteTrip = async () => {
    if (!driverId || !userId) return

    // Send a final location ping and AWAIT it before completing the trip.
    // Previously this was fire-and-forget, causing a race condition where
    // complete-trip hit the backend before the ping arrived, resulting in
    // "insufficient tracking data" errors on short trips.
    try {
      if (latestPositionRef.current) {
        await locationPingMutation.mutateAsync({
          lat: latestPositionRef.current.lat,
          lng: latestPositionRef.current.lng,
          recordedAt: new Date().toISOString(),
        })
      }
    } catch {
      // Ping failed — still attempt completion with existing tracking data
    }

    const payload = {
      driverId,
      actorUserId: userId,
      actorRole: 'DRIVER',
    }
    completeTripMutation.mutate(payload)
  }

  // Submit dropoff compliance
  const submitComplianceMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/dropoff-compliance`,
    {
      onSuccess: () => {
        toast.success('Dropoff compliance submitted')
        // After compliance is saved, automatically complete the trip
        handleCompleteTrip()
      },
      onError: (error) => {
        toast.error('Compliance submission failed', { description: error.message })
      },
    }
  )

  // Complete delivery: validates inputs, submits compliance, then auto-completes trip
  const handleCompleteDelivery = async () => {
    if (!driverId || !userId) return

    // Block completion if location is lost
    if (locationHealth === 'lost') {
      toast.error('Location signal lost', {
        description: 'Please enable location services and ensure GPS is working before completing the delivery.',
        duration: 8000,
      })
      return
    }

    if (!odometerEnd || isNaN(Number(odometerEnd))) {
      toast.error('Odometer reading required', { description: 'Please enter the odometer reading before completing.' })
      return
    }

    if (uploadedDropoffPhotos.length < 6) {
      toast.error('Photos required', { description: `Upload all 6 dropoff photos first. You have ${uploadedDropoffPhotos.length}/6.` })
      return
    }

    // Step 1: Submit dropoff compliance (odometerEnd + photos) to DB
    // On success, the onSuccess callback above auto-calls handleCompleteTrip()
    submitComplianceMutation.mutate({
      driverId,
      odometerEnd: Number(odometerEnd),
      photos: uploadedDropoffPhotos.map(p => ({
        slotIndex: p.slotIndex,
        imageUrl: p.imageUrl,
      })),
    })
  }

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      dropoffPhotoSlots.forEach(slot => {
        if (slot.preview) URL.revokeObjectURL(slot.preview)
      })
    }
  }, [dropoffPhotoSlots])

  // Helper to format time from ISO string (custom: returns em-dash instead of '--')
  const formatTime = (isoString?: string) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ })
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
      title: 'Vehicle Drop-off Proof',
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

  // Dismiss handler for PostTripCompletion — stable reference via useCallback
  // so the auto-dismiss timer in PostTripCompletion doesn't reset on every GPS re-render
  const handleDismissCompletion = useCallback(() => {
    setShowCompletion(false)
    navigate({ to: '/driver/dashboard' })
  }, [navigate])

  // If there's no data (and not loading), show a message
  // BUT skip early return when completion overlay is showing — let it dismiss naturally
  // hasOnlyBooked = driver has booked deliveries but no active one — show queue below
  if (hasNoData && !showCompletion) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex items-center justify-center">
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">No Active Deliveries</CardTitle>
            <CardDescription className="text-sm mt-1">
              You don't have any active or booked deliveries at the moment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate({ to: '/driver/dashboard' })}
              className="w-full lime-btn rounded-2xl py-3 font-extrabold"
            >
              Browse Gigs
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {drivingMode && deliveryData ? (
        <>
          {/* ═══════════════════════════════════════════════ */}
          {/* DRIVING MODE — Full-screen navigation view       */}
          {/* ═══════════════════════════════════════════════ */}

          {/* Full-screen map */}
          <div className="fixed inset-0 z-0">
            {isLoaded ? (
              <RouteMap
                pickup={pickupCoords}
                dropoff={dropoffCoords}
                driverPosition={driverPosition}
                driverHeading={driverHeading}
                directionsResult={routes[0] || null}
                selectedRouteIndex={selectedRouteIndex}
                isLoaded={isLoaded}
                focusOnDriver={true}
                followDriver={true}
                showMarkerLabels={false}
                lockViewport={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                Loading map...
              </div>
            )}
          </div>

          {/* Top overlay — address + ETA + payout */}
          <div className="fixed top-0 left-0 right-0 z-10 pointer-events-none">
            <div className="bg-gradient-to-b from-white/90 dark:from-slate-950/90 via-white/70 dark:via-slate-950/70 to-transparent pb-8">
              <div className="max-w-[980px] mx-auto px-5 sm:px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => navigate({ to: '/driver/dashboard' })}
                      className="pointer-events-auto w-10 h-10 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-lg shrink-0"
                    >
                      <ArrowBack className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                        Active Delivery
                      </p>
                      <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">
                        {deliveryData?.dropoffAddress || '—'}
                      </p>
                      {deliveryData?.etaMinutes ? (
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
                          ETA: {Math.round(deliveryData.etaMinutes)} {deliveryData.etaMinutes === 1 ? 'minute' : 'minutes'}
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-slate-400 mt-1">
                          Navigating...
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-primary">
                      ${driverPayoutEstimate != null ? driverPayoutEstimate.toFixed(2) : '—'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Est. payout
                    </p>
                  </div>
                </div>

                {/* GPS tracking status indicator — inside header overlay, below content */}
                <div className="mt-3 pointer-events-auto">
                  <div className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur shadow-lg text-[10px] font-extrabold uppercase tracking-widest',
                    locationHealth === 'healthy'
                      ? 'bg-green-500/90 text-white'
                      : locationHealth === 'warning'
                      ? 'bg-amber-500/90 text-white'
                      : 'bg-red-500/90 text-white'
                  )}>
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      locationHealth === 'healthy' ? 'bg-white animate-pulse' : 'bg-white/70'
                    )} />
                    {locationHealth === 'healthy' ? 'Tracking' : locationHealth === 'warning' ? 'Weak GPS' : 'No GPS'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Location health warnings (overlay on map) */}
          {locationHealth === 'lost' && (
            <div className="fixed top-28 left-4 right-4 z-20">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-red-50/95 dark:bg-red-900/90 backdrop-blur border border-red-200 dark:border-red-900/30 shadow-lg">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-extrabold text-red-900 dark:text-red-200">Location signal lost</p>
                  <p className="text-[11px] text-red-800/80 dark:text-red-200/80">Enable location services to continue.</p>
                </div>
              </div>
            </div>
          )}

          {locationHealth === 'warning' && (
            <div className="fixed top-28 left-4 right-4 z-20">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50/95 dark:bg-amber-900/90 backdrop-blur border border-amber-200 dark:border-amber-900/30 shadow-lg">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">GPS signal weak</p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">Location updates delayed.</p>
                </div>
              </div>
            </div>
          )}

          {/* Bottom — 2x2 action grid */}
          <div className="fixed bottom-0 left-0 right-0 z-10 safe-bottom">
            <div className="bg-gradient-to-t from-white/95 dark:from-slate-950/95 via-white/85 dark:via-slate-950/85 to-transparent pt-8 pb-20 px-5 sm:px-6">
              <div className="max-w-[980px] mx-auto">
                {/* Distance label */}
                {distanceToDropoff !== null && !isWithinGeofence && (
                  <p className="text-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                    {distanceToDropoff.toFixed(1)} mi away
                  </p>
                )}
                {isWithinGeofence && (
                  <p className="text-center text-xs font-bold text-green-600 dark:text-green-400 mb-2">
                    You&apos;ve arrived
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Top-left: View Details */}
                  <button
                    onClick={() => setDrivingMode(false)}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 text-sm font-extrabold text-slate-700 dark:text-slate-200 shadow-md hover:bg-white dark:hover:bg-slate-800 transition active:scale-[0.98]"
                  >
                    <Info className="w-4 h-4 text-primary" />
                    View Details
                  </button>

                  {/* Top-right: Complete Delivery (geofenced) */}
                  <button
                    onClick={handleOpenCompleteFlow}
                    disabled={!isWithinGeofence}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-extrabold shadow-lg transition active:scale-[0.98]',
                      isWithinGeofence
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                    )}
                  >
                    <CheckCircle className="w-5 h-5" />
                    Complete Delivery
                  </button>

                  {/* Bottom-left: Call Recipient */}
                  {deliveryData?.recipientPhone ? (
                    <a
                      href={`tel:${deliveryData.recipientPhone}`}
                      className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm shadow-lg transition active:scale-[0.98]"
                    >
                      <Phone className="w-5 h-5" />
                      Call Recipient
                    </a>
                  ) : (
                    <div />
                  )}

                  {/* Bottom-right: Text Recipient */}
                  {deliveryData?.recipientPhone ? (
                    <a
                      href={`sms:${deliveryData.recipientPhone}`}
                      className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-lg transition active:scale-[0.98]"
                    >
                      <MessageSquare className="w-5 h-5" />
                      Text Recipient
                    </a>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ═══════════════════════════════════════ */}
          {/* DETAIL MODE — Full information view    */}
          {/* ═══════════════════════════════════════ */}

          {/* Header (keep existing exactly as-is) */}
          <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  to="/driver/dashboard"
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

          <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-28">
            {/* NEW: Back to Navigation button (only when there's an active delivery) */}
            {deliveryData && (
              <button
                onClick={() => setDrivingMode(true)}
                className="w-full mb-4 flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/25 text-slate-900 dark:text-white hover:bg-primary/15 transition shadow-sm"
              >
                <Navigation className="w-5 h-5 text-primary" />
                <span className="text-sm font-extrabold">Back to Navigation</span>
              </button>
            )}
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

        {/* ═══════════════════════════════════════ */}
        {/* ACTIVE DELIVERY (in-progress trip)     */}
        {/* ═══════════════════════════════════════ */}
        {deliveryData && (
        <React.Fragment>
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
                      ${driverPayoutEstimate != null ? driverPayoutEstimate.toFixed(2) : '—'}
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
                    {deliveryData?.etaMinutes && (
                      <div className="mt-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                          <Speed className="w-3.5 h-3.5 text-primary" />
                          ETA: {Math.round(deliveryData.etaMinutes)} MIN
                        </div>
                      </div>
                    )}
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
                  focusOnDriver={true}
                  followDriver={true}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                  Loading map...
                </div>
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
          <div ref={dropoffSectionRef}>
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
            <CardHeader>
              <div>
                <CardTitle className="text-lg font-black">Drop-off Photos</CardTitle>
                <CardDescription className="text-sm mt-1">
                  (6 Required)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isDesktop && (
                <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-800 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                      Use Your Phone to Take Photos
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                      Drop-off photos must be captured live with your phone camera. Please open this page on your mobile device.
                    </p>
                  </div>
                </div>
              )}
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
                  disabled={isUploading || dropoffPhotoSlots.filter(s => s.file !== null).length < 6}
                  className={cn(
                    "w-full font-extrabold rounded-2xl py-3 flex items-center justify-center gap-2 transition",
                    isUploading
                      ? "bg-amber-500 text-white cursor-wait"
                      : dropoffPhotoSlots.filter(s => s.file !== null).length >= 6
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  <CloudUpload className="w-4 h-4" />
                  {dropoffPhotosSaved ? 'Photos Uploaded' : isUploading ? 'Uploading...' : 'Upload All Photos'}
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
                  disabled={!dropoffReady || submitComplianceMutation.isPending || completeTripMutation.isPending}
                  className="w-full lime-btn rounded-2xl py-3 font-extrabold flex items-center justify-center gap-2"
                >
                  {(submitComplianceMutation.isPending || completeTripMutation.isPending) ? 'Completing delivery...' : 'Complete Delivery'}
                  <ArrowForward className="w-5 h-5" />
                </Button>
                {!dropoffReady && missingItems.length > 0 ? (
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                      Before completing: {missingItems.join(' \u00B7 ')}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    Upload photos + enter odometer, then tap to finish
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </section>
        </React.Fragment>
        )}

        {/* Between deliveries — no active trip right now */}
        {!deliveryData && (
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Inbox className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No active delivery right now</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Check your upcoming deliveries to see what's next.
                  </p>
                  <Button
                    onClick={() => navigate({ to: '/driver/booked-later' })}
                    className="mt-3 lime-btn rounded-2xl px-5 py-2.5 text-sm font-extrabold"
                  >
                    Go to Upcoming Deliveries
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              © 2026 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
        </>
      )}

      {/* Post-Trip Completion Overlay */}
      {showCompletion && (
        <PostTripCompletion
          payout={completionPayout ?? driverPayoutEstimate ?? 0}
          tripStartTime={deliveryData?.trackingSession?.startedAt}
          onDismiss={handleDismissCompletion}
        />
      )}
      <DriverBottomNav activeTab="in-progress" />
    </div>
 )
}