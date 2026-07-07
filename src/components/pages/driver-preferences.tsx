// app/pages/driver/preferences.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  MapPin,
  Home,
  Bell,
  Calendar,
  Clock,
  Check,
  Save,
  Car,
  Inbox,
  Menu as MenuIcon,
  Loader2,
  Phone,
  Camera,
  CreditCard,
  ArrowRight as ArrowForward,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import { getUser, useDataQuery, useFileUpload, usePatch } from '@/lib/tanstack/dataQuery'
import { GoogleMap, Marker } from '@react-google-maps/api'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import PickupZoneOverlay from '@/components/map/PickupZoneOverlay'
import { usePickupZones } from '@/hooks/usePickupZones'
import PolicySheet from '../shared/PolicySheet'
// import DriverBottomNav from '../layout/DriverBottomNav'

// Form schema – includes all fields for the combined payload
const preferencesSchema = z.object({
  // Personal Info
  phone: z.string().optional(),
  profilePhotoUrl: z.string().url().optional().or(z.literal('')),

  // Service Area (maps to preferences object)
  primaryZip: z.string().regex(/^\d{5}$/, 'Enter a valid 5-digit ZIP code').optional().or(z.literal('')),
  radius: z.string().optional(),

  // Location (home base)
  homeBaseLat: z.number().optional(),
  homeBaseLng: z.number().optional(),
  homeBaseCity: z.string().optional(),
  homeBaseState: z.string().optional(),

  // Alerts
  alertEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  soundEnabled: z.boolean().default(true),

  // District Preferences – stored as array of district IDs
  serviceDistrictIds: z.array(z.string()).default([]),

  // Additional fields from original UI (not sent to API, but kept for UI)
  zipCode: z.string().optional(),
  maxTripDistance: z.string().optional(),
  urgentAlerts: z.boolean().optional(),
  days: z.array(z.string()).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
})

type PreferencesFormData = z.infer<typeof preferencesSchema>

// Preferences data
const MOCK_PREFERENCES = {
  days: [
    { id: 'mon', label: 'Mon', checked: true },
    { id: 'tue', label: 'Tue', checked: true },
    { id: 'wed', label: 'Wed', checked: false },
    { id: 'thu', label: 'Thu', checked: false },
    { id: 'fri', label: 'Fri', checked: true },
    { id: 'sat', label: 'Sat', checked: false },
    { id: 'sun', label: 'Sun', checked: false },
  ],
  radiusOptions: [
    { value: '25', label: '25 miles' },
    { value: '50', label: '50 miles' },
    { value: '75', label: '75 miles' },
    { value: '100', label: '100 miles' },
  ],
  maxTripOptions: [
    { value: '100', label: 'Up to 100 miles' },
    { value: '200', label: 'Up to 200 miles' },
    { value: '300', label: 'Up to 300 miles' },
    { value: 'unlimited', label: 'No limit' },
  ],
}

