// DealerSettings.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Save,
  Menu,
  X,
  Plus,
  Edit,
  Trash2,
  Star,
  Verified,
  CreditCard,
  Settings,
  Lock,
  MapPin,
  Phone,
  Mail,
  HelpCircle,
  Info,
} from 'lucide-react'

// Import your data hooks
import {
  getUser,
  useDataQuery,
  useCreate,
  usePatch,
  useDelete,
  useDataMutation,
} from '@/lib/tanstack/dataQuery'

// Import the location autocomplete component
import LocationAutocomplete from '@/components/map/LocationAutocomplete'

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
// ------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------

interface Customer {
  id: string
  businessName: string
  businessWebsite: string
  businessAddress: string
  businessPhone: string
  businessPlaceId: string | null
  contactName: string
  contactEmail: string
  contactPhone: string
  customerType: string
  approvalStatus: string
  postpaidEnabled: boolean
  defaultPickupId?: string
}

interface SavedAddress {
  id: string
  label: string
  address: string
  city: string
  state: string
  country: string
  postalCode: string
  lat: number
  lng: number
  placeId: string
  isDefault: boolean
  createdAt: string
}

interface SavedVehicle {
  id: string
  make: string
  model: string
  color: string
  licensePlate: string
}

function extractAddressComponents(place: google.maps.places.PlaceResult) {
  const addressComponents = place.address_components || []
  const getComponent = (type: string) => {
    const component = addressComponents.find(c => c.types.includes(type))
    return component ? component.long_name : ''
  }
  return {
    locality: getComponent('locality'),
    administrativeAreaLevel1: getComponent('administrative_area_level_1'),
    country: getComponent('country'),
    postalCode: getComponent('postal_code'),
  }
}

export default function DealerSettings() {
  const user = getUser()
  const customerId = user?.profileId

  // --- All hooks must be called unconditionally at the top ---
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteItemType, setDeleteItemType] = useState<'address' | 'vehicle' | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  // Business name autocomplete refs
  const businessNameInputRef = useRef<HTMLInputElement>(null)
  const businessAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const openDeleteAddressDialog = (id: string) => {
  setDeleteItemType('address')
  setDeleteItemId(id)
  setDeleteDialogOpen(true)
}

const openDeleteVehicleDialog = (id: string) => {
  setDeleteItemType('vehicle')
  setDeleteItemId(id)
  setDeleteDialogOpen(true)
}

