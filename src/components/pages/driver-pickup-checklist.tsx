// app/pages/driver/pickup-checklist.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Camera,
  Gauge as Speed,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Check,
  X,
  CloudUpload,
  Ruler as Distance,
  CheckCircle2 as TaskAlt,
  Headset as SupportAgent,
  Lock,
  Circle as RadioButtonUnchecked,
  FileCheck as FactCheck,
  Home,
  Car,
  Inbox,
  Menu as MenuIcon,
  MapPin,
  CarFront,
  QrCode,
  Shield,
  Play,
  Clock,
  Phone,
  MessageSquare,
} from 'lucide-react'
import { AddressLink } from '@/components/shared/AddressLink'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getUser, useCreate, useDataQuery, useFileUpload } from '@/lib/tanstack/dataQuery'
import { savePhoto, getPhotosForDelivery, clearDeliveryPhotos } from '@/lib/pickup-photo-store'
import { compressPhoto, compressPhotos, buildCompressedUploadPayload } from '@/lib/image-compress'
import { BUSINESS_TZ } from '@/lib/timezone'

// Photo slot labels — matching reference image guide order
const PHOTO_LABELS = [
  'Left Front Corner',
  'Right Front Corner',
  'Passenger Side',
  'Right Rear Corner',
  'Left Rear Corner',
  "Driver's Side",
]

// Reference images shown on each tile before the driver captures a photo
// BASE_URL handles sub-path deployments (e.g. /app/) automatically
const ANGLE_REF_IMAGES = [
  `/assets/angle-1-left-front.jpeg`,
  `/assets/angle-2-right-front.jpeg`,
  `/assets/angle-3-passenger-side.jpeg`,
  `/assets/angle-4-right-rear.jpeg`,
  `/assets/angle-5-left-rear.jpeg`,
  `/assets/angle-6-driver-side.jpeg`,
]

// localStorage persistence key scoped to delivery
const STORAGE_KEY = (deliveryId: string) => `pickup-checklist-${deliveryId}`

type PersistedState = {
  greeted: boolean
  photosSaved: boolean
  uploadedPhotos: Array<{ slotIndex: number; imageUrl: string }>
  odometerSaved: boolean
  odometerValue: string
  vinPhotoSaved: boolean
  vinVerified: boolean
  vinValue: string
  step1Timestamp: string | null
}

function buildPinSmsBody(driverName: string | null | undefined, delivery: any): string {
  const vehicle = [delivery?.vehicleColor, delivery?.vehicleMake, delivery?.vehicleModel].filter(Boolean).join(' ')
  const plate = delivery?.licensePlate || ''
  const address = delivery?.pickupAddress || ''
  const name = driverName || 'your driver'
  return `Hi, this is ${name} with 101 Drivers. I'm the driver picking up the ${vehicle}${plate ? ` with license plate ${plate}` : ''} at ${address}. Can you please send me the 4-digit pickup PIN? Thank you.`
}

function loadPersistedState(deliveryId: string): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(deliveryId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistState(deliveryId: string, state: Partial<PersistedState>) {
  try {
    localStorage.setItem(STORAGE_KEY(deliveryId), JSON.stringify(state))
  } catch {
    // localStorage might be full or unavailable
  }
}

function clearPersistedState(deliveryId: string) {
  try {
    localStorage.removeItem(STORAGE_KEY(deliveryId))
  } catch {
    // ignore
  }
  // Also clear IndexedDB photo blobs
  clearDeliveryPhotos(deliveryId).catch(() => { /* best effort */ })
}

// Detect if the user is on a device without a real camera (desktop/laptop).
// On mobile, `capture` triggers the native camera. On desktop, browsers
// ignore it and fall back to the file picker — we want to block that.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    // 'ontouchstart' missing + no small screen = likely desktop
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isSmallScreen = window.innerWidth < 1024
    setIsDesktop(!hasTouchScreen && !isSmallScreen)
  }, [])
  return isDesktop
}

