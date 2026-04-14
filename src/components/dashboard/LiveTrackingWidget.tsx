// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import {
  Navigation,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  User,
  Car,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import { toast } from 'sonner'

// Mini map component for live tracking
function MiniMap({ 
  pickup, 
  dropoff, 
  driverPosition, 
  isLoaded 
}: { 
  pickup: google.maps.LatLngLiteral | null
  dropoff: google.maps.LatLngLiteral | null
  driverPosition: google.maps.LatLngLiteral | null
  isLoaded: boolean
}) {
  const mapRef = React.useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [markers, setMarkers] = useState<{
    pickup?: google.maps.Marker
    dropoff?: google.maps.Marker
    driver?: google.maps.Marker
  }>({})

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return

    const bounds = new google.maps.LatLngBounds()
    if (pickup) bounds.extend(pickup)
    if (dropoff) bounds.extend(dropoff)

    const newMap = new google.maps.Map(mapRef.current, {
      center: bounds.getCenter(),
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    })

    newMap.fitBounds(bounds, { padding: 50 })
    setMap(newMap)

    return () => {
      if (newMap) {
        google.maps.event.clearInstanceListeners(newMap)
      }
    }
  }, [isLoaded, pickup, dropoff])

  // Update markers
  useEffect(() => {
    if (!map) return

    // Clear old markers
    Object.values(markers).forEach(marker => marker?.setMap(null))

    const newMarkers: typeof markers = {}

    // Pickup marker
    if (pickup) {
      newMarkers.pickup = new google.maps.Marker({
        position: pickup,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Pickup',
      })
    }

    // Dropoff marker
    if (dropoff) {
      newMarkers.dropoff = new google.maps.Marker({
        position: dropoff,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Drop-off',
      })
    }

    // Driver marker (animated)
    if (driverPosition) {
      newMarkers.driver = new google.maps.Marker({
        position: driverPosition,
        map,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: '#a3e635',
          fillOpacity: 1,
          strokeColor: '#365314',
          strokeWeight: 2,
        },
        title: 'Driver',
      })

      // Center map on driver
      map.panTo(driverPosition)
    }

    setMarkers(newMarkers)

    return () => {
      Object.values(newMarkers).forEach(marker => marker?.setMap(null))
    }
  }, [map, pickup, dropoff, driverPosition])

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full min-h-[200px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800"
    />
  )
}

// Format relative time
function getRelativeTime(dateString?: string): string {
  if (!dateString) return 'No data'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffSeconds < 60) return 'Just now'
  if (diffSeconds < 120) return '1 min ago'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

interface LiveTrackingWidgetProps {
  deliveryId: string
  deliveryRef: string
  vehicle?: {
    make?: string
    model?: string
    color?: string
    licensePlate?: string
  }
  pickup?: {
    address: string
    lat?: number
    lng?: number
  }
  dropoff?: {
    address: string
    lat?: number
    lng?: number
  }
  driver?: {
    name: string
    phone?: string
    rating?: number
  }
}

