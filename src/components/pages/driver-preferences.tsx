// app/pages/driver/preferences.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
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
import { getUser, useCreate, useDataQuery, useFileUpload } from '@/lib/tanstack/dataQuery'
import { Map as MapComponent } from '@/components/map/GoogleMap'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import LocationAutocomplete from '@/components/map/LocationAutocomplete' // adjust path as needed

// Form schema – includes all fields for the combined payload
const preferencesSchema = z.object({
  // Personal Info
  phone: z.string().optional(),
  profilePhotoUrl: z.string().url().optional().or(z.literal('')),

  // Service Area (maps to preferences object)
  primaryCity: z.string().optional(),
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

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: MenuIcon },
]

export default function DriverPreferencesPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const driver = getUser()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const updateProfile = useCreate(
    `${import.meta.env.VITE_API_URL}/api/drivers/${driver?.profileId}/profile`,
    {
      method: 'PATCH',
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
      primaryCity: 'San Jose',
      radius: '25',
      homeBaseLat: 34.0522,
      homeBaseLng: -118.2437,
      homeBaseCity: 'Los Angeles',
      homeBaseState: 'CA',
      alertEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
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
        primaryCity: driverProfile.preferences?.city || '',
        radius: driverProfile.preferences?.radiusMiles?.toString() || '25',
        homeBaseLat: driverProfile.location?.homeBaseLat ?? 34.0522,
        homeBaseLng: driverProfile.location?.homeBaseLng ?? -118.2437,
        homeBaseCity: driverProfile.location?.homeBaseCity || 'Los Angeles',
        homeBaseState: driverProfile.location?.homeBaseState || 'CA',
        alertEnabled: driverProfile.alerts?.enabled ?? true,
        emailEnabled: driverProfile.alerts?.emailEnabled ?? true,
        smsEnabled: driverProfile.alerts?.smsEnabled ?? false,
        serviceDistrictIds: driverProfile.districts?.map((d: any) => d.district.id) || [],
        // UI‑only fields (keep defaults)
        zipCode: '95112',
        maxTripDistance: '100',
        urgentAlerts: true,
        // days: MOCK_PREFERENCES.days.filter(d => d.checked).map(d => d.id),
        startTime: '09:00',
        endTime: '17:00',
      });

      // Update map center if location data exists
      if (driverProfile.location?.homeBaseLat && driverProfile.location?.homeBaseLng) {
        setMapCenter({
          lat: driverProfile.location.homeBaseLat,
          lng: driverProfile.location.homeBaseLng,
        });
      }
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
  const [mapCenter, setMapCenter] = useState(() => ({
    lat: form.getValues('homeBaseLat') || 34.0522,
    lng: form.getValues('homeBaseLng') || -118.2437,
  }))

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
    reverseGeocode({ lat, lng })
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        form.setValue('homeBaseLat', latitude)
        form.setValue('homeBaseLng', longitude)
        setMapCenter({ lat: latitude, lng: longitude })
        reverseGeocode({ lat: latitude, lng: longitude })
        toast.success('Location updated')
      },
      () => {
        toast.error('Unable to get current location')
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
  const handlePrimaryCityPlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (!place.address_components) return
    // Extract city (locality) from address components
    let city = ''
    for (const component of place.address_components) {
      if (component.types.includes('locality')) {
        city = component.long_name
        break
      }
    }
    if (city) {
      form.setValue('primaryCity', city, { shouldValidate: true })
    } else if (place.formatted_address) {
      // Fallback to formatted address if no locality
      form.setValue('primaryCity', place.formatted_address, { shouldValidate: true })
    }
  }

  const handleHomeBaseCityPlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (!place.geometry || !place.geometry.location || !place.address_components) return

    const lat = place.geometry.location.lat()
    const lng = place.geometry.location.lng()
    form.setValue('homeBaseLat', lat)
    form.setValue('homeBaseLng', lng)
    setMapCenter({ lat, lng })

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

    const payload = {
      phone: data.phone || undefined,
      profilePhotoUrl: data.profilePhotoUrl || undefined,
      preferences: {
        city: data.primaryCity,
        radiusMiles: data.radius ? parseFloat(data.radius) : null,
      },
      alerts: {
        enabled: data.alertEnabled,
        emailEnabled: data.emailEnabled,
        smsEnabled: data.smsEnabled,
      },
      location: {
        homeBaseLat: data.homeBaseLat,
        homeBaseLng: data.homeBaseLng,
        homeBaseCity: data.homeBaseCity,
        homeBaseState: data.homeBaseState,
      },
      serviceDistrictIds: data.serviceDistrictIds,
    }

    updateProfile.mutate(payload)
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
                Update your contact details and profile photo.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-9 items-start">
              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Phone Number
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
                    onClick={handlePreviewClick}
                    className={cn(
                      "relative w-24 h-24 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer hover:opacity-90 transition",
                      uploadPhoto.isPending && "opacity-50 cursor-wait"
                    )}
                  >
                    {uploadPhoto.isPending ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : form.watch('profilePhotoUrl') ? (
                      <img
                        src={form.watch('profilePhotoUrl')}
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Click the photo to upload a new image.
                  </p>
                  {uploadPhoto.isPending && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading...
                    </p>
                  )}
                  {form.watch('profilePhotoUrl') && !uploadPhoto.isPending && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Photo ready</p>
                  )}
                </div>
              </div>
            </div>
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
                Define where you want to receive job listings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Primary City
                </Label>
                <LocationAutocomplete
                  value={form.watch('primaryCity') || ''}
                  onChange={(value) => form.setValue('primaryCity', value, { shouldValidate: true })}
                  onPlaceSelect={handlePrimaryCityPlaceSelect}
                  placeholder="San Jose"
                  isLoaded={googleMapsLoaded}
                  icon={<MapPin className="w-4 h-4 text-slate-400" />}
                />
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

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="chip bg-primary/10 border-primary/25 text-slate-800 dark:text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-primary mr-1" />
                CA Only
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Location (home base) with Map */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Home Base Location
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Set your default starting point by clicking on the map or using your current location.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleUseCurrentLocation}
                className="rounded-2xl w-full sm:w-auto"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Use My Current Location
              </Button>
            </div>

            {!googleMapsLoaded ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <MapComponent
                    center={mapCenter}
                    markers={[{ lat: form.watch('homeBaseLat') || mapCenter.lat, lng: form.watch('homeBaseLng') || mapCenter.lng }]}
                    zoom={12}
                    onClick={handleMapClick}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      City
                    </Label>
                    <LocationAutocomplete
                      value={form.watch('homeBaseCity') || ''}
                      onChange={(value) => form.setValue('homeBaseCity', value, { shouldValidate: true })}
                      onPlaceSelect={handleHomeBaseCityPlaceSelect}
                      placeholder="Los Angeles"
                      isLoaded={googleMapsLoaded}
                      icon={<Home className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      State
                    </Label>
                    <Input
                      value={form.watch('homeBaseState') || ''}
                      onChange={(e) => form.setValue('homeBaseState', e.target.value)}
                      placeholder="CA"
                      className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* District Preferences */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">District Preferences</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Choose specific districts to prioritize.
              </p>
            </div>

            {districtsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : districtsError ? (
              <Alert variant="destructive">
                <AlertTitle>Error loading districts</AlertTitle>
                <AlertDescription>
                  {districtsErrorObj?.message || 'Please try again later.'}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {districtList?.map((district: any) => (
                  <Label
                    key={district.id}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition",
                      serviceDistrictIds.includes(district.id)
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900"
                    )}
                  >
                    <Checkbox
                      checked={serviceDistrictIds.includes(district.id)}
                      onCheckedChange={() => handleDistrictChange(district.id)}
                    />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {district.name || district.label}
                    </span>
                  </Label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
            </div>
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
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                <div className="w-10 h-10 mx-auto rounded-2xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {item.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}