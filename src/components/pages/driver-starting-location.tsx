import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useJsApiLoader } from '@react-google-maps/api'
import { ArrowLeft, MapPin, Navigation, ArrowRight, Clock, DollarSign, Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import RouteMap from '@/components/map/RouteMap'
import LocationAutocomplete from '@/components/map/LocationAutocomplete'
import { useDataQuery } from '@/lib/tanstack/dataQuery'

// ── Dummy gig data (driver not logged in yet) ──────────────────────────
const dummyGigs = [
  {
    id: '1',
    pickup: 'Santa Monica BMW',
    pickupAddress: '1501 Santa Monica Blvd, Santa Monica, CA',
    dropoff: 'LAX Terminal 4',
    distanceMiles: 8.2,
    payout: 45,
    estimatedTime: '35 min',
  },
  {
    id: '2',
    pickup: 'Venice Honda',
    pickupAddress: '1033 Venice Blvd, Venice, CA',
    dropoff: 'Marina del Rey',
    distanceMiles: 4.1,
    payout: 32,
    estimatedTime: '20 min',
  },
  {
    id: '3',
    pickup: 'Culver City Toyota',
    pickupAddress: '6000 Sepulveda Blvd, Culver City, CA',
    dropoff: 'Playa Vista',
    distanceMiles: 5.7,
    payout: 38,
    estimatedTime: '28 min',
  },
]

// ── Haversine distance helper (miles) ──────────────────────────────────
function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function DriverStartingLocationPage() {
  const navigate = useNavigate()

  // ── Google Maps loader ───────────────────────────────────────────────
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-starting-location',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places'],
  })

  // ── Fetch service district zones ─────────────────────────────────────
  const { data: zonesData } = useDataQuery<any[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/public/serviceDistricts`,
    noFilter: true,
    fetchWithoutRefresh: true,
  })

  // Normalise zones — handle both array and paginated response
  const zones: any[] = React.useMemo(() => {
    if (!zonesData) return []
    const data = zonesData as any
    if (Array.isArray(data)) return data
    return data?.data ?? data?.items ?? []
  }, [zonesData])

  // ── GPS / location state ────────────────────────────────────────────
  const [gpsEnabled, setGpsEnabled] = useState(true)
  const [driverPosition, setDriverPosition] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [addressInput, setAddressInput] = useState('')
  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null)
  const [gpsFetching, setGpsFetching] = useState(false)

  // Try to get GPS position on mount (when enabled)
  useEffect(() => {
    if (!gpsEnabled) {
      setDriverPosition(null)
      return
    }

    setGpsFetching(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsFetching(false)
      },
      () => {
        // GPS denied or unavailable — silently fall back
        setGpsFetching(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }, [gpsEnabled])

  // ── Address autocomplete handler ────────────────────────────────────
  const handlePlaceSelect = useCallback(
    (place: google.maps.places.PlaceResult) => {
      setSelectedPlace(place)
      if (place.geometry?.location) {
        setDriverPosition({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        })
      }
    },
    [],
  )

  const handleAddressClear = useCallback(() => {
    setAddressInput('')
    setSelectedPlace(null)
    if (!gpsEnabled) {
      setDriverPosition(null)
    }
  }, [gpsEnabled])

  // ── Recalc distances when driverPosition changes ────────────────────
  const gigsWithDistance = React.useMemo(() => {
    if (!driverPosition) return dummyGigs
    return dummyGigs.map((gig) => {
      // Use approximate pickup coords for distance calc (dummy lat/lng)
      const pickupCoords: Record<string, { lat: number; lng: number }> = {
        '1': { lat: 34.0195, lng: -118.4912 }, // Santa Monica
        '2': { lat: 33.985, lng: -118.4695 },  // Venice
        '3': { lat: 34.023, lng: -118.3965 },  // Culver City
      }
      const coord = pickupCoords[gig.id]
      if (!coord) return gig
      return {
        ...gig,
        distanceMiles: parseFloat(
          haversineMiles(driverPosition.lat, driverPosition.lng, coord.lat, coord.lng).toFixed(1),
        ),
      }
    })
  }, [driverPosition])

  // ── Navigation handlers ─────────────────────────────────────────────
  const handleContinue = () => {
    const locationData: { lat?: number; lng?: number; address?: string } = {}
    if (driverPosition) {
      locationData.lat = driverPosition.lat
      locationData.lng = driverPosition.lng
    }
    if (addressInput) {
      locationData.address = addressInput
    }
    if (selectedPlace?.formatted_address) {
      locationData.address = selectedPlace.formatted_address
    }
    localStorage.setItem('driverStartingLocation', JSON.stringify(locationData))
    navigate({ to: '/driver-proof-cam' })
  }

  const handleSkip = () => {
    navigate({ to: '/driver-proof-cam' })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-white flex flex-col">
      {/* ── Back link ─────────────────────────────────────────────────── */}
      <div className="p-6 pb-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-lime-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-48">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Title */}
          <div className="pt-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-snug">
              Your Starting Location
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              See real jobs near you. Skip if you prefer.
            </p>
          </div>

          {/* ── Map Section ───────────────────────────────────────────── */}
          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900" style={{ height: '55vh', minHeight: 320 }}>
            <RouteMap
              isLoaded={isLoaded}
              zones={zones}
              driverPosition={driverPosition}
              fitZonesBounds={true}
            />
            {/* GPS fetching overlay */}
            {gpsFetching && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-slate-950/40 pointer-events-none">
                <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 shadow-lg flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-lime-500 border-t-transparent" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Locating you...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Your Location (optional) ──────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Your Location (optional)
              </h2>
              {/* GPS Toggle */}
              <button
                type="button"
                onClick={() => setGpsEnabled(!gpsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 ${
                  gpsEnabled
                    ? 'bg-lime-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
                aria-pressed={gpsEnabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    gpsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {gpsEnabled
                ? 'Auto-detecting from phone GPS...'
                : 'Enter address or ZIP code below.'}
            </p>

            {!gpsEnabled && (
              <LocationAutocomplete
                value={addressInput}
                onChange={setAddressInput}
                onPlaceSelect={handlePlaceSelect}
                onClear={handleAddressClear}
                placeholder="Enter address or ZIP"
                isLoaded={isLoaded}
                icon={
                  <MapPin className="w-4 h-4 text-slate-400" />
                }
                label="Starting address"
              />
            )}

            {gpsEnabled && driverPosition && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-lime-50 dark:bg-lime-900/10 border border-lime-200 dark:border-lime-900/30">
                <Navigation className="w-4 h-4 text-lime-600 dark:text-lime-400 flex-shrink-0" />
                <span className="text-xs font-medium text-lime-700 dark:text-lime-300">
                  GPS location detected
                </span>
              </div>
            )}
          </div>

          {/* ── Current Available Gigs (preview) ─────────────────────── */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Current Available Gigs
              <span className="ml-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 normal-case tracking-normal">
                (preview)
              </span>
            </h2>

            {gigsWithDistance.length > 0 ? (
              <div className="space-y-3">
                {gigsWithDistance.map((gig) => (
                  <GigPreviewCard key={gig.id} gig={gig} />
                ))}

                <Button
                  variant="outline"
                  className="w-full rounded-2xl h-11 text-sm font-bold text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                  onClick={() =>
                    toast.info('Finish signup to claim this job!', {
                      description: 'Complete your profile to access all available gigs.',
                    })
                  }
                >
                  See All Available Gigs
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
                No jobs yet — zone's active, refresh soon.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Fixed bottom with gradient fade ──────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 pt-10 pb-6 px-6 safe-bottom z-20">
        <div className="max-w-lg mx-auto space-y-3">
          <Button
            onClick={handleContinue}
            className="w-full py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition h-14 text-base font-black"
          >
            Continue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            onClick={handleSkip}
            className="w-full py-3 rounded-2xl h-12 text-sm font-bold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Gig Preview Card Sub-component ─────────────────────────────────────
function GigPreviewCard({
  gig,
}: {
  gig: {
    id: string
    pickup: string
    pickupAddress: string
    dropoff: string
    distanceMiles: number
    payout: number
    estimatedTime: string
  }
}) {
  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Pickup → Dropoff */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <Car className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {gig.pickup}
              </p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(gig.pickupAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                {gig.pickupAddress}
              </a>
            </div>
          </div>

          <div className="pl-3.5 ml-3 border-l-2 border-dashed border-slate-200 dark:border-slate-700 py-0.5">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 -rotate-90" />
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 pt-0.5">
              {gig.dropoff}
            </p>
          </div>
        </div>

        {/* Meta row: distance + payout + time */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {/* Distance */}
            <div className="flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {gig.distanceMiles} mi from you
              </span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                est. {gig.estimatedTime}
              </span>
            </div>
          </div>

          {/* Payout */}
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-base font-black text-green-600 dark:text-green-400">
              {gig.payout}
            </span>
          </div>
        </div>

        {/* View Details button */}
        <Button
          size="sm"
          className="w-full rounded-xl h-10 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-600 dark:hover:bg-teal-500"
          onClick={() =>
            toast.info('Finish signup to claim this job!', {
              description: 'Complete your profile to access all available gigs.',
            })
          }
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  )
}