export default function DriverPreferencesPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const driver = getUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const [openPolicySheet, setOpenPolicySheet] = useState<'agreement' | 'terms' | 'privacy' | null>(null);
  // Google Maps API loader
  const { isLoaded: googleMapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Fetch real districts
  const {
    data: districtList,
    isLoading: districtsLoading,
    isError: districtsError,
    error: districtsErrorObj,
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/serviceDistricts`,
    noFilter: true,
  })

  // Fetch pickup zones for map overlay
  const { zones: pickupZones } = usePickupZones()

  // Default map center for California (same as driver-dashboard-map.tsx)
  const CA_DEFAULT_CENTER = { lat: 33.94, lng: -118.40 }

  // Track whether the driver has manually set a location (via map click, geocode, or toggle)
  const [locationManuallySet, setLocationManuallySet] = useState(false)

  // Locating state for toggle feedback
  const [locating, setLocating] = useState(false)

  // "Use My Current Location" toggle state — read from localStorage (same as dashboard-list.tsx)
  const [useCurrentLocation, setUseCurrentLocation] = useState(() =>
    localStorage.getItem('driverUseMyLocation') === 'true'
  )

  // CA Only toggle state
  const [caOnly, setCaOnly] = useState(false)

  // Fetch driver profile to prefill form
  const {
    data: driverProfile,
    isLoading: driverProfileLoading,
    isError: driverProfileError,
    error: driverProfileErrorObj,
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/drivers/${driver?.profileId}`,
    noFilter: true,
    enabled: !!driver?.profileId,
  })

  // Single mutation for PATCH /drivers/{driverId}/profile
  const updateProfile = usePatch(
    `${import.meta.env.VITE_API_URL}/api/drivers/${driver?.profileId}/profile`,
    {
      onSuccess: () => {
        toast.success('Preferences saved successfully')
      },
      onError: (error) => {
        toast.error('Failed to save preferences')
        console.error(error)
      },
      successMessage: '',
    }
  )

  // Upload mutation for profile photo
  const uploadPhoto = useFileUpload(`${import.meta.env.VITE_API_URL}/api/uploads/driver-profile-photo`, {
    onSuccess: (data) => {
      const photoUrl = data.url || data
      form.setValue('profilePhotoUrl', photoUrl)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Photo uploaded successfully')
    },
    onError: (error) => {
      toast.error('Failed to upload photo')
      console.error(error)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setPreviewUrl(null)
    },
  })

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      phone: '',
      profilePhotoUrl: '',
      primaryZip: '',
      radius: '25',
      homeBaseLat: undefined,
      homeBaseLng: undefined,
      homeBaseCity: '',
      homeBaseState: '',
      alertEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      soundEnabled: true,
      serviceDistrictIds: [],
      zipCode: '95112',
      maxTripDistance: '100',
      urgentAlerts: true,
      days: MOCK_PREFERENCES.days.filter(d => d.checked).map(d => d.id),
      startTime: '09:00',
      endTime: '17:00',
    },
  })

  // Prefill form with fetched profile data
  useEffect(() => {
    if (driverProfile) {
      form.reset({
        phone: driverProfile.phone || '',
        profilePhotoUrl: driverProfile.profilePhotoUrl || '',
        primaryZip: driverProfile.preferences?.city || '',
        radius: driverProfile.preferences?.radiusMiles?.toString() || '25',
        homeBaseLat: driverProfile.location?.homeBaseLat ?? undefined,
        homeBaseLng: driverProfile.location?.homeBaseLng ?? undefined,
        homeBaseCity: driverProfile.location?.homeBaseCity || '',
        homeBaseState: driverProfile.location?.homeBaseState || '',
        alertEnabled: driverProfile.alerts?.enabled ?? true,
        emailEnabled: driverProfile.alerts?.emailEnabled ?? true,
        smsEnabled: driverProfile.alerts?.smsEnabled ?? false,
        soundEnabled: driverProfile.alerts?.soundEnabled ?? true,
        serviceDistrictIds: driverProfile.districts?.map((d: any) => d.district.id) || [],
        // UI‑only fields (keep defaults)
        zipCode: '95112',
        maxTripDistance: '100',
        urgentAlerts: true,
        // days: MOCK_PREFERENCES.days.filter(d => d.checked).map(d => d.id),
        startTime: '09:00',
        endTime: '17:00',
      });

      // Update map center if location data exists from backend
      if (driverProfile.location?.homeBaseLat && driverProfile.location?.homeBaseLng) {
        setMapCenter({
          lat: driverProfile.location.homeBaseLat,
          lng: driverProfile.location.homeBaseLng,
        });
        setLocationManuallySet(true);
      } else {
        setMapCenter(CA_DEFAULT_CENTER);
      }

      // Sync soundEnabled to localStorage for dashboard-list to read
      localStorage.setItem('driverSoundEnabled', String(driverProfile.alerts?.soundEnabled ?? true))
    }
  }, [driverProfile, form]);

  // Watch serviceDistrictIds for checkbox handling
  const serviceDistrictIds = form.watch('serviceDistrictIds')

  const handleDistrictChange = (districtId: string) => {
    const current = form.getValues('serviceDistrictIds')
    const newSelection = current.includes(districtId)
      ? current.filter(id => id !== districtId)
      : [...current, districtId]
    form.setValue('serviceDistrictIds', newSelection)
  }

  const handleDayChange = (dayId: string) => {
    const current = form.getValues('days') || []
    const newSelection = current.includes(dayId)
      ? current.filter(id => id !== dayId)
      : [...current, dayId]
    form.setValue('days', newSelection)
  }

  // Map state and handlers
  const [mapCenter, setMapCenter] = useState(CA_DEFAULT_CENTER)

  const reverseGeocode = (latlng: { lat: number; lng: number }) => {
    if (!window.google) return
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: latlng }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const address = results[0].address_components
        let city = ''
        let state = ''
        for (const component of address) {
          if (component.types.includes('locality')) {
            city = component.long_name
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name
          }
        }
        form.setValue('homeBaseCity', city)
        form.setValue('homeBaseState', state)
      }
    })
  }

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    form.setValue('homeBaseLat', lat)
    form.setValue('homeBaseLng', lng)
    setMapCenter({ lat, lng })
    setLocationManuallySet(true)
    reverseGeocode({ lat, lng })
  }

  const panMapTo = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng })
      mapRef.current.setZoom(12)
    }
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        form.setValue('homeBaseLat', latitude)
        form.setValue('homeBaseLng', longitude)
        setMapCenter({ lat: latitude, lng: longitude })
        panMapTo(latitude, longitude)
        setLocationManuallySet(true)
        reverseGeocode({ lat: latitude, lng: longitude })
        toast.success('Location updated')
        setLocating(false)
      },
      () => {
        toast.error('Unable to get current location')
        setUseCurrentLocation(false)
        localStorage.setItem('driverUseMyLocation', 'false')
        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    )
  }

  // Photo upload state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    if (!driver?.profileId) {
      toast.error('Driver not authenticated')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('driverId', String(driver.profileId))

    uploadPhoto.mutate(formData)
  }

  const handlePreviewClick = () => {
    fileInputRef.current?.click()
  }

  // Autocomplete handlers
  const handleHomeBaseCityPlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (!place.geometry || !place.geometry.location || !place.address_components) return

    const lat = place.geometry.location.lat()
    const lng = place.geometry.location.lng()
    form.setValue('homeBaseLat', lat)
    form.setValue('homeBaseLng', lng)
    setMapCenter({ lat, lng })
    setLocationManuallySet(true)

    let city = ''
    let state = ''
    for (const component of place.address_components) {
      if (component.types.includes('locality')) {
        city = component.long_name
      }
      if (component.types.includes('administrative_area_level_1')) {
        state = component.short_name
      }
    }

    if (city) form.setValue('homeBaseCity', city)
    if (state) form.setValue('homeBaseState', state)

    if (!state) {
    reverseGeocode({ lat, lng });
  }
  }

  // Determine if main save should be disabled: if upload is pending or profile loading
  const isSaveDisabled = updateProfile.isPending || uploadPhoto.isPending || driverProfileLoading

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/driver-signin' })
  }

  // Submit handler – constructs the combined payload
  const onSubmit = (data: PreferencesFormData) => {
    if (!driver?.profileId) {
      toast.error('Driver not authenticated')
      return
    }

    // Only include location in payload if the driver manually set it
    const locationPayload = locationManuallySet
      ? {
          homeBaseLat: data.homeBaseLat,
          homeBaseLng: data.homeBaseLng,
          homeBaseCity: data.homeBaseCity,
          homeBaseState: data.homeBaseState,
        }
      : undefined

    const payload = {
      phone: data.phone || undefined,
      profilePhotoUrl: data.profilePhotoUrl || undefined,
      preferences: {
        city: data.primaryZip || undefined,
        radiusMiles: data.radius ? parseFloat(data.radius) : null,
      },
      alerts: {
        enabled: data.alertEnabled,
        emailEnabled: data.emailEnabled,
        smsEnabled: data.smsEnabled,
        soundEnabled: data.soundEnabled,
      },
      ...(locationPayload ? { location: locationPayload } : {}),
      serviceDistrictIds: data.serviceDistrictIds,
    }

    updateProfile.mutate(payload)

    // Save soundEnabled to localStorage for instant access in dashboard-list
    localStorage.setItem('driverSoundEnabled', String(data.soundEnabled))
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-menu"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Driver
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Preferences
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* Personal Information */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Personal Information</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Update your contact details.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-9 items-start">
              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Cell Phone
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="+1-555-111-2222"
                    className="h-12 pl-10 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                  />
                </div>
              </div>

              {/* Profile Photo Upload */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Profile Photo
                </Label>
                <div className="flex flex-col items-start gap-2">
                  <div
                    className={cn(
                      "relative w-24 h-24 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed"
                    )}
                  >
                    {uploadPhoto.isPending ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : form.watch('profilePhotoUrl') || driverProfile?.selfiePhotoUrl ? (
                      <img
                        src={form.watch('profilePhotoUrl') || driverProfile?.selfiePhotoUrl || ''}
                        alt="Current"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {!form.watch('profilePhotoUrl') && !driverProfile?.selfiePhotoUrl && !uploadPhoto.isPending && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                      Tap to take a new photo
                    </p>
                  )}
                  {uploadPhoto.isPending && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading...
                    </p>
                  )}
                  {(form.watch('profilePhotoUrl') || driverProfile?.selfiePhotoUrl) && !uploadPhoto.isPending && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Photo ready</p>
                  )}
                  <p className="text-xs text-slate-900 dark:text-white leading-relaxed">
                    To update your photo,{' '}
                    <Link to="/help-driver" className="text-primary underline underline-offset-2 hover:text-primary/80 transition">
                      contact customer service
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Added license & email information ─── */}
            {driverProfileLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : driverProfile ? (
              <>
                <Separator className="my-4" />
                <div className="space-y-4">
                  {/* Email */}
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Email
                    </Label>
                    <Input
                      readOnly
                      value={driverProfile.user?.email || ''}
                      className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm bg-slate-50 dark:bg-slate-800/20"
                    />
                  </div>

                  {/* License Number & State */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        License Number
                      </Label>
                      <Input
                        readOnly
                        value={driverProfile.licenseNumber || ''}
                        className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        License State
                      </Label>
                      <Input
                        readOnly
                        value={driverProfile.licenseState || ''}
                        className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                  </div>

                  {/* License Images */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        License Front
                      </Label>
                      {driverProfile.licenseFrontUrl ? (
                        <img
                          src={driverProfile.licenseFrontUrl}
                          alt="License Front"
                          className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                        License Back
                      </Label>
                      {driverProfile.licenseBackUrl ? (
                        <img
                          src={driverProfile.licenseBackUrl}
                          alt="License Back"
                          className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                          No image
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
            {/* ─── End of added section ─── */}
          </CardContent>
        </Card>

        {/* Service Area */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Service Area Preferences
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Set where you want to receive vehicle delivery requests.
              </p>
            </div>

            {/* Use My Current Location Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">Use My Current Location</p>
                  <p className="text-[11px] text-slate-500">Use your GPS location as your service area center</p>
                </div>
              </div>
              <Switch
                checked={useCurrentLocation}
                onCheckedChange={(checked) => {
                  setUseCurrentLocation(checked)
                  localStorage.setItem('driverUseMyLocation', String(checked))
                  if (checked) {
                    handleUseCurrentLocation()
                  } else {
                    // Always reset to default California view
                    setMapCenter(CA_DEFAULT_CENTER)
                    panMapTo(CA_DEFAULT_CENTER.lat, CA_DEFAULT_CENTER.lng)
                  }
                }}
                disabled={locating}
              />
            </div>

            {/* Map with pickup zones */}
            {!googleMapsLoaded ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="w-full h-[400px]">
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={mapCenter}
                    zoom={12}
                    onClick={handleMapClick}
                    onLoad={(map) => { mapRef.current = map }}
                  >
                    <PickupZoneOverlay zones={pickupZones} />
                    <Marker
                      position={{
                        lat: form.watch('homeBaseLat') || mapCenter.lat,
                        lng: form.watch('homeBaseLng') || mapCenter.lng,
                      }}
                    />
                  </GoogleMap>
                </div>
                {/* Legend */}
                <div className="absolute bottom-3 left-3 z-10">
                  <Badge className="bg-white/95 dark:bg-slate-900/90 backdrop-blur shadow-lg text-[11px] font-bold">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#39FF14] mr-1.5" />
                    Green area = Pickup Zone
                  </Badge>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryZip" className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Primary ZIP Code
                </Label>
                <Input
                  id="primaryZip"
                  {...form.register('primaryZip', {
                    onChange: (e) => {
                      // Strip non-digits
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 5)
                      e.target.value = cleaned
                      form.setValue('primaryZip', cleaned)
                    },
                  })}
                  placeholder="95112"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={5}
                  className={cn(
                    "h-12 rounded-2xl border dark:bg-slate-800/40 text-sm",
                    form.formState.errors.primaryZip
                      ? "border-red-500 focus-visible:ring-red-500"
                      : "border-slate-200 dark:border-slate-700"
                  )}
                />
                {form.formState.errors.primaryZip && (
                  <p className="text-xs text-red-500">{form.formState.errors.primaryZip.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Radius (miles)
                </Label>
                <Select
                  onValueChange={(value) => form.setValue('radius', value)}
                  defaultValue={form.getValues('radius')}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                    <SelectValue placeholder="Select radius" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_PREFERENCES.radiusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CA Only Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">CA Only</p>
                  <p className="text-[11px] text-slate-500">Restrict service area to California</p>
                </div>
              </div>
              <Switch
                checked={caOnly}
                onCheckedChange={setCaOnly}
              />
            </div>
          </CardContent>
        </Card>

        {/* District Preferences card removed from UI per customer request.
            Backend logic (serviceDistrictIds form field, submit payload,
            driver-job-feed matching) is intentionally LEFT INTACT so the
            feature keeps working and can be re-enabled later by re-adding
            the card. The form field defaults to [] and the submit payload
            still sends serviceDistrictIds, so existing saved districts are
            preserved on Save. */}

        {/* Alert Preferences */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Alert Preferences</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Configure how you want to receive alerts.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">Enable Alerts</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">Master switch for all alerts</p>
                </div>
                <Checkbox
                  checked={form.watch('alertEnabled')}
                  onCheckedChange={(checked) => form.setValue('alertEnabled', checked as boolean)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-58">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-alerts" className="text-sm font-semibold">
                    Email Notifications
                  </Label>
                  <Checkbox
                    id="email-alerts"
                    checked={form.watch('emailEnabled')}
                    onCheckedChange={(checked) => form.setValue('emailEnabled', checked as boolean)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sms-alerts" className="text-sm font-semibold text-gray-400">
                    SMS Notifications
                  </Label>
                  <Checkbox
                    id="sms-alerts"
                    checked={form.watch('smsEnabled')}
                    disabled
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                    onCheckedChange={(checked) => form.setValue('smsEnabled', checked as boolean)}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">Sound Alerts</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">Play a chime when a new job appears in your feed</p>
                </div>
                <Checkbox
                  checked={form.watch('soundEnabled')}
                  onCheckedChange={(checked) => form.setValue('soundEnabled', checked as boolean)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet & Payouts */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <Link
              to="/driver/wallet"
              className="flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Wallet & Payouts</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Earnings, payout method, bank account, and payout history.
                  </p>
                </div>
              </div>
              <ArrowForward className="w-5 h-5 text-slate-400 group-hover:text-primary transition" />
            </Link>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  All preferences will be saved together. Changes affect which jobs appear in your feed and which alerts you receive.
                </p>
              </div>

              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={isSaveDisabled}
                className="lime-btn inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl hover:shadow-xl hover:shadow-primary/20 transition"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save All Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Legal links */}
<div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
  <button
    type="button"
    onClick={() => setOpenPolicySheet('agreement')}
    className="text-lime-500 dark:text-lime-400 font-bold underline underline-offset-2 hover:text-lime-600 dark:hover:text-lime-300 transition"
  >
    Independent Driver Agreement
  </button>
  <button
    type="button"
    onClick={() => setOpenPolicySheet('terms')}
    className="text-lime-500 dark:text-lime-400 font-bold underline underline-offset-2 hover:text-lime-600 dark:hover:text-lime-300 transition"
  >
    Terms of Service
  </button>
  <button
    type="button"
    onClick={() => setOpenPolicySheet('privacy')}
    className="text-lime-500 dark:text-lime-400 font-bold underline underline-offset-2 hover:text-lime-600 dark:hover:text-lime-300 transition"
  >
    Privacy Policy
  </button>
</div>
      </main>
      <PolicySheet
      open={!!openPolicySheet}
      onOpenChange={(open) => {
        if (!open) setOpenPolicySheet(null);
      }}
      type={openPolicySheet ?? "agreement"} // default type (won't be used when null)
      closeLabel="Return to Preferences"
      fromSignUp= {false}
    />
    </div>
  )
}