export default function LiveTrackingWidget({
  deliveryId,
  deliveryRef,
  vehicle,
  pickup,
  dropoff,
  driver,
}: LiveTrackingWidgetProps) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(true)
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null)
  const [driverPosition, setDriverPosition] = useState<google.maps.LatLngLiteral | null>(null)
  const [isDataStale, setIsDataStale] = useState(false)

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Fetch tracking link to get token
  const { data: trackingLink } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}/tracking-link`,
    enabled: !!deliveryId,
    noFilter: true,
  })

  const token = trackingLink?.token

  // Fetch public tracking data using token (poll every 5 seconds)
  const { 
    data: trackingData, 
    refetch,
    isFetching 
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/public/tracking/${token}`,
    enabled: !!token,
    noFilter: true,
    refetchInterval: 5000, // Poll every 5 seconds
  })

  // Update coordinates when tracking data arrives
  useEffect(() => {
    // Use delivery coords if available, otherwise from tracking data
    if (pickup?.lat && pickup?.lng) {
      setPickupCoords({ lat: pickup.lat, lng: pickup.lng })
    } else if (trackingData?.pickup) {
      setPickupCoords({ lat: trackingData.pickup.lat, lng: trackingData.pickup.lng })
    }

    if (dropoff?.lat && dropoff?.lng) {
      setDropoffCoords({ lat: dropoff.lat, lng: dropoff.lng })
    } else if (trackingData?.dropoff) {
      setDropoffCoords({ lat: trackingData.dropoff.lat, lng: trackingData.dropoff.lng })
    }

    if (trackingData?.trackingSession?.latestPoint) {
      const point = trackingData.trackingSession.latestPoint
      setDriverPosition({ lat: point.lat, lng: point.lng })
      
      // Check if data is stale (older than 2 minutes)
      const lastUpdate = new Date(point.recordedAt).getTime()
      const now = Date.now()
      setIsDataStale((now - lastUpdate) > 2 * 60 * 1000)
    }
  }, [trackingData, pickup, dropoff])

  // Get last update text
  const lastUpdateText = getRelativeTime(trackingData?.trackingSession?.latestPoint?.recordedAt)

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await refetch()
      toast.success('Location updated')
    } catch (error) {
      toast.error('Failed to refresh')
    }
  }, [refetch])

  // Get driver info from tracking data or props
  const driverInfo = trackingData?.driver || driver
  const vehicleInfo = trackingData?.vehicle || vehicle

  return (
    <Card className="border-lime-300 dark:border-lime-700 bg-gradient-to-br from-lime-50/50 to-white dark:from-lime-950/20 dark:to-slate-950 rounded-3xl overflow-hidden">
      {/* Header - Always visible */}
      <CardHeader 
        className="cursor-pointer hover:bg-lime-100/50 dark:hover:bg-lime-900/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500 flex items-center justify-center animate-pulse">
              <Navigation className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <CardTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Live Tracking
                <Badge className="bg-lime-500 text-slate-900 text-[10px] font-black uppercase tracking-widest animate-pulse">
                  Active
                </Badge>
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Delivery #{deliveryRef} • {vehicleInfo?.make} {vehicleInfo?.model}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className={cn(
              "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold",
              isDataStale 
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
            )}>
              {isDataStale ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
              {lastUpdateText}
            </div>
            
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Expandable content */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Mini Map */}
            <div className="lg:col-span-7">
              <div className="relative h-[220px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                {isLoaded ? (
                  <MiniMap
                    pickup={pickupCoords}
                    dropoff={dropoffCoords}
                    driverPosition={driverPosition}
                    isLoaded={isLoaded}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500" />
                  </div>
                )}
                
                {/* Map overlay */}
                <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Pickup
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Drop-off
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-lime-400" />
                    Driver
                  </div>
                </div>
              </div>
            </div>

            {/* Info Panel */}
            <div className="lg:col-span-5 space-y-4">
              {/* Driver Info */}
              {driverInfo && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="w-10 h-10 rounded-full bg-lime-500/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-lime-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {driverInfo.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {driverInfo.rating ? `${driverInfo.rating} ★` : 'Driver'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {driverInfo.phone && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-full hover:bg-lime-100 dark:hover:bg-lime-900/30"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`tel:${driverInfo.phone}`, '_self')
                          }}
                        >
                          <Phone className="h-4 w-4 text-lime-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-full hover:bg-lime-100 dark:hover:bg-lime-900/30"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`sms:${driverInfo.phone}`, '_self')
                          }}
                        >
                          <MessageCircle className="h-4 w-4 text-lime-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Vehicle Info */}
              {vehicleInfo && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Car className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {vehicleInfo.color} {vehicleInfo.make} {vehicleInfo.model}
                    </div>
                    <div className="text-xs text-slate-500">
                      {vehicleInfo.licensePlate || 'No plate'}
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile status indicator */}
              <div className="sm:hidden flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className={cn(
                  "flex items-center gap-2 text-xs font-bold",
                  isDataStale ? "text-amber-600" : "text-green-600"
                )}>
                  {isDataStale ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                  {lastUpdateText}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 rounded-xl"
                  onClick={handleRefresh}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-2 bg-lime-500 text-slate-900 hover:bg-lime-600 rounded-xl"
                  onClick={() => navigate({ to: `/live-track?deliveryId=${deliveryId}` })}
                >
                  <ExternalLink className="h-4 w-4" />
                  Full Map
                </Button>
              </div>

              {/* Route summary */}
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-green-500" />
                  <span className="truncate">{pickup?.address || 'Pickup location'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-red-500" />
                  <span className="truncate">{dropoff?.address || 'Drop-off location'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
