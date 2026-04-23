// app/pages/driver/pickup-checklist.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Verified,
  QrCode,
  Camera,
  Gauge as Speed,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Check,
  X,
  Save,
  CloudUpload,
  FilePlus as NoteAdd,
  EyeOff as VisibilityOff,
  X as Close,
  Ruler as Distance,
  MailCheck as MarkEmailRead,
  CheckCircle2 as TaskAlt,
  Headset as SupportAgent,
  ArrowRight as ArrowForward,
  Lock,
  FileText as Report,
  Circle as RadioButtonUnchecked,
  CheckCircle as CheckCircleIcon,
  FileCheck as FactCheck,
  Home,
  Car,
  Inbox,
  Menu as MenuIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getUser, useCreate, useDataQuery, useFileUpload } from '@/lib/tanstack/dataQuery'

// Delivery data (fallback)
const MOCK_DELIVERY = {
  id: 'DLV-20418',
  route: 'San Jose → Los Angeles',
  pickupLocation: 'San Jose',
  dropoffLocation: 'Los Angeles',
}

// Steps data
const STEPS = [
  {
    id: 1,
    title: 'Verify VIN last-4',
    description: 'Confirm the vehicle using the last 4 digits of the VIN (required by policy).',
    icon: QrCode,
    required: true,
  },
  {
    id: 2,
    title: 'Capture pickup photos',
    description: 'Required set: front, rear, left, right, and any damage close-ups.',
    icon: Camera,
    required: true,
  },
  {
    id: 3,
    title: 'Record odometer start',
    description: 'Enter starting miles and capture a clear odometer photo (required).',
    icon: Speed,
    required: true,
  },
]

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: MenuIcon },
]

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

  // Step states
  const [vinValue, setVinValue] = useState('')
  const [vinNote, setVinNote] = useState('')
  const [vinVerified, setVinVerified] = useState(false)

  // Photo upload state: array of 6 slots, each containing { file: File | null, preview: string | null }
  const [photoSlots, setPhotoSlots] = useState<Array<{ file: File | null; preview: string | null }>>(
    Array(6).fill(null).map(() => ({ file: null, preview: null }))
  )
  const [photosSaved, setPhotosSaved] = useState(false)
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ slotIndex: number; imageUrl: string }>>([])

  const [odometerValue, setOdometerValue] = useState('')
  const [odometerPhotoAdded, setOdometerPhotoAdded] = useState(false)
  const [odometerSaved, setOdometerSaved] = useState(false)

  // Refs for file input and currently selected slot index
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentSlotIndex = useRef<number | null>(null)

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  // Cleanup object URLs when component unmounts or when photoSlots change
  useEffect(() => {
    return () => {
      photoSlots.forEach(slot => {
        if (slot.preview) {
          URL.revokeObjectURL(slot.preview)
        }
      })
    }
  }, [photoSlots])

  // Mutation for uploading all photos at once
  const uploadPhotosMutation = useFileUpload<{ ok: boolean; files: Array<{ slotIndex: number; url: string }> }>(
    `${import.meta.env.VITE_API_URL}/api/uploads/delivery-evidence`,
    {
      onSuccess: (data) => {
        // Transform the response to match our state format
        const photos = data.files.map(f => ({
          slotIndex: f.slotIndex,
          imageUrl: f.url,
        }))
        setUploadedPhotos(photos)
        setPhotosSaved(true)
        toast.success('Photos saved', {
          description: 'Pickup photos have been uploaded.',
        })
      },
      onError: (error) => {
        toast.error('Failed to upload photos', {
          description: error.message,
        })
        console.error(error)
      },
    }
  )

  // Mutation for saving the entire checklist (VIN, odometer, photo URLs)
  const saveProgressMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/pickup-compliance`,
    {
      onSuccess: () => {
        setVinVerified(true)
        setOdometerSaved(true)
        toast.success('Progress saved', {
          description: 'Checklist data saved. You can now start the trip.',
        })
      },
      onError: (error) => {
        toast.error('Failed to save progress', {
          description: error.message,
        })
      },
    }
  )

  // Mutation for starting the trip
  const startTripMutation = useCreate<any, any>(
    `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/start-trip`,
    {
      onSuccess: () => {
        toast.success('Trip started!', {
          description: 'You are now on route. Safe travels!',
        })
        navigate({ to: '/driver-active', search: {deliveryId} })
      },
      onError: (error) => {
        toast.error('Failed to start trip', {
          description: error.message,
        })
      },
    }
  )

  // Unused single-file upload (kept to avoid breaking existing code)
  const uploadPhoto = useFileUpload(`${import.meta.env.VITE_API_URL}/api/uploads/delivery-evidence`, {
    onSuccess: (data) => {
      // This is intentionally left unused to preserve original behavior
    },
    onError: (error) => {
      toast.error('Failed to upload photo')
      console.error(error)
    },
  })

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/driver-signin' })
  }

  // Step handlers
  const handleVerifyVin = () => {
    if (!vinValue || vinValue.length !== 4) {
      toast.error('Invalid VIN', {
        description: 'Please enter the last 4 digits of the VIN.',
      })
      return
    }
    setVinVerified(true)
    toast.success('VIN verified', {
      description: 'Vehicle identity confirmed.',
    })
  }

  const handleReportMismatch = () => {
    toast.warning('VIN mismatch reported', {
      description: 'Support has been notified.',
    })
  }

  // Photo handlers
  const handleAddPhoto = (index: number) => {
    // Store which slot we're adding to
    currentSlotIndex.current = index
    // Trigger file input
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || currentSlotIndex.current === null) return

    const index = currentSlotIndex.current
    // Create preview URL
    const previewUrl = URL.createObjectURL(file)

    // Update the slot
    setPhotoSlots(prev => {
      const newSlots = [...prev]
      // Revoke old preview if exists
      if (newSlots[index].preview) {
        URL.revokeObjectURL(newSlots[index].preview!)
      }
      newSlots[index] = { file, preview: previewUrl }
      return newSlots
    })

    // Clear the input so the same file can be selected again if needed
    e.target.value = ''
  }

  const handleSavePhotos = () => {
    // Check if all 6 photos have been selected
    const allPhotosAdded = photoSlots.every(slot => slot.file !== null)
    if (!allPhotosAdded) {
      toast.error('Missing photos', {
        description: 'Please capture all required pickup photos.',
      })
      return
    }

    // Build FormData
    const formData = new FormData()
    photoSlots.forEach((slot) => {
      if (slot.file) {
        formData.append('files', slot.file)
      }
    })
    formData.append('deliveryId', deliveryId)

    // Upload
    uploadPhotosMutation.mutate(formData)
  }

  const handleAddDamageNote = () => {
    toast.info('Damage note', {
      description: 'Add damage description.',
    })
  }

  const handleAddOdometerPhoto = () => {
    setOdometerPhotoAdded(true)
    toast.success('Odometer photo added')
  }

  const handleSaveOdometer = () => {
    if (!odometerValue) {
      toast.error('Odometer required', {
        description: 'Please enter the starting odometer reading.',
      })
      return
    }
    // if (!odometerPhotoAdded) {
    //   toast.error('Photo required', {
    //     description: 'Please add an odometer photo.',
    //   })
    //   return
    // }
    setOdometerSaved(true)
    toast.success('Odometer saved', {
      description: 'Starting odometer recorded.',
    })
  }

  const handleMarkUnreadable = () => {
    toast.warning('Odometer marked unreadable', {
      description: 'Support will be notified.',
    })
  }

  const handleSaveProgress = () => {
    // Validate inputs
    if (!vinValue || vinValue.length !== 4) {
      toast.error('Invalid VIN', {
        description: 'Please enter the last 4 digits of the VIN.',
      })
      return
    }
    if (!odometerValue || isNaN(Number(odometerValue))) {
      toast.error('Invalid odometer', {
        description: 'Please enter a valid numeric odometer reading.',
      })
      return
    }
    // if (!odometerPhotoAdded) {
    //   toast.error('Odometer photo missing', {
    //     description: 'Please add an odometer photo.',
    //   })
    //   return
    // }
    if (uploadedPhotos.length !== 6) {
      toast.error('Photos not uploaded', {
        description: 'Please upload all 6 pickup photos first.',
      })
      return
    }

    // Prepare payload
    const payload = {
      driverId,
      vinVerificationCode: vinValue,
      odometerStart: Number(odometerValue),
      photos: uploadedPhotos.map(p => ({
        slotIndex: p.slotIndex,
        imageUrl: p.imageUrl,
      })),
    }

    saveProgressMutation.mutate(payload)
  }

  // Check GPS location permission
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
      const code = err?.code
      if (code === err?.PERMISSION_DENIED || code === 1) {
        setLocationStatus('denied')
      } else {
        setLocationStatus('denied')
      }
    }
    setIsCheckingLocation(false)
    return false
  }

  const handleStartTrip = async () => {
    if (!vinVerified || !photosSaved || !odometerSaved) {
      toast.error('Cannot start trip', {
        description: 'Please complete all required steps first.',
      })
      return
    }

    // Check GPS before allowing trip start
    const hasLocation = await checkLocationPermission()
    if (!hasLocation) {
      toast.error('Location required', {
        description: 'Please enable location services and allow GPS access, then try again.',
        duration: 8000,
      })
      return
    }

    const payload = {
      driverId,
      actorUserId: userId,
      actorRole: 'DRIVER',
    }

    startTripMutation.mutate(payload)
  }

  const handleCancel = () => {
    toast.info('Checklist cancelled', {
      description: 'Returning to active delivery.',
    })
    navigate({ to: '/driver-active' })
  }

  // Check if all steps are complete (including location)
  const allStepsComplete = vinVerified && photosSaved && odometerSaved && locationStatus === 'granted'

  // Status badges
  const getStepStatus = (stepId: number) => {
    switch (stepId) {
      case 1:
        return vinVerified ? 'Done' : 'Pending'
      case 2:
        return photosSaved ? 'Done' : 'Pending'
      case 3:
        return odometerSaved ? 'Done' : 'Pending'
      default:
        return 'Pending'
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
                {/* {deliveryId} • {MOCK_DELIVERY.pickupLocation} */}
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
        {/* ── ORDER DETAILS CARD ── */}
        {delivery && (
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg mb-5">
            <CardContent className="p-5">
              {/* Route */}
              <h2 className="text-[18px] font-black text-slate-900 dark:text-white leading-tight">
                {delivery.pickupAddress?.split(',')[1]?.trim() || 'Pickup'} &rarr; {delivery.dropoffAddress?.split(',')[1]?.trim() || 'Dropoff'}
              </h2>

              {/* Vehicle info */}
              {(delivery.vehicleMake || delivery.vehicleModel || delivery.licensePlate) && (
                <div className="mt-3 flex items-center gap-2">
                  <Car className="w-4 h-4 text-slate-400" />
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
                    {[delivery.vehicleColor, delivery.vehicleYear, delivery.vehicleMake, delivery.vehicleModel].filter(Boolean).join(' ')}
                    {delivery.licensePlate ? ` • ${delivery.licensePlate}` : ''}
                  </span>
                </div>
              )}

              {/* Addresses */}
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pickup</p>
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white">{delivery.pickupAddress || '—'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dropoff</p>
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white">{delivery.dropoffAddress || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Contacts */}
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
                {delivery.customer?.contactName && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sender</p>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white mt-0.5">{delivery.customer.contactName}</p>
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

        {/* Pickup checklist */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Pickup Checklist
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Complete these steps before you can start the trip.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <QrCode className="w-3.5 h-3.5 text-primary mr-1" />
                    VIN last-4
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Camera className="w-3.5 h-3.5 text-primary mr-1" />
                    Pickup photos
                  </Badge>
                  <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Speed className="w-3.5 h-3.5 text-primary mr-1" />
                    Odometer start
                  </Badge>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Delivery</p>
                {/* <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{deliveryId}</p> */}
                {/* <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">{MOCK_DELIVERY.route}</p> */}

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
{/* 
            <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
              <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                Prototype UI: uploads + validation are simulated. In production, every photo is time-stamped, geo-tagged (optional), and audited.
              </p>
            </div> */}
          </CardContent>
        </Card>

        {/* Steps */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: checklist */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: VIN last-4 */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              vinVerified && "border-primary/25 bg-primary/5"
            )}>
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    vinVerified 
                      ? "bg-primary/10 border-primary/25 text-slate-900" 
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {vinVerified ? <Check className="w-4 h-4 text-primary" /> : 1}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Verify VIN last-4</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Confirm the vehicle using the last 4 digits of the VIN (required by policy).
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
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">VIN last-4</label>
                            <Input
                              value={vinValue}
                              onChange={(e) => setVinValue(e.target.value)}
                              maxLength={4}
                              className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                              placeholder="e.g., 7K21"
                            />
                          </div>
{/* 
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Optional note</label>
                            <Input
                              value={vinNote}
                              onChange={(e) => setVinNote(e.target.value)}
                              className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                              placeholder="Any pickup notes…"
                            />
                          </div> */}
                        </div>

                        {/* Buttons commented out as requested */}
                        {/*
                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                          <Button
                            onClick={handleVerifyVin}
                            className="flex-1 bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold rounded-2xl py-3 hover:opacity-90 transition flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Verify VIN
                          </Button>

                          <Button
                            onClick={handleReportMismatch}
                            variant="outline"
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-extrabold rounded-2xl py-3 hover:bg-primary/5 transition flex items-center justify-center gap-2"
                          >
                            <Report className="w-4 h-4 text-primary" />
                            Report mismatch
                          </Button>
                        </div>
                        */}
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/25">
                        <p className="text-sm font-extrabold text-slate-900">VIN verified ✓</p>
                        <p className="text-[11px] text-slate-700 mt-1">You can proceed to photos and odometer.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Pickup photos */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              photosSaved && "border-primary/25 bg-primary/5"
            )}>
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    photosSaved 
                      ? "bg-primary/10 border-primary/25 text-slate-900" 
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {photosSaved ? <Check className="w-4 h-4 text-primary" /> : 2}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Capture pickup photos</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Required set: front, rear, left, right, and any damage close-ups.
                        </p>
                      </div>

                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        <Camera className="w-3.5 h-3.5 text-primary mr-1" />
                        Required
                      </Badge>
                    </div>

                    {!photosSaved ? (
                      <>
                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          {photoSlots.map((slot, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              onClick={() => handleAddPhoto(index)}
                              className={cn(
                                "h-16 rounded-2xl border-2 border-dashed flex items-center justify-center p-0 hover:bg-primary/5 transition overflow-hidden",
                                slot.file
                                  ? "border-primary bg-primary/10"
                                  : "border-slate-200 dark:border-slate-700"
                              )}
                            >
                              {slot.preview ? (
                                <img
                                  src={slot.preview}
                                  alt={`Pickup ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : slot.file ? (
                                <Check className="w-5 h-5 text-primary" />
                              ) : (
                                <Camera className="w-5 h-5 text-primary" />
                              )}
                            </Button>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                          <Button
                            onClick={handleSavePhotos}
                            disabled={uploadPhotosMutation.isPending}
                            className="flex-1 bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold rounded-2xl py-3 hover:opacity-90 transition flex items-center justify-center gap-2"
                          >
                            {uploadPhotosMutation.isPending ? (
                              <>Uploading...</>
                            ) : (
                              <>
                                <CloudUpload className="w-4 h-4" />
                                Save photos
                              </>
                            )}
                          </Button>
                          {/* <Button
                            onClick={handleAddDamageNote}
                            variant="outline"
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-extrabold rounded-2xl py-3 hover:bg-primary/5 transition flex items-center justify-center gap-2"
                          >
                            <NoteAdd className="w-4 h-4 text-primary" />
                            Add damage note
                          </Button> */}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/25">
                        <p className="text-sm font-extrabold text-slate-900">Pickup photos saved ✓</p>
                        <p className="text-[11px] text-slate-700 mt-1">Next: record odometer start.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Odometer start */}
            <Card className={cn(
              "border-slate-200 dark:border-slate-800 shadow-lg hover-lift",
              odometerSaved && "border-primary/25 bg-primary/5"
            )}>
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border",
                    odometerSaved 
                      ? "bg-primary/10 border-primary/25 text-slate-900" 
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  )}>
                    {odometerSaved ? <Check className="w-4 h-4 text-primary" /> : 3}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Record odometer start</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Enter starting miles and capture a clear odometer photo (required).
                        </p>
                      </div>

                      <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold">
                        <Speed className="w-3.5 h-3.5 text-primary mr-1" />
                        Required
                      </Badge>
                    </div>

                    {!odometerSaved ? (
                      <>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-1 gap-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Odometer start</label>
                            <Input
                              value={odometerValue}
                              onChange={(e) => setOdometerValue(e.target.value)}
                              className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                              placeholder="e.g., 54210"
                              inputMode="numeric"
                            />
                          </div>

                          {/* <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Odometer photo</label>
                            <Button
                              variant="outline"
                              onClick={handleAddOdometerPhoto}
                              className={cn(
                                "h-12 w-full rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 font-extrabold hover:bg-primary/5 transition",
                                odometerPhotoAdded
                                  ? "border-primary bg-primary/10"
                                  : "border-slate-200 dark:border-slate-700"
                              )}
                            >
                              {odometerPhotoAdded ? (
                                <>
                                  <Check className="w-4 h-4 text-primary" />
                                  Added
                                </>
                              ) : (
                                <>
                                  <Camera className="w-4 h-4 text-primary" />
                                  Add photo
                                </>
                              )}
                            </Button>
                          </div> */}
                        </div>

                        {/* Buttons commented out as requested */}
                        
                        {/* <div className="mt-4 flex flex-col sm:flex-row gap-3">
                          <Button
                            onClick={handleSaveOdometer}
                            className="flex-1 lime-btn rounded-2xl py-3 hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Save odometer
                          </Button>

                          <Button
                            onClick={handleMarkUnreadable}
                            variant="outline"
                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-extrabold rounded-2xl py-3 hover:bg-primary/5 transition flex items-center justify-center gap-2"
                          >
                            <VisibilityOff className="w-4 h-4 text-primary" />
                            Unreadable?
                          </Button>
                        </div> */}
                       
                      </>
                    ) : (
                      <div className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/25">
                        <p className="text-sm font-extrabold text-slate-900">Odometer saved ✓</p>
                        <p className="text-[11px] text-slate-700 mt-1">You can now start tracking and begin the trip.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: policy / tips */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Pickup checklist status</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">All required items must be complete to start.</p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <FactCheck className="w-5 h-5 text-primary" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <RadioButtonUnchecked className={cn(
                          "w-5 h-5",
                          getStepStatus(step) === 'Done' ? "text-primary" : "text-slate-400"
                        )} />
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {step === 1 && 'VIN last-4'}
                          {step === 2 && 'Pickup photos'}
                          {step === 3 && 'Odometer start'}
                        </p>
                      </div>
                      <span className={cn(
                        "text-[11px] font-black uppercase tracking-widest",
                        getStepStatus(step) === 'Done' ? "text-primary" : "text-slate-400"
                      )}>
                        {getStepStatus(step)}
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
                        <li>• Take photos in good light, avoid glare.</li>
                        <li>• Include full vehicle angles + any damage close-ups.</li>
                        {/* <li>• Odometer photo must be readable.</li> */}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardContent className="p-6 sm:p-7">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Next steps</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">After pickup checklist is complete.</p>

                <div className="mt-5 space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Distance className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">Start trip tracking</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Tracking begins when you tap Start.</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Step 4</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <MarkEmailRead className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">Send check-ins</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Ops & stakeholders get updates.</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">During</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <TaskAlt className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">Complete drop-off checklist</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Drop-off photos + odometer end required.</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Finish</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 font-extrabold hover:bg-primary/5 transition flex items-center justify-center gap-2"
            >
              <Close className="w-4 h-4 text-primary" />
              Cancel
            </Button>

            <Button
              onClick={handleSaveProgress}
              disabled={saveProgressMutation.isPending || uploadPhotosMutation.isPending}
              className="bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-2xl py-4 font-extrabold hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveProgressMutation.isPending ? 'Saving...' : 'Save'}
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