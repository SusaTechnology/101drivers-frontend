// app/pages/driver/pickup-checklist.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getUser, useCreate, useDataQuery, useFileUpload } from '@/lib/tanstack/dataQuery'
import { savePhoto, getPhotosForDelivery, clearDeliveryPhotos } from '@/lib/pickup-photo-store'

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
const ANGLE_REF_IMAGES = [
  '/assets/angle-1-left-front.png',
  '/assets/angle-2-right-front.png',
  '/assets/angle-3-passenger-side.png',
  '/assets/angle-4-right-rear.png',
  '/assets/angle-5-left-rear.png',
  '/assets/angle-6-driver-side.png',
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

export default function DriverPickupChecklistPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
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
  const { data: activeData } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/active-delivery/${driverId}`,
    noFilter: true,
    enabled: Boolean(driverId),
  })

  // Merge: prefer active delivery data (has vehicle/contacts), fallback to feed data
  const delivery = activeData?.delivery || deliveryData

  // Location permission state
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [isCheckingLocation, setIsCheckingLocation] = useState(false)

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

  // ── Step 3: Odometer photo + reading ──
  const [odometerPhoto, setOdometerPhoto] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [odometerValue, setOdometerValue] = useState(saved?.odometerValue ?? '')
  const [odometerSaved, setOdometerSaved] = useState(saved?.odometerSaved ?? false)
  const [odometerUploading, setOdometerUploading] = useState(false)
  const [odometerUploadError, setOdometerUploadError] = useState(false)

  // ── Step 4: VIN last-4 photo ──
  const [vinPhoto, setVinPhoto] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [vinPhotoSaved, setVinPhotoSaved] = useState(saved?.vinPhotoSaved ?? false)
  const [vinPhotoUploading, setVinPhotoUploading] = useState(false)
  const [vinPhotoUploadError, setVinPhotoUploadError] = useState(false)

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

  // ── Step 5: Upload all + enter VIN last-4 digits ──
  const [vinValue, setVinValue] = useState(saved?.vinValue ?? '')
  const [vinVerified, setVinVerified] = useState(saved?.vinVerified ?? false)

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
          description: '6 clockwise walk-around photos uploaded.',
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
        toast.error('Failed to save checklist', {
          description: error?.message || 'Unknown error',
        })
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
      description: 'Now walk around the car clockwise and take 6 photos.',
    })
  }

  // Step 2: Car photos
  const handleAddCarPhoto = (index: number) => {
    currentSlotIndex.current = index
    currentInputTarget.current = 'car'
    carPhotoInputRef.current?.click()
  }

  const handleUploadCarPhotos = () => {
    const allPhotosAdded = photoSlots.every(slot => slot.file !== null)
    if (!allPhotosAdded) {
      toast.error('Missing photos', {
        description: 'Please capture all 6 clockwise walk-around photos.',
      })
      return
    }
    const formData = new FormData()
    photoSlots.forEach((slot) => {
      if (slot.file) formData.append('files', slot.file)
    })
    formData.append('deliveryId', deliveryId)
    formData.append('phase', 'PICKUP')
    uploadCarPhotosMutation.mutate(formData)
  }

  // Step 3: Odometer photo
  const handleAddOdometerPhoto = () => {
    currentInputTarget.current = 'odometer'
    odometerInputRef.current?.click()
  }

  const handleUploadOdometerPhoto = () => {
    if (!odometerPhoto.file) {
      toast.error('Photo required', {
        description: 'Please take a clear odometer photo first.',
      })
      return
    }
    const formData = new FormData()
    formData.append('files', odometerPhoto.file)
    formData.append('deliveryId', deliveryId)
    formData.append('phase', 'PICKUP')
    uploadOdometerMutation.mutate(formData)
  }

  // Step 4: VIN photo
  const handleAddVinPhoto = () => {
    currentInputTarget.current = 'vin'
    vinPhotoInputRef.current?.click()
  }

  const handleUploadVinPhoto = () => {
    if (!vinPhoto.file) {
      toast.error('Photo required', {
        description: 'Please take a photo of the VIN last-4 digits.',
      })
      return
    }
    const formData = new FormData()
    formData.append('files', vinPhoto.file)
    formData.append('deliveryId', deliveryId)
    formData.append('phase', 'PICKUP')
    uploadVinPhotoMutation.mutate(formData)
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

  // Step 5: Submit all (upload remaining + enter VIN)
  const handleSubmitAll = () => {
    // Validate
    if (!greeted) {
      toast.error('Step 1 missing', { description: 'Please confirm you are at the vehicle.' })
      return
    }
    if (!photosSaved || uploadedPhotos.length !== 6) {
      toast.error('Car photos not uploaded', { description: 'Please upload all 6 walk-around photos.' })
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
      toast.error('VIN photo not saved', { description: 'Please upload the VIN last-4 photo.' })
      return
    }
    if (!vinValue || vinValue.length !== 4) {
      toast.error('VIN digits required', { description: 'Please enter the last 4 digits of the VIN.' })
      return
    }

    // Backend expects exactly 6 photos (slots 1-6) + odometerStart as number + vinVerificationCode
    const payload = {
      driverId,
      vinVerificationCode: vinValue,
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
    if (!vinVerified || !photosSaved || !odometerSaved || !vinPhotoSaved) {
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

  // Check if all steps are complete
  const allStepsComplete = greeted && photosSaved && odometerSaved && vinPhotoSaved && vinVerified

  // Status helper
  const getStepStatus = (stepId: number) => {
    switch (stepId) {
      case 1: return greeted ? 'Done' : 'Pending'
      case 2: return photosSaved ? 'Done' : 'Pending'
      case 3: return odometerSaved ? 'Done' : 'Pending'
      case 4: return vinPhotoSaved ? 'Done' : 'Pending'
      case 5: return vinVerified ? 'Done' : 'Pending'
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
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white">{delivery.pickupAddress || '--'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dropoff</p>
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white">{delivery.dropoffAddress || '--'}</p>
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

        {/* Header Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Pickup Checklist
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Follow each step in order. Complete all steps to start the trip.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <CarFront className="w-3.5 h-3.5 text-primary mr-1" />
                    Arrive
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Camera className="w-3.5 h-3.5 text-primary mr-1" />
                    6 Photos
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Speed className="w-3.5 h-3.5 text-primary mr-1" />
                    Odometer
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <QrCode className="w-3.5 h-3.5 text-primary mr-1" />
                    VIN
                  </Badge>
                </div>
              </div>

              <div className="text-left sm:text-right">
                {/* Location status warning */}
                {locationStatus === 'denied' && allStepsComplete && (
                  <div className="mt-3 flex items-start gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-800 dark:text-red-200 font-semibold">
                      Location must be on to start this trip. Please enable GPS and tap Start Trip again.
                    </p>
                  </div>
                )}

                <div className="mt-4 flex sm:justify-end gap-2">
                  <Button
                    variant="link"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold text-slate-700 dark:text-slate-200 hover:text-primary transition"
                    onClick={() => toast.info('Contacting support')}
                  >
                    <SupportAgent className="w-4 h-4 text-primary" />
                    Support
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: checklist steps */}
          <div className="lg:col-span-7 space-y-6">

            {/* ── Step 1: Verify the vehicle ── */}
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
                    {greeted ? <Check className="w-4 h-4 text-primary" /> : 1}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Verify the vehicle</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {greeted
                            ? 'Vehicle verified. Proceed to the next step.'
                            : 'Confirm you found the right vehicle before starting.'}
                        </p>
                      </div>
                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        {greeted ? <Check className="w-3.5 h-3.5 text-green-500 mr-1" /> : <CarFront className="w-3.5 h-3.5 text-primary mr-1" />}
                        {greeted ? 'Done' : 'Required'}
                      </Badge>
                    </div>

                    {!greeted ? (
                      <div className="mt-5">
                        {/* Quick verification checklist */}
                        <ul className="space-y-2">
                          {[
                            { label: 'Vehicle make & model matches', icon: Car },
                            { label: 'Color and license plate match', icon: Shield },
                            { label: 'You are at the correct pickup address', icon: MapPin },
                          ].map((item, i) => (
                            <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                              <item.icon className="w-4 h-4 text-slate-400 shrink-0" />
                              {item.label}
                            </li>
                          ))}
                        </ul>
                        <Button
                          onClick={handleArrivedAtVehicle}
                          className="mt-4 w-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold rounded-2xl py-3 hover:opacity-90 transition flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Confirm & continue
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/25">
                        <p className="text-sm font-extrabold text-slate-900">Vehicle verified</p>
                        <p className="text-[11px] text-slate-700 mt-1">Next: walk around the car clockwise and take 6 photos.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 2: 6 clockwise car photos ── */}
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
                     photosUploading ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : 2}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-slate-900 dark:text-white">Walk-around photos</h2>
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
                                onClick={() => !photosUploading && handleAddCarPhoto(index)}
                                className={cn(
                                  "aspect-[3/4] rounded-2xl border-2 overflow-hidden relative flex flex-col items-center justify-end transition",
                                  isCaptured
                                    ? "border-green-300 dark:border-green-700"
                                    : hasError
                                      ? "border-red-400 dark:border-red-600"
                                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50 active:scale-[0.97]"
                                )}
                              >
                                {/* Reference image shown as background when no photo captured yet */}
                                <img
                                  src={ANGLE_REF_IMAGES[index]}
                                  alt={PHOTO_LABELS[index]}
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

                                {/* Error overlay */}
                                {hasError && (
                                  <div className="absolute inset-0 bg-red-900/30 flex flex-col items-center justify-center gap-1 z-10">
                                    <XCircle className="w-5 h-5 text-red-200" />
                                    <span className="text-[9px] font-bold text-white">Retry</span>
                                  </div>
                                )}

                                {/* Bottom label strip — always visible */}
                                <div className={cn(
                                  "relative z-10 w-full px-1.5 py-2 flex items-center justify-center gap-1.5",
                                  isCaptured
                                    ? "bg-gradient-to-t from-black/70 via-black/40 to-transparent"
                                    : "bg-gradient-to-t from-black/60 via-black/30 to-transparent"
                                )}>
                                  <span className={cn(
                                    "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
                                    isCaptured
                                      ? "bg-green-500 text-white"
                                      : "bg-white/90 text-slate-900"
                                  )}>
                                    {index + 1}
                                  </span>
                                  <span className="text-[9px] font-bold text-white leading-tight text-center">
                                    {PHOTO_LABELS[index]}
                                  </span>
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
                          ) : (
                            <Button
                              onClick={handleUploadCarPhotos}
                              disabled={uploadCarPhotosMutation.isPending || photosUploading}
                              className="flex-1 bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold rounded-2xl py-3 hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Walk-around photos uploaded</p>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">Next: take a clear odometer photo.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 3: Odometer photo ── */}
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
                     odometerUploading ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : 3}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Odometer photo & reading</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Take a clear photo and enter the current mileage (both required).
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
                              Odometer Reading
                            </label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              placeholder="e.g. 45230"
                              value={odometerValue}
                              onChange={(e) => setOdometerValue(e.target.value)}
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
                            onClick={handleAddOdometerPhoto}
                            disabled={odometerUploading}
                            className={cn(
                              "w-full h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 font-extrabold hover:bg-primary/5 transition relative overflow-hidden",
                              odometerPhoto.preview
                                ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                                : odometerUploadError
                                  ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/10 cursor-pointer"
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
                                {odometerUploadError && (
                                  <div className="absolute inset-0 bg-red-900/30 flex flex-col items-center justify-center gap-1">
                                    <XCircle className="w-5 h-5 text-red-200" />
                                    <span className="text-[9px] font-bold text-white">Tap to retry</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <Speed className="w-6 h-6 text-slate-400" />
                                <span className="text-sm text-slate-500">Tap to take odometer photo</span>
                              </>
                            )}
                          </Button>
                        </div>

                        <Button
                          onClick={handleUploadOdometerPhoto}
                          disabled={!odometerPhoto.file || odometerUploading}
                          className="mt-4 w-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold rounded-2xl py-3 hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {odometerUploading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-4 h-4" />
                              Upload odometer photo
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Odometer photo uploaded</p>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">Next: take a photo of the VIN last-4 digits.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 4: VIN last-4 photo ── */}
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
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">VIN last-4 photo</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Take a clear photo showing the last 4 digits of the VIN (required).
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
                            onClick={handleAddVinPhoto}
                            disabled={vinPhotoUploading}
                            className={cn(
                              "w-full h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 font-extrabold hover:bg-primary/5 transition relative overflow-hidden",
                              vinPhoto.preview
                                ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                                : vinPhotoUploadError
                                  ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/10 cursor-pointer"
                                  : "border-slate-200 dark:border-slate-700"
                            )}
                          >
                            {vinPhoto.preview ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={vinPhoto.preview}
                                  alt="VIN last-4"
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
                                {vinPhotoUploadError && (
                                  <div className="absolute inset-0 bg-red-900/30 flex flex-col items-center justify-center gap-1">
                                    <XCircle className="w-5 h-5 text-red-200" />
                                    <span className="text-[9px] font-bold text-white">Tap to retry</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <QrCode className="w-6 h-6 text-slate-400" />
                                <span className="text-sm text-slate-500">Tap to take VIN last-4 photo</span>
                              </>
                            )}
                          </Button>
                        </div>

                        <Button
                          onClick={handleUploadVinPhoto}
                          disabled={!vinPhoto.file || vinPhotoUploading}
                          className="mt-4 w-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold rounded-2xl py-3 hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {vinPhotoUploading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-4 h-4" />
                              Upload VIN photo
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <p className="text-sm font-extrabold text-green-700 dark:text-green-300">VIN photo uploaded</p>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">Next: enter VIN digits and submit.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 5: Enter VIN digits + Submit ── */}
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
                    {vinVerified ? <Check className="w-4 h-4" /> : 5}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Confirm &amp; submit</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Enter the last 4 digits of the VIN to finalize. Tracking will start automatically.
                        </p>
                      </div>
                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        <Lock className="w-3.5 h-3.5 text-primary mr-1" />
                        Required
                      </Badge>
                    </div>

                    {!vinVerified ? (
                      <>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-1 gap-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">VIN last-4 digits</label>
                            <Input
                              value={vinValue}
                              onChange={(e) => setVinValue(e.target.value.toUpperCase())}
                              maxLength={4}
                              className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-lg font-black tracking-widest text-center"
                              placeholder="e.g., 7K21"
                            />
                          </div>
                        </div>

                        {/* Pre-submit checklist summary */}
                        <div className="mt-5 space-y-2">
                          {[
                            { label: 'Greeted the staff', done: greeted },
                            { label: '6 walk-around photos uploaded', done: photosSaved },
                            { label: 'Odometer photo uploaded', done: odometerSaved },
                            { label: 'VIN last-4 photo uploaded', done: vinPhotoSaved },
                            { label: 'VIN digits entered', done: vinValue.length === 4 },
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

                        <Button
                          onClick={handleSubmitAll}
                          disabled={saveProgressMutation.isPending}
                          className={cn(
                            "mt-5 w-full rounded-2xl py-4 font-extrabold flex items-center justify-center gap-2 transition",
                            allStepsComplete
                              ? "lime-btn hover:shadow-xl hover:shadow-primary/20"
                              : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                          )}
                        >
                          {saveProgressMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Submitting checklist...
                            </>
                          ) : (
                            <>
                              <Shield className="w-4 h-4" />
                              Submit checklist &amp; enable tracking
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <p className="text-sm font-extrabold text-green-700 dark:text-green-300">Pickup checklist complete!</p>
                        </div>
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">
                          Tracking and location services are now active. Drive slow and safe!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar: status + tips */}
          <div className="lg:col-span-5 space-y-6">
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
                    { id: 1, label: 'Greet the staff' },
                    { id: 2, label: '6 walk-around photos' },
                    { id: 3, label: 'Odometer photo' },
                    { id: 4, label: 'VIN last-4 photo' },
                    { id: 5, label: 'Confirm & submit' },
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
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Tap Start Trip once you&apos;re ready to drive.</p>
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

                {/* Safe driving reminder */}
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
          </div>
        </section>
      </main>

      {/* Bottom Action Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 font-extrabold hover:bg-primary/5 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4 text-primary" />
              Cancel
            </Button>

            <Button
              onClick={handleStartTrip}
              disabled={!allStepsComplete || startTripMutation.isPending}
              className={cn(
                "rounded-2xl py-4 font-extrabold flex items-center justify-center gap-2 transition",
                allStepsComplete
                  ? "lime-btn hover:shadow-xl hover:shadow-primary/20"
                  : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              )}
            >
              <Distance className="w-4 h-4" />
              {startTripMutation.isPending ? 'Starting...' : 'Start Trip'}
            </Button>
          </div>
        </div>
      </nav>
    </div>
  )
}