export default function DriverPickupChecklistPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const isDesktop = useIsDesktop()
  const driverId = user?.profileId
  const userId = user?.id
  const navigate = useNavigate()
  // Get deliveryId from route params (if available)
  const { jobId: deliveryId } = useSearch({ strict: false }) as { jobId: string }

  // Fetch delivery details for order info display
  const { data: deliveryData } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${driverId}/${deliveryId}`,
    noFilter: true,
    enabled: Boolean(driverId && deliveryId),
  })

  // Also try active delivery endpoint for richer data (vehicle, contacts)
  // Returns array: [{ delivery: {...} }, ...] — ACTIVE first, then BOOKED
  const { data: activeData } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/active-delivery/${driverId}`,
    noFilter: true,
    enabled: Boolean(driverId),
    staleTime: 0, // always refetch — critical after booking navigation from job-details
  })

  const assignments = Array.isArray(activeData) ? activeData : []
  // Merge: prefer active delivery data (has vehicle/contacts), fallback to feed data
  const activeDeliveryData = assignments.find((a: any) => a.delivery?.id === deliveryId)
  const delivery = activeDeliveryData?.delivery || deliveryData

  // Guard: check if driver has ANOTHER delivery currently ACTIVE (not this one)
  const hasOtherActiveDelivery = assignments.some(
    (a: any) => a.delivery?.status === 'ACTIVE' && a.delivery?.id !== deliveryId
  )

  // Location permission state
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [isCheckingLocation, setIsCheckingLocation] = useState(false)

  // GPS proximity check for "Start Pickup Now" — verifies driver is at the lot
  const [isDriverAtPickup, setIsDriverAtPickup] = useState<boolean | null>(null) // null = not yet checked

  // Early-start confirmation dialog — shown when driver taps Start Trip before the scheduled window
  const [showEarlyStartDialog, setShowEarlyStartDialog] = useState(false)

  // First-pickup-of-day check: if driver has other BOOKED/ACTIVE deliveries besides this one,
  // they've already done or are doing a gig today. If this is their ONLY delivery and it's
  // before the window start, it's the first pickup and early start is blocked.
  const hasOtherAssignments = assignments.filter(
    (a: any) => a.delivery?.id !== deliveryId
  ).length > 0
  const isBeforeWindow = delivery?.pickupWindowStart && new Date(delivery.pickupWindowStart) > new Date()
  const isFirstPickupOfDay = !hasOtherAssignments && !!isBeforeWindow

  // GPS proximity check mutation — verifies driver is at the pickup lot for early start
  const proximityCheckMutation = useCreate<{ withinRadius: boolean }, { driverLat: number; driverLng: number }>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/check-pickup-proximity`,
    {
      onSuccess: (data) => {
        setIsDriverAtPickup(data.withinRadius)
      },
      onError: () => {
        setIsDriverAtPickup(null) // check failed, don't block
      },
    }
  )

  useEffect(() => {
    if (!deliveryId || !delivery?.pickupWindowStart) return
    // Don't check proximity if it's the first pickup of the day (early start blocked)
    if (isFirstPickupOfDay) {
      setIsDriverAtPickup(null)
      return
    }
    // Only check proximity if the pickup window hasn't started yet (early start scenario)
    const windowStart = new Date(delivery.pickupWindowStart as string)
    const now = new Date()
    if (windowStart > now) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          proximityCheckMutation.mutate({
            driverLat: position.coords.latitude,
            driverLng: position.coords.longitude,
          })
        },
        () => {
          setIsDriverAtPickup(null) // location denied, don't block
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      )
    } else {
      // Window already started — no need for early start check
      setIsDriverAtPickup(null)
    }
  }, [deliveryId, delivery?.pickupWindowStart])

  // ── Step 1: I'm at the vehicle ──
  const saved = deliveryId ? loadPersistedState(deliveryId) : null
  const [greeted, setGreeted] = useState(saved?.greeted ?? false)

  // ── Step 2: 6 clockwise car photos ──
  const [photoSlots, setPhotoSlots] = useState<Array<{ file: File | null; preview: string | null }>>(
    Array(6).fill(null).map(() => ({ file: null, preview: null }))
  )
  const [photosSaved, setPhotosSaved] = useState(saved?.photosSaved ?? false)
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ slotIndex: number; imageUrl: string }>>(
    saved?.uploadedPhotos ?? []
  )
  const [photoErrors, setPhotoErrors] = useState<Set<number>>(new Set())
  const [photosUploading, setPhotosUploading] = useState(false)

  // ── Step 3: VIN Photo ──
  const [odometerPhoto, setOdometerPhoto] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [odometerValue, setOdometerValue] = useState(saved?.odometerValue ?? '')
  const [odometerSaved, setOdometerSaved] = useState(saved?.odometerSaved ?? false)
  const [odometerUploading, setOdometerUploading] = useState(false)
  const [odometerUploadError, setOdometerUploadError] = useState(false)

  // ── Step 4: Odometer photo + reading ──
  const [vinPhoto, setVinPhoto] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [vinPhotoSaved, setVinPhotoSaved] = useState(saved?.vinPhotoSaved ?? false)
  const [vinPhotoUploading, setVinPhotoUploading] = useState(false)
  const [vinPhotoUploadError, setVinPhotoUploadError] = useState(false)
  const [odometerError, setOdometerError] = useState<string | null>(null)
  // ── Restore photo files from IndexedDB on mount (survives reload) ──
  const [photosRestored, setPhotosRestored] = useState(false)
  useEffect(() => {
    if (!deliveryId || photosRestored) return
    let cancelled = false

    getPhotosForDelivery(deliveryId).then((photos) => {
      if (cancelled) return

      const newSlots = Array(6).fill(null).map(() => ({ file: null as File | null, preview: null as string | null }))
      let restoredOdometer: File | null = null
      let restoredVin: File | null = null

      for (const p of photos) {
        const preview = URL.createObjectURL(p.file)
        if (p.type === 'car' && p.index >= 0 && p.index < 6) {
          newSlots[p.index] = { file: p.file, preview }
        } else if (p.type === 'odometer') {
          restoredOdometer = p.file
        } else if (p.type === 'vin') {
          restoredVin = p.file
        }
      }

      setPhotoSlots(newSlots)
      if (restoredOdometer) {
        setOdometerPhoto({ file: restoredOdometer, preview: URL.createObjectURL(restoredOdometer) })
      }
      if (restoredVin) {
        setVinPhoto({ file: restoredVin, preview: URL.createObjectURL(restoredVin) })
      }
      setPhotosRestored(true)
    }).catch(() => {
      // IndexedDB unavailable — continue without restored photos
      setPhotosRestored(true)
    })

    return () => { cancelled = true }
  }, [deliveryId, photosRestored])

  // ── Step 5: Confirm & Submit ──
  const [vinValue, setVinValue] = useState(saved?.vinValue ?? '')
  const [vinError, setVinError] = useState<string | null>(null)
  const [vinVerified, setVinVerified] = useState(saved?.vinVerified ?? false)

  // ── Step 6: Customer PIN (optional) ──
  const [pinValue, setPinValue] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinVerified, setPinVerified] = useState(false)
  const [pinVerifying, setPinVerifying] = useState(false)

  // Refs for file inputs
  const carPhotoInputRef = useRef<HTMLInputElement>(null)
  const odometerInputRef = useRef<HTMLInputElement>(null)
  const vinPhotoInputRef = useRef<HTMLInputElement>(null)
  const currentSlotIndex = useRef<number | null>(null)
  const currentInputTarget = useRef<'car' | 'odometer' | 'vin'>('car')

  // Persist progress to localStorage whenever key state changes
  useEffect(() => {
    if (!deliveryId || vinVerified) return // don't overwrite after final submission
    persistState(deliveryId, {
      greeted,
      photosSaved,
      uploadedPhotos,
      odometerSaved,
      odometerValue,
      vinPhotoSaved,
      vinVerified,
      vinValue,
      step1Timestamp: greeted ? saved?.step1Timestamp ?? new Date().toISOString() : null,
    })
  }, [greeted, photosSaved, uploadedPhotos, odometerSaved, odometerValue, vinPhotoSaved, vinVerified, vinValue, deliveryId])

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  // Cleanup: only revoke object URLs on unmount.
  // Do NOT clear persisted state here — a page refresh unmounts the component
  // first, which would wipe localStorage before it can be restored.
  // Persisted state is cleared explicitly in handleCancel and after successful submission.
  useEffect(() => {
    return () => {
      photoSlots.forEach(slot => {
        if (slot.preview) URL.revokeObjectURL(slot.preview)
      })
      if (odometerPhoto.preview) URL.revokeObjectURL(odometerPhoto.preview)
      if (vinPhoto.preview) URL.revokeObjectURL(vinPhoto.preview)
    }
  }, [])

  // ── Mutations ──

  // Upload 6 car photos
  const uploadCarPhotosMutation = useFileUpload<{ ok: boolean; files: Array<{ slotIndex: number; url: string }> }>(
    `${import.meta.env.VITE_API_URL}/api/uploads/delivery-evidence`,
    {
      onSuccess: (data) => {
        setPhotosUploading(false)
        const photos = data.files.map(f => ({
          slotIndex: f.slotIndex,
          imageUrl: f.url,
        }))
        setUploadedPhotos(photos)
        setPhotosSaved(true)
        setPhotoErrors(new Set())
        toast.success('Car photos saved', {
          description: '6 vehicle photos uploaded.',
        })
      },
      onError: () => {
        setPhotosUploading(false)
        const failedSlots = new Set<number>()
        photoSlots.forEach((slot, i) => {
          if (slot.file) failedSlots.add(i)
        })
        setPhotoErrors(failedSlots)
        toast.error('Some photos failed to upload', {
          description: 'Tap the failed photos to retry.',
        })
      },
    }
  )

  // Upload odometer photo
  const uploadOdometerMutation = useFileUpload<{ ok: boolean; files: Array<{ slotIndex: number; url: string }> }>(
    `${import.meta.env.VITE_API_URL}/api/uploads/delivery-evidence`,
    {
      onSuccess: (data) => {
        setOdometerUploading(false)
        setOdometerSaved(true)
        toast.success('Odometer photo saved')
      },
      onError: () => {
        setOdometerUploading(false)
        setOdometerUploadError(true)
        toast.error('Odometer photo failed to upload', {
          description: 'Tap to retry.',
        })
      },
    }
  )

  // Upload VIN photo
  const uploadVinPhotoMutation = useFileUpload<{ ok: boolean; files: Array<{ slotIndex: number; url: string }> }>(
    `${import.meta.env.VITE_API_URL}/api/uploads/delivery-evidence`,
    {
      onSuccess: (data) => {
        setVinPhotoUploading(false)
        setVinPhotoSaved(true)
        toast.success('VIN photo saved')
      },
      onError: () => {
        setVinPhotoUploading(false)
        setVinPhotoUploadError(true)
        toast.error('VIN photo failed to upload', {
          description: 'Tap to retry.',
        })
      },
    }
  )

  // Save entire checklist (VIN digits, all photo URLs, odometer)
  const saveProgressMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/pickup-compliance`,
    {
      onSuccess: () => {
        setVinVerified(true)
        if (deliveryId) clearPersistedState(deliveryId)
        toast.success('Checklist complete!', {
          description: 'Tracking & location services are now active.',
        })
        // Auto-trigger location check after save
        checkLocationPermission()
      },
      onError: (error: any) => {
        const msg = error?.message || ''
        if (msg.toLowerCase().includes('vin') || msg.toLowerCase().includes('verification code')) {
          setVinError('VIN digits did not match. Please re-enter.')
          toast.error('VIN verification failed', {
            description: 'The last 4 digits you entered do not match. Please check and try again.',
            duration: 6000,
          })
        } else {
          toast.error('Failed to save checklist', {
            description: msg || 'Please check your connection and try again.',
          })
        }
      },
    }
  )

  // Start trip
  const startTripMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/start-trip`,
    {
      onSuccess: () => {
        if (deliveryId) clearPersistedState(deliveryId)
        toast.success('Trip started!', {
          description: 'You are now on route. Drive safe!',
        })
        navigate({ to: '/driver-active', search: { jobId: deliveryId } as any })
      },
      onError: (error: any) => {
        toast.error('Failed to start trip', {
          description: error?.message || 'Unknown error',
        })
      },
    }
  )

  // ── Handlers ──

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/driver-signin' })
  }

  // Step 1: Confirm at vehicle
  const handleArrivedAtVehicle = () => {
    setGreeted(true)
    toast.success('You are at the vehicle.', {
      description: 'Now take 6 vehicle photos clockwise around the car.',
    })
  }

  // Step 2: Car photos
  const handleAddCarPhoto = (index: number) => {
    currentSlotIndex.current = index
    currentInputTarget.current = 'car'
    carPhotoInputRef.current?.click()
  }

  const handleUploadCarPhotos = async () => {
    const allPhotosAdded = photoSlots.every(slot => slot.file !== null)
    if (!allPhotosAdded) {
      toast.error('Missing photos', {
        description: 'Please capture all 6 vehicle photos.',
      })
      return
    }
    setPhotosUploading(true)
    try {
      const rawFiles = photoSlots.map(slot => slot.file!).filter(Boolean)
      const formData = await buildCompressedUploadPayload(rawFiles, deliveryId, 'PICKUP')
      uploadCarPhotosMutation.mutate(formData)
    } catch (err) {
      setPhotosUploading(false)
      toast.error('Photo compression failed', { description: 'Please try again.' })
    }
  }

  // Step 3: VIN photo
  const handleAddOdometerPhoto = () => {
  setOdometerError(null)
  currentInputTarget.current = 'odometer'
  odometerInputRef.current?.click()
}

const handleUploadOdometerPhoto = async () => {
  if (!odometerPhoto.file) {
    setOdometerError('Take a photo of the odometer')
    return
  }
  if (!odometerValue) {
    setOdometerError('Enter the mileage reading')
    return
  }

  setOdometerError(null) // clear any error
  setOdometerUploading(true)
  try {
    const compressed = await compressPhoto(odometerPhoto.file)
    const formData = new FormData()
    formData.append('files', compressed)
    formData.append('deliveryId', deliveryId)
    formData.append('phase', 'PICKUP')
    uploadOdometerMutation.mutate(formData)
  } catch (err) {
    setOdometerUploading(false)
    toast.error('Photo compression failed', { description: 'Please try again.' })
  }
}

  // Step 4: Odometer photo
  const handleAddVinPhoto = () => {
    currentInputTarget.current = 'vin'
    vinPhotoInputRef.current?.click()
  }

  const handleUploadVinPhoto = async () => {
    if (!vinPhoto.file) {
      toast.error('Photo required', {
        description: 'Please take a photo of the full VIN number.',
      })
      return
    }
    setVinPhotoUploading(true)
    try {
      const compressed = await compressPhoto(vinPhoto.file)
      const formData = new FormData()
      formData.append('files', compressed)
      formData.append('deliveryId', deliveryId)
      formData.append('phase', 'PICKUP')
      uploadVinPhotoMutation.mutate(formData)
    } catch (err) {
      setVinPhotoUploading(false)
      toast.error('Photo compression failed', { description: 'Please try again.' })
    }
  }

  // Unified file change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (currentInputTarget.current === 'car' && currentSlotIndex.current !== null) {
      const index = currentSlotIndex.current
      const previewUrl = URL.createObjectURL(file)
      setPhotoSlots(prev => {
        const newSlots = [...prev]
        if (newSlots[index].preview) URL.revokeObjectURL(newSlots[index].preview!)
        newSlots[index] = { file, preview: previewUrl }
        return newSlots
      })
      // Persist to IndexedDB so it survives reload
      if (deliveryId) savePhoto(deliveryId, 'car', index, file).catch(() => {})
    } else if (currentInputTarget.current === 'odometer') {
      const previewUrl = URL.createObjectURL(file)
      if (odometerPhoto.preview) URL.revokeObjectURL(odometerPhoto.preview)
      setOdometerPhoto({ file, preview: previewUrl })
      setOdometerUploadError(false)
      // Persist to IndexedDB
      if (deliveryId) savePhoto(deliveryId, 'odometer', 0, file).catch(() => {})
    } else if (currentInputTarget.current === 'vin') {
      const previewUrl = URL.createObjectURL(file)
      if (vinPhoto.preview) URL.revokeObjectURL(vinPhoto.preview)
      setVinPhoto({ file, preview: previewUrl })
      setVinPhotoUploadError(false)
      // Persist to IndexedDB
      if (deliveryId) savePhoto(deliveryId, 'vin', 0, file).catch(() => {})
    }

    e.target.value = ''
  }

  // VIN input handler — numbers only, max 4 digits, strips spaces on paste
  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[\s\-]/g, '') // strip spaces and dashes
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 4) // keep only digits, max 4
    setVinValue(digitsOnly)
    setVinError(null)
    if (raw.length > 0 && digitsOnly.length === 0) {
      setVinError('Numbers only')
    } else if (raw.replace(/\D/g, '').length > 0 && raw.replace(/\D/g, '').length < 4 && raw.length >= 4) {
      // User typed 4+ chars but fewer than 4 were digits — only show if they stopped typing non-digits
    }
    // Auto-submit on 4th digit (same pattern as PIN auto-verify)
    if (digitsOnly.length === 4 && !vinVerified && !saveProgressMutation.isPending) {
      setTimeout(() => handleSubmitAll(digitsOnly), 300)
    }
  }

  // Step 6: Submit all checklist data (called on 4th VIN digit)
  const handleSubmitAll = (overrideVin?: string) => {
    const vin = overrideVin ?? vinValue
    // Validate prerequisite steps
    if (!greeted) {
      toast.error('Step 1 missing', { description: 'Please confirm you are at the vehicle.' })
      return
    }
    if (!photosSaved || uploadedPhotos.length !== 6) {
      toast.error('Car photos not uploaded', { description: 'Please upload all 6 vehicle photos.' })
      return
    }
    if (!odometerSaved) {
      toast.error('Odometer photo not saved', { description: 'Please upload the odometer photo.' })
      return
    }
    if (!odometerValue || isNaN(Number(odometerValue)) || Number(odometerValue) < 0) {
      toast.error('Odometer reading required', { description: 'Please enter the current odometer mileage.' })
      return
    }
    if (!vinPhotoSaved) {
      toast.error('VIN photo not saved', { description: 'Please upload the VIN photo.' })
      return
    }
    // VIN is guaranteed 4 digits when called from auto-submit, but validate anyway
    if (!/^\d{4}$/.test(vin)) {
      setVinError(vin.length < 4 ? 'Enter last 4 digits' : 'Numbers only')
      toast.error('VIN digits required', { description: 'Enter the last 4 digits (numbers only).' })
      return
    }

    // Backend expects exactly 6 photos (slots 1-6) + odometerStart as number + vinVerificationCode
    const payload = {
      driverId,
      vinVerificationCode: vin,
      odometerStart: Math.floor(Number(odometerValue)),
      photos: uploadedPhotos.map(p => ({ slotIndex: p.slotIndex, imageUrl: p.imageUrl })),
    }

    saveProgressMutation.mutate(payload)
  }

  // GPS check
  const checkLocationPermission = async (): Promise<boolean> => {
    setIsCheckingLocation(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        })
      })
      if (position) {
        setLocationStatus('granted')
        setIsCheckingLocation(false)
        return true
      }
    } catch (err: any) {
      console.warn('Location check failed:', err)
      setLocationStatus('denied')
    }
    setIsCheckingLocation(false)
    return false
  }

  const handleStartTrip = async () => {
    // Guard: cannot start a new trip while another delivery is ACTIVE
    if (hasOtherActiveDelivery) {
      toast.error('Cannot start trip', {
        description: 'You already have a delivery in progress. Complete it first, then come back to start this one.',
        duration: 8000,
      })
      return
    }

    if (!vinVerified || !photosSaved || !odometerSaved || !vinPhotoSaved || !pinVerified) {
      toast.error('Cannot start trip', {
        description: 'Please complete all required steps first.',
      })
      return
    }

    const hasLocation = await checkLocationPermission()
    if (!hasLocation) {
      toast.error('Location required', {
        description: 'Please enable location services and allow GPS access, then try again.',
        duration: 8000,
      })
      return
    }

    // If before pickup window and GPS says NOT at pickup, block
    if (delivery?.pickupWindowStart && new Date(delivery.pickupWindowStart) > new Date() && isDriverAtPickup === false) {
      toast.error('Not at pickup location', {
        description: 'GPS shows you are not at the pickup lot yet. Please go to the pickup location to start early.',
        duration: 8000,
      })
      return
    }

    // If before the scheduled window, show confirmation dialog instead of starting immediately
    if (delivery?.pickupWindowStart && new Date(delivery.pickupWindowStart) > new Date()) {
      setShowEarlyStartDialog(true)
      return
    }

    startTripMutation.mutate({
      driverId,
      actorUserId: userId,
      actorRole: 'DRIVER',
    })
  }

  const confirmEarlyStart = () => {
    setShowEarlyStartDialog(false)
    startTripMutation.mutate({
      driverId,
      actorUserId: userId,
      actorRole: 'DRIVER',
    })
  }

  const handleCancel = () => {
    if (deliveryId) clearPersistedState(deliveryId)
    toast.info('Checklist cancelled', {
      description: 'Returning to active delivery.',
    })
    navigate({ to: '/driver-active' })
  }

  // Check if all steps are complete (used for disabling button after submission)
  const allStepsComplete = greeted && photosSaved && odometerSaved && vinPhotoSaved && vinVerified && pinVerified
  // Check if all inputs are filled (ready to submit — turns button green)
  const readyToSubmit = greeted && photosSaved && odometerSaved && vinPhotoSaved && /^\d{4}$/.test(vinValue) && !!odometerValue && !isNaN(Number(odometerValue))

  // PIN verification handler
  const verifyPinLock = useRef(false)
  const verifyPinMutation = useCreate<{ valid: boolean }, { pin: string }>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/verify-pin`,
    {
      onSuccess: (data) => {
        if (data?.valid) {
          setPinVerified(true)
          setPinError(null)
          toast.success('PIN verified!', { description: 'Customer authorization confirmed.' })
        } else {
          setPinError('Incorrect PIN. Please try again.')
          setPinValue('')
          toast.error('PIN incorrect', { description: 'The PIN you entered is not correct. Contact the customer to verify.' })
        }
        setPinVerifying(false)
        verifyPinLock.current = false
      },
      onError: (error: any) => {
        setPinError(error?.message || 'Failed to verify PIN')
        setPinVerifying(false)
        verifyPinLock.current = false
      },
    }
  )

  const handleVerifyPin = (pinOverride?: string) => {
    const pin = pinOverride || pinValue
    if (!/^\d{4}$/.test(pin)) {
      setPinError('PIN must be 4 digits')
      return
    }
    if (!deliveryId || verifyPinLock.current) return
    verifyPinLock.current = true
    setPinVerifying(true)
    verifyPinMutation.mutate({ pin })
  }

  // Status helper
  const getStepStatus = (stepId: number) => {
    switch (stepId) {
      case 1: return greeted ? 'Done' : 'Pending'
      case 2: return photosSaved ? 'Done' : 'Pending'
      case 3: return vinPhotoSaved ? 'Done' : 'Pending'
      case 4: return odometerSaved ? 'Done' : 'Pending'
      case 5: return vinVerified ? 'Done' : 'Pending'
      case 6: return pinVerified ? 'Done' : 'Pending'
      default: return 'Pending'
    }
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-active"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back to active delivery"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Pickup Checklist
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
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
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-36">
        {/* Loading state while delivery data loads */}
        {!delivery && (
          <div className="space-y-6">
            <div className="h-8 w-48 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        )}

        {/* Order Details Card */}
        {delivery && (
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg mb-5">
            <CardContent className="p-5">
              <h2 className="text-[18px] font-black text-slate-900 dark:text-white leading-tight">
                {delivery.pickupAddress?.split(',')[1]?.trim() || 'Pickup'} &rarr; {delivery.dropoffAddress?.split(',')[1]?.trim() || 'Dropoff'}
              </h2>

              {(delivery.vehicleMake || delivery.vehicleModel || delivery.licensePlate) && (
                <div className="mt-3 flex items-center gap-2">
                  <Car className="w-4 h-4 text-slate-400" />
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
                    {[delivery.vehicleColor, delivery.vehicleYear, delivery.vehicleMake, delivery.vehicleModel].filter(Boolean).join(' ')}
                    {delivery.licensePlate ? ` - ${delivery.licensePlate}` : ''}
                  </span>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pickup</p>
                    <AddressLink address={delivery.pickupAddress} className="text-[13px] font-medium" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dropoff</p>
                    <AddressLink address={delivery.dropoffAddress} className="text-[13px] font-medium" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {delivery.recipientName && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recipient</p>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white mt-0.5">{delivery.recipientName}</p>
                    {delivery.recipientPhone && (
                      <a href={`tel:${delivery.recipientPhone}`} className="text-[12px] text-green-600 dark:text-green-400 font-medium hover:underline">
                        {delivery.recipientPhone}
                      </a>
                    )}
                  </div>
                )}
                {(delivery.customer?.businessName || delivery.customer?.contactName) && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sender</p>
                    {delivery.customer.businessName && delivery.customer.customerType === 'BUSINESS' && (
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white mt-0.5">{delivery.customer.businessName}</p>
                    )}
                    {delivery.customer.contactName && (!delivery.customer.businessName || delivery.customer.customerType !== 'BUSINESS') && (
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white mt-0.5">{delivery.customer.contactName}</p>
                    )}
                    {delivery.customer.businessName && delivery.customer.customerType === 'BUSINESS' && delivery.customer.contactName && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">via {delivery.customer.contactName}</p>
                    )}
                    {delivery.customer.contactPhone && (
                      <a href={`tel:${delivery.customer.contactPhone}`} className="text-[12px] text-green-600 dark:text-green-400 font-medium hover:underline">
                        {delivery.customer.contactPhone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Get PIN Card — Customer Authorization */}
        {/* {delivery && (() => {
          const isBusiness = delivery.customer?.customerType === 'BUSINESS'
          const pinPhone = isBusiness
            ? delivery.customer?.contactPhone
            : delivery.recipientPhone
          const pinContactName = isBusiness
            ? (delivery.customer?.contactName || delivery.customer?.businessName || 'Staff')
            : (delivery.recipientName || 'Customer')

          return pinPhone ? (
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg mb-5">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-blue-500/10 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center shrink-0">
                    <Shield className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[15px] font-black text-slate-900 dark:text-white">Customer Authorization</h3>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400 mt-2">
                      The customer has a 4-digit PIN. Ask them for it.
                    </p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-3">
                      Contact: <span className="font-bold text-slate-700 dark:text-slate-300">{pinContactName}</span>{' '}
                      <span className="text-slate-400">({pinPhone})</span>
                    </p>
                    <div className="mt-4 flex gap-2">
                      <a
                        href={`tel:${pinPhone}`}
                        className="w-10 h-10 rounded-xl bg-lime-500 flex items-center justify-center text-slate-950 hover:bg-lime-600 transition"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                      <a
                        href={`sms:${pinPhone}?body=${encodeURIComponent(buildPinSmsBody(user?.fullName, delivery))}`}
                        className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 hover:bg-blue-200 transition"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null
        })()} */}

        {/* Desktop warning — photos must be taken on a phone with a camera */}
        {isDesktop && (
          <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-800 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                Use Your Phone to Take Photos
              </p>
              <p className="text-[12px] text-amber-700 dark:text-amber-300 mt-1">
                All pickup photos must be captured live with your phone's camera. Desktop and laptop browsers cannot take camera photos — please open this page on your mobile device to continue.
              </p>
            </div>
          </div>
        )}


        {/* Early Start Banner — show when before scheduled window AND GPS-verified at pickup */}
        {delivery?.pickupWindowStart && new Date(delivery.pickupWindowStart) > new Date() && isDriverAtPickup === true && (
          <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-green-900 dark:text-green-200">
                  Ready to Start
                </p>
                <p className="text-[11px] text-green-700 dark:text-green-300 mt-0.5">
                  Your scheduled window starts at {new Date(delivery.pickupWindowStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })}.
                  GPS confirms you're at the pickup location — complete the checklist and you can start early.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Before window but GPS not yet verified — informational notice */}
        {delivery?.pickupWindowStart && new Date(delivery.pickupWindowStart) > new Date() && isDriverAtPickup === null && (
          <div className="mt-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-blue-900 dark:text-blue-200">
                  Scheduled {new Date(delivery.pickupWindowStart).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', timeZone: BUSINESS_TZ })}, {new Date(delivery.pickupWindowStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })}
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  Complete the checklist and you'll be able to start early once GPS verifies your location at the pickup lot.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* If before window but NOT at pickup, show a waiting notice */}
        {delivery?.pickupWindowStart && new Date(delivery.pickupWindowStart) > new Date() && isDriverAtPickup === false && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                  Not at Pickup Location
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                  Your window starts at {new Date(delivery.pickupWindowStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })}.
                  GPS shows you're not at the pickup location yet. Head to the lot to start early.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Steps — only render when delivery data is available */}
        {delivery && (
        <section className="mt-6 grid gap-6">
          {/* Left: checklist steps */}
          <div className="lg:col-span-7 space-y-6">

            {/* ── Step 1: Driver Authorization (PIN) ── */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              pinVerified && "border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10"
            )}>
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    pinVerified
                      ? "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {pinVerified ? <Check className="w-4 h-4" /> : 1}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">Driver Authorization</h2>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Please ask the customer for their their 4-digit PIN
                        </p>
                        {(() => {
                          const isBusiness = delivery?.customer?.customerType === 'BUSINESS'
                          const pinPhone = isBusiness
                            ? delivery?.customer?.contactPhone
                            : delivery?.recipientPhone
                          const pinContactName = isBusiness
                            ? (delivery?.customer?.contactName || delivery?.customer?.businessName || 'Staff')
                            : (delivery?.recipientName || 'Customer')
                          return pinPhone ? (
                            <div className="mt-3 flex items-center gap-2">
                              <a
                                href={`tel:${pinPhone}`}
                                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition"
                              >
                                <Phone className="w-5 h-5" />
                              </a>
                              <a
                                href={`sms:${pinPhone}?body=${encodeURIComponent(buildPinSmsBody(user?.fullName, delivery))}`}
                                className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition"
                              >
                                <MessageSquare className="w-5 h-5" />
                              </a>
                            </div>
                          ) : null
                        })()}
                      </div>
                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        <Shield className="w-3.5 h-3.5 text-primary mr-1" />
                        Step 1
                      </Badge>
                    </div>

                    {!pinVerified ? (
                      <>
                        <div className="mt-5 space-y-2">
                          <div className="relative">
                            <Input
                              value={pinValue}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                                setPinValue(digits)
                                setPinError(null)
                                // Auto-verify on 4th digit
                                if (digits.length === 4) {
                                  setTimeout(() => handleVerifyPin(digits), 150)
                                }
                              }}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              placeholder="0000"
                              className={cn(
                                "h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-lg font-black tracking-[0.3em] text-center pr-12",
                                pinError && "border-red-400 dark:border-red-500"
                              )}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 tabular-nums">
                              {pinValue.length}/4
                            </span>
                          </div>
                          {pinError && (
                            <p className="text-[11px] font-bold text-red-500 mt-1">{pinError}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            PIN is a 4-digit code.
                          </p>
                        </div>

                        {pinVerifying && (
                          <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-extrabold rounded-2xl py-3 flex items-center justify-center gap-2 cursor-wait">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Verifying PIN...
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <p className="text-sm font-extrabold text-green-700 dark:text-green-300">PIN verified!</p>
                        </div>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">
                          Customer authorization confirmed.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 2: Verify the vehicle ── */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              greeted && "border-primary/25 bg-primary/5"
            )}>
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    greeted
                      ? "bg-primary/10 border-primary/25 text-slate-900"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {greeted ? <Check className="w-4 h-4 text-primary" /> : 2}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Verify the vehicle</h2>
                      </div>
                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        {greeted ? <Check className="w-3.5 h-3.5 text-green-500 mr-1" /> : <CarFront className="w-3.5 h-3.5 text-primary mr-1" />}
                        {greeted ? 'Done' : 'Required'}
                      </Badge>
                    </div>

                    {!greeted ? (
                      <div className="mt-5">
                        {/* Vehicle details */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <Car className="w-5 h-5 text-slate-400 shrink-0" />
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Make & Model</p>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {[delivery.vehicleMake, delivery.vehicleModel].filter(Boolean).join(' ') || '—'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <Shield className="w-5 h-5 text-slate-400 shrink-0" />
                            <div>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">License Plate</p>
                              <p className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                                {delivery.licensePlate || '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={handleArrivedAtVehicle}
                          className="mt-5 w-full lime-btn font-extrabold rounded-2xl py-3.5 transition flex items-center justify-center gap-2 text-base"
                        >
                          <Check className="w-5 h-5" />
                          Confirm & continue
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Vehicle verified</p>
                        <p className="text-[11px] text-slate-700 mt-1">Next: take 6 vehicle photos clockwise around the car.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 3: 6 clockwise car photos ── */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              photosSaved && !photoErrors.size && "border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10",
              photoErrors.size > 0 && "border-red-200 dark:border-red-800/40",
              photosUploading && "border-amber-200 dark:border-amber-800/40"
            )}>
              <CardContent className="p-6 sm:p-7">
                {/* Uploading banner */}
                {photosUploading && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-[12px] font-bold text-red-700 dark:text-red-300">
                      Still uploading photos. Please wait for all six to complete.
                    </p>
                  </div>
                )}

                {/* Error banner */}
                {photoErrors.size > 0 && !photosUploading && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-[12px] font-bold text-red-700 dark:text-red-300">
                      Some photos failed to upload. Tap the failed photos to retry.
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    photosSaved && !photoErrors.size
                      ? "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700"
                      : photoErrors.size > 0
                        ? "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700"
                        : photosUploading
                          ? "bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700"
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {photosSaved && !photoErrors.size ? <Check className="w-4 h-4" /> :
                     photoErrors.size > 0 ? <XCircle className="w-4 h-4" /> :
                     photosUploading ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : 3}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">Vehicle Photos</h2>
                          {photosSaved && !photoErrors.size && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Follow the reference guide below. Take each photo from the numbered angle.
                        </p>
                      </div>
                    </div>

                    {!photosSaved ? (
                      <>
                        {/* Hidden file input for car photos */}
                        <input
                          ref={carPhotoInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          {photoSlots.map((slot, index) => {
                            const hasError = photoErrors.has(index)
                            const isCaptured = !!slot.preview && !hasError
                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => !isDesktop && !photosUploading && handleAddCarPhoto(index)}
                                disabled={isDesktop || photosUploading}
                                className={cn(
                                  "aspect-[3/4] rounded-2xl border-2 overflow-hidden relative flex flex-col items-center justify-end transition",
                                  isCaptured
                                    ? "border-green-300 dark:border-green-700"
                                    : hasError && !photosUploading
                                      ? "border-red-400 dark:border-red-600"
                                      : hasError && photosUploading
                                        ? "border-amber-400 dark:border-amber-600"
                                        : "border-slate-200 dark:border-slate-700 hover:border-primary/50 active:scale-[0.97]"
                                )}
                              >
                                {/* Reference image shown as background when no photo captured yet */}
                                <img
                                  src={ANGLE_REF_IMAGES[index]}
                                  alt={PHOTO_LABELS[index]}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                  className={cn(
                                    "absolute inset-0 w-full h-full object-cover transition-opacity",
                                    isCaptured ? "opacity-0" : "opacity-60"
                                  )}
                                  loading="lazy"
                                />

                                {/* Uploaded photo overlay — replaces reference image */}
                                {slot.preview && (
                                  <img
                                    src={slot.preview}
                                    alt={`Photo ${index + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                )}

                                {/* Uploading spinner overlay */}
                                {photosUploading && slot.file && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  </div>
                                )}

                                {/* Checkmark badge when captured */}
                                {isCaptured && !photosUploading && (
                                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center z-10 shadow">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}

                                {/* Error overlay — hidden during retry so spinner shows */}
                                {hasError && !photosUploading && (
                                  <div className="absolute inset-0 bg-red-900/30 flex flex-col items-center justify-center gap-1 z-10">
                                    <XCircle className="w-5 h-5 text-red-200" />
                                    <span className="text-[9px] font-bold text-white">Retry</span>
                                  </div>
                                )}

                                {/* Bottom label strip — always visible */}
                                <div className={cn(
                                  "relative z-10 w-full px-1.5 py-2 flex flex-col items-center justify-center gap-0.5",
                                  isCaptured
                                    ? "bg-gradient-to-t from-black/70 via-black/40 to-transparent"
                                    : "bg-gradient-to-t from-black/60 via-black/30 to-transparent"
                                )}>
                                  {isCaptured ? (
                                    <>
                                      <span className={cn(
                                        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
                                        "bg-green-500 text-white"
                                      )}>
                                        {index + 1}
                                      </span>
                                      <span className="text-[9px] font-bold text-white leading-tight text-center">
                                        {PHOTO_LABELS[index]}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className={cn(
                                        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
                                        "bg-white/60 text-slate-900"
                                      )}>
                                        {index + 1}
                                      </span>
                                      <span className="text-[9px] font-bold text-white/70 leading-tight text-center">
                                        {PHOTO_LABELS[index]}
                                      </span>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <Camera className="w-3 h-3 text-white/70" />
                                        <span className="text-[9px] font-bold text-white/70">Tap to capture</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                          {photoErrors.size > 0 && !photosUploading ? (
                            <Button
                              onClick={handleUploadCarPhotos}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-2xl py-3 transition flex items-center justify-center gap-2"
                            >
                              <CloudUpload className="w-4 h-4" />
                              Retry Failed Uploads
                            </Button>
                          ) : photoErrors.size > 0 && photosUploading ? (
                            <Button
                              disabled
                              className="flex-1 bg-amber-500 text-white font-extrabold rounded-2xl py-3 transition flex items-center justify-center gap-2 cursor-wait"
                            >
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Retrying uploads...
                            </Button>
                          ) : (
                            <>
                            <Button
                              onClick={handleUploadCarPhotos}
                              disabled={uploadCarPhotosMutation.isPending || photosUploading}
                              className="flex-1 lime-btn font-extrabold rounded-2xl py-3 hover:opacity-90 transition disabled:bg-slate-200 disabled:dark:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {uploadCarPhotosMutation.isPending || photosUploading ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Uploading photos...
                                </>
                              ) : (
                                <>
                                  <CloudUpload className="w-4 h-4" />
                                  Upload all 6 photos
                                </>
                              )}
                            </Button>
                            <p className="mt-2 text-[11px] text-slate-400 text-center">Take all 6 photos, then tap Upload.</p>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Vehicle photos uploaded</p>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">Next: take a photo of the full VIN number.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 4: VIN Photo ── */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              vinPhotoSaved && "border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10",
              vinPhotoUploading && "border-amber-200 dark:border-amber-800/40"
            )}>
              <CardContent className="p-6 sm:p-7">
                {vinPhotoUploading && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <p className="text-[12px] font-bold text-amber-700 dark:text-amber-300">
                      Uploading VIN photo...
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    vinPhotoSaved
                      ? "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700"
                      : vinPhotoUploading
                        ? "bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700"
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {vinPhotoSaved ? <Check className="w-4 h-4" /> :
                     vinPhotoUploading ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : 4}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">VIN Photo</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Take a clear photo showing the full VIN number (required).
                        </p>
                      </div>
                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        <QrCode className="w-3.5 h-3.5 text-primary mr-1" />
                        Required
                      </Badge>
                    </div>

                    {!vinPhotoSaved ? (
                      <>
                        <input
                          ref={vinPhotoInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        <div className="mt-5">
                          <Button
                            variant="outline"
                            onClick={() => !isDesktop && handleAddVinPhoto()}
                            disabled={isDesktop || vinPhotoUploading}
                            className={cn(
                              "w-full h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 font-extrabold hover:bg-primary/5 transition relative overflow-hidden",
                              vinPhoto.preview
                                ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                                : vinPhotoUploadError && !vinPhotoUploading
                                  ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/10 cursor-pointer"
                                  : vinPhotoUploadError && vinPhotoUploading
                                    ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10"
                                    : "border-slate-200 dark:border-slate-700"
                            )}
                          >
                            {vinPhoto.preview ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={vinPhoto.preview}
                                  alt="VIN"
                                  className="h-full w-full object-cover"
                                />
                                {vinPhotoUploading && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  </div>
                                )}
                                {!vinPhotoUploading && !vinPhotoUploadError && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                                {vinPhotoUploadError && !vinPhotoUploading && (
                                  <div className="absolute inset-0 bg-red-900/30 flex flex-col items-center justify-center gap-1">
                                    <XCircle className="w-5 h-5 text-red-200" />
                                    <span className="text-[9px] font-bold text-white">Tap to retry</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <Camera className="w-8 h-8 text-primary/60" />
                                <span className="text-sm font-bold text-primary/70">Tap to take photo</span>
                                <p className="text-[10px] text-slate-400 -mt-1">Full VIN number must be visible</p>
                              </>
                            )}
                          </Button>
                        </div>

                        <Button
                          onClick={handleUploadVinPhoto}
                          disabled={!vinPhoto.file || vinPhotoUploading}
                          className={cn(
                            "mt-4 w-full font-extrabold rounded-2xl py-3 transition flex items-center justify-center gap-2",
                            vinPhotoUploading && vinPhotoUploadError
                              ? "bg-amber-500 text-white cursor-wait"
                              : vinPhotoUploading
                                ? "lime-btn cursor-wait"
                                : "lime-btn hover:opacity-90 disabled:bg-slate-200 disabled:dark:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                          )}
                        >
                          {vinPhotoUploading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-4 h-4" />
                              {vinPhotoUploadError ? 'Retry VIN upload' : 'Upload VIN photo'}
                            </>
                          )}
                        </Button>
                        <p className="mt-2 text-[11px] text-slate-400 text-center">Take the photo, then tap Upload.</p>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <p className="text-sm font-extrabold text-green-700 dark:text-green-300">VIN photo uploaded</p>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">Next: enter the odometer reading.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 5: Odometer photo ── */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              odometerSaved && "border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10",
              odometerUploading && "border-amber-200 dark:border-amber-800/40"
            )}>
              <CardContent className="p-6 sm:p-7">
                {odometerUploading && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <p className="text-[12px] font-bold text-amber-700 dark:text-amber-300">
                      Uploading odometer photo...
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    odometerSaved
                      ? "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700"
                      : odometerUploading
                        ? "bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700"
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {odometerSaved ? <Check className="w-4 h-4" /> :
                     odometerUploading ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : 5}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Odometer Photo & Reading</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Capture a clear photo of the odometer and enter the mileage shown (both required).
                        </p>
                      </div>
                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        <Speed className="w-3.5 h-3.5 text-primary mr-1" />
                        Required
                      </Badge>
                    </div>

                    {!odometerSaved ? (
                      <>
                        <input
                          ref={odometerInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        <div className="mt-5 space-y-4">
                          <div>
                            <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                              ODOMETER READING
                              {!odometerValue && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              placeholder="e.g. 45230"
                              value={odometerValue}
                              onChange={(e) => {
                                setOdometerValue(e.target.value)
                                setOdometerError(null) // clear error when typing
                              }}
                              className="h-12 text-base font-bold rounded-xl border-slate-200 dark:border-slate-700"
                            />
                            <p className="mt-1.5 text-[11px] text-slate-400">
                              Enter the current mileage shown on the odometer.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <Button
                            variant="outline"
                            onClick={() => !isDesktop && handleAddOdometerPhoto()}
                            disabled={isDesktop || odometerUploading}
                            className={cn(
                              "w-full h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 font-extrabold hover:bg-primary/5 transition relative overflow-hidden",
                              odometerPhoto.preview
                                ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                                : odometerUploadError && !odometerUploading
                                  ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/10 cursor-pointer"
                                  : odometerUploadError && odometerUploading
                                    ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10"
                                    : "border-slate-200 dark:border-slate-700"
                            )}
                          >
                            {odometerPhoto.preview ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={odometerPhoto.preview}
                                  alt="Odometer"
                                  className="h-full w-full object-cover"
                                />
                                {odometerUploading && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  </div>
                                )}
                                {!odometerUploading && !odometerUploadError && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                                {odometerUploadError && !odometerUploading && (
                                  <div className="absolute inset-0 bg-red-900/30 flex flex-col items-center justify-center gap-1">
                                    <XCircle className="w-5 h-5 text-red-200" />
                                    <span className="text-[9px] font-bold text-white">Tap to retry</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <Camera className="w-8 h-8 text-primary/60" />
                                <span className="text-sm font-bold text-primary/70">Tap to take photo</span>
                                <p className="text-[10px] text-slate-400 -mt-1">Odometer reading must be visible</p>
                              </>
                            )}
                          </Button>
                        </div>

                        <Button
                          onClick={handleUploadOdometerPhoto}
                          disabled={!odometerPhoto.file || odometerUploading}
                          className={cn(
                            "mt-4 w-full font-extrabold rounded-2xl py-3 transition flex items-center justify-center gap-2",
                            odometerUploading && odometerUploadError
                              ? "bg-amber-500 text-white cursor-wait"
                              : odometerUploading
                                ? "lime-btn cursor-wait"
                                : "lime-btn hover:opacity-90 disabled:bg-slate-200 disabled:dark:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                          )}
                        >
                          {odometerUploading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-4 h-4" />
                              {odometerUploadError ? 'Retry Upload' : 'Upload Photo'}
                            </>
                          )}
                        </Button>
                        <p className="mt-2 text-[11px] text-slate-400 text-center">After taking the photo, tap Upload.</p>
                        {odometerError && (
                        <p className="mt-2 text-[12px] font-bold text-red-500">
                          {odometerError}
                        </p>
                      )}
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Odometer photo uploaded</p>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">Next: enter VIN digits and submit.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 6: Confirm & Start Delivery ── */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              vinVerified && "border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10"
            )}>
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    vinVerified
                      ? "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {vinVerified ? <Check className="w-4 h-4" /> : 6}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Confirm &amp; Start Delivery</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Enter the last 4 digits of the VIN to start delivery. Tracking will begin automatically.
                        </p>
                      </div>
                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        <Lock className="w-3.5 h-3.5 text-primary mr-1" />
                        Step 6
                      </Badge>
                    </div>

                    {!vinVerified ? (
                      <>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-1 gap-3">
                          <div className="space-y-2">
                            <label className={cn(
                              "text-[10px] font-black uppercase tracking-[0.3em] transition",
                              vinValue.length === 4 && !vinError ? "text-green-600 dark:text-green-400" : "text-red-500"
                            )}>VIN last-4 digits</label>
                            <div className="relative">
                              <Input
                                value={vinValue}
                                onChange={handleVinChange}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={4}
                                className={cn(
                                  "h-14 rounded-2xl border dark:bg-slate-800/40 text-lg font-black tracking-[0.3em] text-center pr-12 transition",
                                  vinError
                                    ? "border-red-400 dark:border-red-500"
                                    : vinValue.length === 4
                                      ? "border-green-400 dark:border-green-500"
                                      : "border-slate-200 dark:border-slate-700"
                                )}
                                placeholder="e.g. 1234"
                              />
                              <span className={cn(
                                "absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums transition",
                                vinValue.length === 4 && !vinError ? "text-green-600 dark:text-green-400" : "text-red-500"
                              )}>
                                {vinValue.length}/4
                              </span>
                            </div>
                            {vinError && (
                              <p className="text-[11px] font-bold text-red-500 mt-1">{vinError}</p>
                            )}
                          </div>
                        </div>

                        {/* Auto-save indicator — shows while submitting after 4th digit */}
                        {saveProgressMutation.isPending && vinValue.length === 4 && (
                          <div className="mt-4 flex items-center justify-center gap-2 py-3">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-bold text-primary">Saving checklist...</span>
                          </div>
                        )}

                        {/* Pre-submit checklist summary */}
                        <div className="mt-5 space-y-2">
                          {[
                            { label: 'PIN verified', done: pinVerified },
                            { label: 'Staff greeted', done: greeted },
                            { label: 'Vehicle photos uploaded', done: photosSaved },
                            { label: 'VIN photo uploaded', done: vinPhotoSaved },
                            { label: 'Odometer photo uploaded', done: odometerSaved },
                            { label: 'Last 4 digits of VIN entered', done: vinValue.length === 4 && vinVerified },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              {item.done ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <X className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                              )}
                              <span className={cn(
                                "text-[13px] font-semibold",
                                item.done ? "text-green-700 dark:text-green-300" : "text-slate-400"
                              )}>
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Checklist complete!</p>
                        </div>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">
                          Tap <strong>Start</strong> below to begin your delivery.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

           {/* <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Checklist status</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">All steps must be complete to start.</p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <FactCheck className="w-5 h-5 text-primary" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    { id: 1, label: 'Staff greeted' },
                    { id: 2, label: 'Vehicle photos' },
                    { id: 3, label: 'VIN photo' },
                    { id: 4, label: 'Odometer photo' },
                    { id: 5, label: 'Confirm & Submit' },
                  ].map((step) => (
                    <div key={step.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <RadioButtonUnchecked className={cn(
                          "w-5 h-5",
                          getStepStatus(step.id) === 'Done' ? "text-primary" : "text-slate-400"
                        )} />
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {step.label}
                        </p>
                      </div>
                      <span className={cn(
                        "text-[11px] font-black uppercase tracking-widest",
                        getStepStatus(step.id) === 'Done' ? "text-primary" : "text-slate-400"
                      )}>
                        {getStepStatus(step.id)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">Quality tips</p>
                      <ul className="mt-2 space-y-1 text-[11px] text-amber-900/80 dark:text-amber-200/80">
                        <li>- Walk clockwise: front, front-right, right, rear, rear-left, left.</li>
                        <li>- Take photos in good light, avoid glare on the odometer.</li>
                        <li>- VIN photo must clearly show the last 4 characters.</li>
                        <li>- After submission, keep location services ON for tracking.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardContent className="p-6 sm:p-7">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">What happens next</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">After you submit the checklist.</p>

                <div className="mt-5 space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">Tracking auto-starts</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Location services activate automatically on submission.</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-primary">Auto</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <TaskAlt className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">Start the trip</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Tap Start once you&apos;re ready to drive.</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Manual</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Distance className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">Drop-off checklist</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Complete drop-off photos + odometer at destination.</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Finish</span>
                  </div>
                </div>

                <div className="mt-5 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                  <div className="flex items-start gap-3">
                    <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold text-blue-900 dark:text-blue-200">Drive safe</p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                        Keep driving slow and safe after pickup. Observe all traffic laws and speed limits.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div> */}
        </section>
        )}
      </main>

      {/* Bottom Action Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 py-4">
          <div className="grid grid-cols-1 gap-3">
            {/* <Button
              onClick={handleCancel}
              variant="outline"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 font-extrabold hover:bg-primary/5 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4 text-primary" />
              Cancel
            </Button> */}

            <Button
              onClick={handleStartTrip}
              disabled={!allStepsComplete || startTripMutation.isPending || hasOtherActiveDelivery}
              className={cn(
                "rounded-2xl py-4 font-extrabold flex items-center justify-center gap-2 transition",
                allStepsComplete && !hasOtherActiveDelivery
                  ? "lime-btn hover:shadow-xl hover:shadow-primary/20"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              )}
            >
              {hasOtherActiveDelivery ? 'Complete Current First' : (startTripMutation.isPending ? 'Starting...' : 'Start')}
            </Button>
          </div>
        </div>
      </nav>

      {/* Early Start Confirmation Dialog */}
      <AlertDialog open={showEarlyStartDialog} onOpenChange={setShowEarlyStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You're Starting Early</AlertDialogTitle>
            <AlertDialogDescription>
              This job was scheduled for{' '}
              {delivery?.pickupWindowStart
                ? new Date(delivery.pickupWindowStart).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: BUSINESS_TZ,
                  })
                : 'the scheduled time'}
              . Are you sure you want to start now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEarlyStart} className="lime-btn font-extrabold rounded-xl">
              Yes, Start Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