const confirmDelete = () => {
  if (deleteItemType === 'address' && deleteItemId) {
    deleteAddress.mutate({ pathParams: { id: deleteItemId } })
  } else if (deleteItemType === 'vehicle' && deleteItemId) {
    deleteVehicle.mutate({ pathParams: { id: deleteItemId } })
  }
  setDeleteDialogOpen(false)
  setDeleteItemType(null)
  setDeleteItemId(null)
}
  // Customer data query
  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useDataQuery<Customer>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${customerId}`,
    enabled: !!customerId,
    noFilter: true,
  })

  // Local state for editable fields
  const [businessProfile, setBusinessProfile] = useState({
    name: '',
    website: '',
    address: '',
    phone: '',
    placeId: '',
  })
  const [contactPerson, setContactPerson] = useState({
    name: '',
    email: '',
    phone: '',
  })

  // Saved addresses
  const {
    data: addresses = [],
    isLoading: addressesLoading,
    refetch: refetchAddresses,
  } = useDataQuery<SavedAddress[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/savedAddresses`,
    columnFilters: { 'where[customer][id]': customerId },
    enabled: !!customerId,
    noFilter: true,
  })

  const [addressForm, setAddressForm] = useState({
    label: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    lat: null as number | null,
    lng: null as number | null,
    placeId: '',
    isDefault: false,
  })
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)

  // Saved vehicles
  const {
    data: vehicles = [],
    isLoading: vehiclesLoading,
    refetch: refetchVehicles,
  } = useDataQuery<SavedVehicle[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/savedVehicles`,
    columnFilters: { 'where[customer][id]': customerId },
    enabled: !!customerId,
    noFilter: true,
  })

  const [vehicleForm, setVehicleForm] = useState({
    make: '',
    model: '',
    color: '',
    licensePlate: '',
  })
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)

  // Mutations
  const createAddress = useCreate(`${import.meta.env.VITE_API_URL}/api/savedAddresses`, {
    onSuccess: () => {
      refetchAddresses()
      resetAddressForm()
      toast.success('Address created successfully')
    },
    onError: (error) => toast.error(error.message || 'Failed to create address'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/savedAddresses`]],
  })

  const updateAddress = usePatch(`${import.meta.env.VITE_API_URL}/api/savedAddresses/:id`, {
    onSuccess: () => {
      refetchAddresses()
      resetAddressForm()
      toast.success('Address updated successfully')
    },
    onError: (error) => toast.error(error.message || 'Failed to update address'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/savedAddresses`]],
  })

  const deleteAddress = useDelete(`${import.meta.env.VITE_API_URL}/api/savedAddresses/:id`, {
    onSuccess: () => {
      refetchAddresses()
      toast.success('Address deleted successfully')
    },
    onError: (error) => toast.error(error.message || 'Failed to delete address'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/savedAddresses`]],
  })

  const setDefaultAddress = useDataMutation({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/savedAddresses/:id/defaultForCustomers`,
    method: 'POST',
    onSuccess: () => {
      refetchAddresses()
      toast.success('Default address updated')
    },
    onError: (error) => toast.error(error.message || 'Failed to set default address'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/savedAddresses`]],
  })

  const createVehicle = useCreate(`${import.meta.env.VITE_API_URL}/api/savedVehicles`, {
    onSuccess: () => {
      refetchVehicles()
      resetVehicleForm()
      toast.success('Vehicle created successfully')
    },
    onError: (error) => toast.error(error.message || 'Failed to create vehicle'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/savedVehicles`]],
  })

  const updateVehicle = usePatch(`${import.meta.env.VITE_API_URL}/api/savedVehicles/:id`, {
    onSuccess: () => {
      refetchVehicles()
      resetVehicleForm()
      toast.success('Vehicle updated successfully')
    },
    onError: (error) => toast.error(error.message || 'Failed to update vehicle'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/savedVehicles`]],
  })

  const deleteVehicle = useDelete(`${import.meta.env.VITE_API_URL}/api/savedVehicles/:id`, {
    onSuccess: () => {
      refetchVehicles()
      toast.success('Vehicle deleted successfully')
    },
    onError: (error) => toast.error(error.message || 'Failed to delete vehicle'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/savedVehicles`]],
  })

  const updateCustomer = usePatch(`${import.meta.env.VITE_API_URL}/api/customers/:id`, {
    onSuccess: () => toast.success('Customer information updated successfully'),
    onError: (error) => toast.error(error.message || 'Failed to update customer'),
    invalidateQueryKey: [['data', `${import.meta.env.VITE_API_URL}/api/customers/${customerId}`]],
  })

  // ---- Helper functions (non‑hooks) ----
  const resetAddressForm = () => {
    setAddressForm({
      label: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      lat: null,
      lng: null,
      placeId: '',
      isDefault: false,
    })
    setEditingAddressId(null)
  }

  const resetVehicleForm = () => {
    setVehicleForm({ make: '', model: '', color: '', licensePlate: '' })
    setEditingVehicleId(null)
  }

  // ---- Handlers that are not hooks ----
  const handleAddressSubmit = () => {
    if (!addressForm.label || !addressForm.address) {
      toast.error('Label and address are required')
      return
    }
    const payload: any = {
      address: addressForm.address,
      city: addressForm.city,
      country: addressForm.country,
      isDefault: addressForm.isDefault,
      label: addressForm.label,
      lat: addressForm.lat,
      lng: addressForm.lng,
      placeId: addressForm.placeId,
      postalCode: addressForm.postalCode,
      state: addressForm.state,
    }
    if (editingAddressId) {
      updateAddress.mutate({ pathParams: { id: editingAddressId }, ...payload })
    } else {
      createAddress.mutate({ ...payload, customer: { id: customerId } })
    }
  }

  const handleEditAddress = (addr: SavedAddress) => {
    setAddressForm({
      label: addr.label,
      address: addr.address,
      city: addr.city,
      state: addr.state,
      country: addr.country,
      postalCode: addr.postalCode,
      lat: addr.lat,
      lng: addr.lng,
      placeId: addr.placeId,
      isDefault: addr.isDefault,
    })
    setEditingAddressId(addr.id)
    document.getElementById('newAddressForm')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleDeleteAddress = (id: string) => {
    if (confirm('Delete this address?')) deleteAddress.mutate({ pathParams: { id } })
  }

  const handleSetDefaultAddress = (id: string) => {
    setDefaultAddress.mutate({ pathParams: { id } })
  }

  const handleVehicleSubmit = () => {
    if (!vehicleForm.make || !vehicleForm.model || !vehicleForm.color || !vehicleForm.licensePlate) return
    const payload = { ...vehicleForm }
    if (editingVehicleId) {
      updateVehicle.mutate({ pathParams: { id: editingVehicleId }, ...payload })
    } else {
      createVehicle.mutate({ ...payload, customer: { id: customerId } })
    }
  }

  const handleEditVehicle = (v: SavedVehicle) => {
    setVehicleForm({
      make: v.make,
      model: v.model,
      color: v.color,
      licensePlate: v.licensePlate,
    })
    setEditingVehicleId(v.id)
    document.getElementById('newVehicleForm')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleDeleteVehicle = (id: string) => {
    if (confirm('Delete this vehicle?')) deleteVehicle.mutate({ pathParams: { id } })
  }

  const handleSaveContactOnly = () => {
    updateCustomer.mutate({
      pathParams: { id: customerId },
      contactName: contactPerson.name,
      contactEmail: contactPerson.email,
      contactPhone: contactPerson.phone,
    })
  }

  const handleSaveBusinessProfile = () => {
    updateCustomer.mutate({
      pathParams: { id: customerId },
      businessName: businessProfile.name,
      businessWebsite: businessProfile.website,
      businessAddress: businessProfile.address,
      businessPhone: businessProfile.phone,
      businessPlaceId: businessProfile.placeId,
    })
  }

  const handleSaveAll = () => {
    updateCustomer.mutate({
      pathParams: { id: customerId },
      businessName: businessProfile.name,
      businessWebsite: businessProfile.website,
      businessAddress: businessProfile.address,
      businessPhone: businessProfile.phone,
      contactName: contactPerson.name,
      contactEmail: contactPerson.email,
      contactPhone: contactPerson.phone,
      businessPlaceId: businessProfile.placeId,
    })
  }

  const handleResetAll = () => {
    if (confirm('Reset all changes to last saved values?')) {
      if (customer) {
        setBusinessProfile({
          name: customer.businessName || '',
          website: customer.businessWebsite || '',
          address: customer.businessAddress || '',
          phone: customer.businessPhone || '',
          placeId: customer.businessPlaceId || '',
        })
        setContactPerson({
          name: customer.contactName || '',
          email: customer.contactEmail || '',
          phone: customer.contactPhone || '',
        })
      }
      resetAddressForm()
      resetVehicleForm()
      toast.info('All changes reset')
    }
  }

  // ---- useCallback for place selection (must be before early returns) ----
  const handleSavedAddressSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (!place) return
    const comps = extractAddressComponents(place)
    const city = comps.locality || ''
    const state = comps.administrativeAreaLevel1 || ''
    const country = comps.country || ''
    const postalCode = comps.postalCode || ''
    const address = place.formatted_address || (place.name ? `${place.name}, ${city}, ${state}` : '')
    const lat = place.geometry?.location?.lat() || null
    const lng = place.geometry?.location?.lng() || null
    const placeId = place.place_id || ''
    setAddressForm(prev => ({
      ...prev,
      address,
      city,
      state,
      country,
      postalCode,
      lat,
      lng,
      placeId,
    }))
  }, [])

  // ---- Effects (must be after all hooks, but before early returns) ----
  useEffect(() => {
    if (customer) {
      setBusinessProfile({
        name: customer.businessName || '',
        website: customer.businessWebsite || '',
        address: customer.businessAddress || '',
        phone: customer.businessPhone || '',
        placeId: customer.businessPlaceId || '',
      })
      setContactPerson({
        name: customer.contactName || '',
        email: customer.contactEmail || '',
        phone: customer.contactPhone || '',
      })
    }
  }, [customer])

  useEffect(() => {
    if (window.google && window.google.maps) {
      setGoogleMapsLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => setGoogleMapsLoaded(true)
    document.head.appendChild(script)
    return () => {}
  }, [])

  useEffect(() => {
    if (!googleMapsLoaded || !businessNameInputRef.current) return
    businessAutocompleteRef.current = new google.maps.places.Autocomplete(
      businessNameInputRef.current,
      {
        fields: ['name', 'formatted_address', 'place_id', 'geometry', 'website', 'formatted_phone_number', 'address_components'],
        types: ['establishment'],
        componentRestrictions: { country: 'us' },
        bounds: { north: 42.0, south: 32.5, east: -114.0, west: -124.5 },
        strictBounds: false,
      }
    )
    const listener = businessAutocompleteRef.current.addListener('place_changed', () => {
      const place = businessAutocompleteRef.current?.getPlace()
      if (place && place.place_id) {
        setBusinessProfile(prev => ({
          ...prev,
          name: place.name || prev.name,
          address: place.formatted_address || prev.address,
          placeId: place.place_id || prev.placeId,
          phone: place.formatted_phone_number || prev.phone,
          website: place.website || prev.website,
        }))
      }
    })
    return () => {
      if (listener) listener.remove()
      if (businessAutocompleteRef.current) {
        google.maps.event.clearInstanceListeners(businessAutocompleteRef.current)
      }
    }
  }, [googleMapsLoaded])

  // ---- Early returns (after all hooks) ----
  if (!customerId) return <div>No customer found. Please log in.</div>
  if (customerLoading) return <div>Loading customer data...</div>
  if (customerError) return <div>Error loading customer: {customerError.message}</div>

  // ---- Non‑hook handlers that depend on customer ----
  const handleAddressSelect = (place: google.maps.places.PlaceResult) => {
    if (place.formatted_address) {
      setBusinessProfile(prev => ({ ...prev, address: place.formatted_address || '' }))
    }
    if (place.place_id) {
      setBusinessProfile(prev => ({ ...prev, placeId: place.place_id || '' }))
    }
  }

  // ---- Render ----
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header – unchanged except for button click handlers */}
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
                Dealer Portal
              </span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white">
                Dealer Settings
              </span>
            </div>
            <div className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-500/10 text-slate-900 border border-lime-500/25 ml-2">
              <Verified className="h-3 w-3 text-lime-500" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700">
                {customer?.customerType || 'BUSINESS'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dealer-dashboard"
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            {/* <Button
              onClick={handleSaveAll}
              className="hidden sm:inline-flex items-center gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 px-5 py-2.5 rounded-full text-sm font-extrabold hover:shadow-lg hover:shadow-lime-500/20 transition-all"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button> */}
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
            <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
              <Link
                to="/dealer-dashboard"
                className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/dealer-create-delivery"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Delivery
              </Link>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Dealer Settings
              </span>
              <Button
                onClick={() => {
                  handleSaveAll()
                  setMobileMenuOpen(false)
                }}
                className="mt-2 inline-flex items-center justify-center gap-2 bg-lime-500 text-slate-950 px-5 py-3 rounded-2xl text-sm font-extrabold"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        {/* Page header */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                <Verified className="h-3 w-3" />
                {customer?.approvalStatus || 'APPROVED'}
              </Badge>
              {customer?.postpaidEnabled && (
                <Badge variant="secondary" className="gap-1 bg-sky-500/10 text-sky-700 border-sky-500/20">
                  <CreditCard className="h-3 w-3" />
                  Postpaid Enabled
                </Badge>
              )}
              <Badge variant="default" className="gap-1 bg-slate-900 text-white border-slate-900">
                <Settings className="h-3 w-3" />
                Pricing Admin-Controlled
              </Badge>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                Dealer settings
              </h1>
              <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400 max-w-3xl mt-2">
                Manage business profile, contact details, saved pickup addresses, saved vehicles, billing visibility,
                and account preferences from one screen.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* <Button variant="outline" onClick={handleResetAll} className="gap-2 rounded-full">
              <Settings className="h-4 w-4" />
              Reset
            </Button> */}
            <Button onClick={handleSaveAll} className="gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 rounded-full">
              <Save className="h-4 w-4" />
              Save All Changes
            </Button>
          </div>
        </section>

        {/* Main grid */}
        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          {/* Left column – forms */}
          <div className="space-y-6">
            {/* Business profile */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black">Business profile</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Review and update business identity details used across dealer workflows.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={handleSaveBusinessProfile}
                  disabled={updateCustomer.isPending}
                >
                  <Save className="h-4 w-4" />
                  {updateCustomer.isPending ? 'Saving...' : 'Save Section'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Business name</Label>
                    <Input
                      ref={businessNameInputRef}
                      value={businessProfile.name}
                      onChange={(e) => setBusinessProfile(prev => ({ ...prev, name: e.target.value }))}
                      className="h-14 rounded-2xl"
                      placeholder="Start typing business name..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Business website</Label>
                    <Input
                      value={businessProfile.website}
                      onChange={(e) => setBusinessProfile(prev => ({ ...prev, website: e.target.value }))}
                      className="h-14 rounded-2xl"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-xs font-bold">Business address</Label>
                    <LocationAutocomplete
                      value={businessProfile.address}
                      onChange={(value) => setBusinessProfile(prev => ({ ...prev, address: value }))}
                      onPlaceSelect={handleAddressSelect}
                      placeholder="Start typing address..."
                      isLoaded={googleMapsLoaded}
                      icon={<MapPin className="h-4 w-4 text-slate-400" />}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Business phone</Label>
                    <Input
                      value={businessProfile.phone}
                      onChange={(e) => setBusinessProfile(prev => ({ ...prev, phone: e.target.value }))}
                      className="h-14 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Directory place ID</Label>
                    <Input
                      value={businessProfile.placeId}
                      readOnly
                      className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact person */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow">
              <CardHeader className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black">Contact person</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Used for delivery booking, tracking, completion emails, and billing communication.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={handleSaveContactOnly}
                  disabled={updateCustomer.isPending}
                >
                  <Save className="h-4 w-4" />
                  {updateCustomer.isPending ? 'Saving...' : 'Save Section'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Contact name</Label>
                    <Input
                      value={contactPerson.name}
                      onChange={(e) => setContactPerson(prev => ({ ...prev, name: e.target.value }))}
                      className="h-14 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Contact email</Label>
                    <Input
                      type="email"
                      value={contactPerson.email}
                      onChange={(e) => setContactPerson(prev => ({ ...prev, email: e.target.value }))}
                      className="h-14 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Contact phone</Label>
                    <Input
                      value={contactPerson.phone}
                      onChange={(e) => setContactPerson(prev => ({ ...prev, phone: e.target.value }))}
                      className="h-14 rounded-2xl"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Saved pickup addresses */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black">Saved pickup addresses</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Create, edit, delete, and set the default pickup/origin address used in delivery creation.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    resetAddressForm()
                    document.getElementById('newAddressForm')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 rounded-full"
                >
                  <Plus className="h-4 w-4" />
                  Add Pickup Address
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {addressesLoading && <p>Loading addresses...</p>}
                {!addressesLoading && addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-black text-slate-900 dark:text-white">{addr.label}</span>
                          {addr.isDefault && (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">{addr.address}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {addr.city && addr.state ? (
                            <>
                              {addr.city}, {addr.state} {addr.postalCode}
                              <span className="mx-1">•</span>
                            </>
                          ) : null}
                          Saved {new Date(addr.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-full"
                          onClick={() => handleEditAddress(addr)}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        {/* {!addr.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-full"
                            onClick={() => handleSetDefaultAddress(addr.id)}
                            disabled={setDefaultAddress.isPending}
                          >
                            <Star className="h-4 w-4" />
                            Set Default
                          </Button>
                        )} */}
                      <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2 rounded-full"
                      onClick={() => openDeleteAddressDialog(addr.id)}
                      disabled={deleteAddress.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add/Edit address form */}
                <div
                  id="newAddressForm"
                  className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 mt-4"
                >
                  <div className="mb-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Info className="h-3 w-3" />
                    Tip: Select an address from the dropdown to automatically fill city, state, country, postal code, and coordinates.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Label *</Label>
                      <Input
                        placeholder="e.g. Downtown Storage"
                        value={addressForm.label}
                        onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Place ID</Label>
                      <Input
                        value={addressForm.placeId}
                        readOnly
                        className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-bold">Address *</Label>
                      <LocationAutocomplete
                        value={addressForm.address}
                        onChange={(value) => setAddressForm({ ...addressForm, address: value })}
                        onPlaceSelect={handleSavedAddressSelect}
                        placeholder="Start typing and select an address"
                        isLoaded={googleMapsLoaded}
                        icon={<MapPin className="h-4 w-4 text-slate-400" />}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">City</Label>
                      <Input
                        value={addressForm.city}
                        readOnly
                        className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">State</Label>
                      <Input
                        value={addressForm.state}
                        readOnly
                        className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Country</Label>
                      <Input
                        value={addressForm.country}
                        readOnly
                        className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Postal Code</Label>
                      <Input
                        value={addressForm.postalCode}
                        onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Latitude</Label>
                      <Input
                        value={addressForm.lat?.toString() || ''}
                        readOnly
                        className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Longitude</Label>
                      <Input
                        value={addressForm.lng?.toString() || ''}
                        readOnly
                        className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/20"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-3">
                      <Checkbox
                        id="isDefaultAddress"
                        checked={addressForm.isDefault}
                        onCheckedChange={(checked) => setAddressForm({ ...addressForm, isDefault: checked as boolean })}
                      />
                      <Label htmlFor="isDefaultAddress" className="text-xs font-bold cursor-pointer">
                        Set as default pickup address
                      </Label>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={handleAddressSubmit}
                      className="gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 rounded-full"
                      disabled={createAddress.isPending || updateAddress.isPending}
                    >
                      <Save className="h-4 w-4" />
                      {editingAddressId ? 'Update Address' : 'Create Address'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetAddressForm}
                      className="rounded-full"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Saved vehicles */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black">Saved vehicles</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Keep reusable vehicle profiles for faster delivery creation and repeat requests.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    resetVehicleForm()
                    document.getElementById('newVehicleForm')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 rounded-full"
                >
                  <Plus className="h-4 w-4" />
                  Add Vehicle
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {vehiclesLoading && <p>Loading vehicles...</p>}
                {!vehiclesLoading && vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          {vehicle.make} {vehicle.model} • {vehicle.color}
                        </span>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Plate: {vehicle.licensePlate}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 rounded-full"
                          onClick={() => handleEditVehicle(vehicle)}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2 rounded-full"
                        onClick={() => openDeleteVehicleDialog(vehicle.id)}
                        disabled={deleteVehicle.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add/Edit vehicle form */}
                <div
                  id="newVehicleForm"
                  className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 mt-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Make</Label>
                      <Input
                        placeholder="Honda"
                        value={vehicleForm.make}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Model</Label>
                      <Input
                        placeholder="Civic"
                        value={vehicleForm.model}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Color</Label>
                      <Input
                        placeholder="Black"
                        value={vehicleForm.color}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">License plate</Label>
                      <Input
                        placeholder="7ABC123"
                        value={vehicleForm.licensePlate}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={handleVehicleSubmit}
                      className="gap-2 bg-lime-500 text-slate-950 hover:bg-lime-600 rounded-full"
                      disabled={createVehicle.isPending || updateVehicle.isPending}
                    >
                      <Save className="h-4 w-4" />
                      {editingVehicleId ? 'Update Vehicle' : 'Create Vehicle'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetVehicleForm}
                      className="rounded-full"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar – summary cards (unchanged) */}
          <aside className="space-y-6 xl:sticky xl:top-28">
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-xl font-black">Account summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Customer type</span>
                  <span className="font-black text-slate-900 dark:text-white">{customer?.customerType}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Approval status</span>
                  <span className="font-black text-emerald-600">{customer?.approvalStatus}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">User account</span>
                  <span className="font-black text-slate-900 dark:text-white">Active</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Email verified</span>
                  <span className="font-black text-slate-900 dark:text-white">Yes</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 dark:text-slate-400">Postpaid enabled</span>
                  <span className="font-black text-sky-600">{customer?.postpaidEnabled ? 'Yes' : 'No'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-xl font-black">Billing & pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Assigned pricing config
                  </div>
                  <div className="font-black text-slate-900 dark:text-white mt-2">Bay Auto Sales Preferred</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">Mode override: CATEGORY_ABC</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Payment visibility
                  </div>
                  <div className="font-black text-slate-900 dark:text-white mt-2">Prepaid + Postpaid available</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    Pricing and billing policy are managed by Admin.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-xl font-black">Notification summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Primary email</div>
                  <div className="font-black text-slate-900 dark:text-white mt-2 break-all">
                    {contactPerson.email}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Primary phone</div>
                  <div className="font-black text-slate-900 dark:text-white mt-2">{contactPerson.phone}</div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Delivery milestones are email-first. SMS may be enabled later by Admin policy.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-xl font-black">Need help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Contact support for pricing changes, directory corrections, approval questions, or account issues.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <Button variant="outline" className="justify-center gap-2 rounded-full">
                    <HelpCircle className="h-4 w-4" />
                    Contact Support
                  </Button>
                  <Button variant="outline" className="justify-center gap-2 rounded-full">
                    <Mail className="h-4 w-4" />
                    Email Operations
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10 mt-12">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers logo" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Dealer settings • CRUD-ready • Amplication-friendly
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">© 2024 101 Drivers Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the {deleteItemType === 'address' ? 'address' : 'vehicle'}.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
    </div>
  )
}