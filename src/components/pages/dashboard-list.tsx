// app/pages/driver/dashboard-list.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import { toast } from 'sonner'
import {
  Home,
  LogOut,
  Sun,
  Moon,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Bell,
  Inbox,
  Menu,
  X,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  User,
  Settings,
  Sliders,
  SlidersHorizontal as Tune,
  Route,
  Map,
  Navigation,
  Compass,
  Car,
  Fuel,
  Gauge,
  Bolt,
  Bolt as BoltIcon,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  TriangleAlert as Warning,
  Verified,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Phone,
  Mail,
  MessageSquare,
  CalendarDays,
  Timer,
  Award,
  Star,
  CreditCard,
  DollarSign as DollarSignIcon,
  Receipt,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MoreVertical,
  List,
  Briefcase,
  Funnel,
  LocateFixed,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getUser, useDataQuery, clearAuth, stopSessionKeepAlive } from '@/lib/tanstack/dataQuery'
import { useSocketEvent, useSocketConnected } from '@/hooks/useSocket'
import { socketJoinDriverFeed, socketLeaveDriverFeed } from '@/lib/socket'
import { useQueryClient } from '@tanstack/react-query'
import MiniRouteMap from '@/components/map/MiniRouteMap'
import type { NotificationInboxResponse } from '@/types/notification'
import DriverBottomNav from '../layout/DriverBottomNav'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import { BUSINESS_TZ } from '@/lib/timezone'

// ── Filter options matching backend API ──────────────────────────
const FILTER_OPTIONS = {
  radiusOptions: [
    { value: 'ANY', label: 'Any' },
    { value: '10', label: 'Within 10 miles' },
    { value: '25', label: 'Within 25 miles' },
  ],
  datePresetOptions: [
    { value: 'ALL', label: 'Any' },
    { value: 'TODAY', label: 'Today' },
    { value: 'TOMORROW', label: 'Tomorrow' },
    { value: 'THIS_WEEK', label: 'This Week' },
  ],
  sortOptions: [
    { value: 'ANY', label: 'Any' },
    { value: 'SOONEST', label: 'Earliest' },
    { value: 'NEAREST', label: 'Nearest' },
    { value: 'HIGHEST_PAY', label: 'Highest Pay' },
  ],
}

// ── Helper functions ──────────────────────────────────────────────
const formatDate = (isoString?: string): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TZ })
}

const formatFullWeekdayDate = (isoString?: string): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: BUSINESS_TZ,
  })
}

const formatTimeRange = (startIso?: string, endIso?: string): string => {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ })
  return `${startStr} - ${endStr}`
}

const formatDuration = (minutes?: number): string => {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const formatCurrency = (amount?: number | null): string => {
  if (amount == null) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const extractRouteLabel = (fullAddress: string): string => {
  if (!fullAddress) return ''
  const trimmed = fullAddress.trim()

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean)

    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i]
      if (/^\d+$/.test(seg)) continue
      if (/^[A-Z]{2}$/.test(seg)) continue
      if (/^(USA|United States)$/i.test(seg)) continue
      if (/^\d/.test(seg)) continue
      const clean = seg.replace(/\s+\d{5}(-\d{4})?$/, '').trim()
      if (clean.length >= 3) return clean
    }

    const street = parts[0].replace(/^\d+\s+/, '').replace(/\s+(Blvd|Ave|Avenue|Street|St|Drive|Dr|Road|Rd|Lane|Ln|Way|Ct|Court|Pl|Place|Pkwy|Parkway)$/i, '').trim()
    if (street.length >= 3) return street
  }

  const match = trimmed.match(/^\d+\s+(.+)$/)
  return match ? match[1].trim() : trimmed
}

const serviceTypeLabels: Record<string, string> = {
  HOME_DELIVERY: 'Car Transfer',
  BETWEEN_LOCATIONS: 'Car Transfer',
  SERVICE_PICKUP_RETURN: 'Car Transfer',
}

// Mock pickup locations for jobs without coordinates
const mockPickupLocations = [
  { lat: 33.94, lng: -118.40 },
  { lat: 34.05, lng: -118.25 },
  { lat: 34.15, lng: -118.15 },
  { lat: 33.87, lng: -118.36 },
  { lat: 34.02, lng: -118.45 },
  { lat: 33.98, lng: -118.22 },
  { lat: 34.06, lng: -118.30 },
  { lat: 33.92, lng: -118.20 },
  { lat: 34.08, lng: -118.38 },
  { lat: 33.96, lng: -118.48 },
  { lat: 34.18, lng: -118.30 },
  { lat: 33.83, lng: -118.30 },
]

// Job type
interface JobItem {
  id: string
  urgent: boolean
  type: string
  date: string
  timeWindow: string
  pickup: string
  dropoff: string
  service: string
  miles: number | null
  duration: string
  payout: number | null
  bonus: number | null
  requirements?: { icon: any; label: string }[]
  pickupAddressFull?: string
  dropoffAddressFull?: string
  pickupWindowStartFull?: string
  pickupWindowEndFull?: string
  etaMinutes?: number
  isUrgent?: boolean
  lat: number
  lng: number
  dropoffLat: number | null
  dropoffLng: number | null
  stackingBlocked: string | null
  stackingDetails: {
    checkType: 'backward' | 'forward' | 'radius' | null;
    isCrossDay: boolean;
    conflictingDelivery: {
      id: string;
      pickupAddress: string;
      dropoffAddress: string;
      pickupWindowStart: string | null;
      estimatedFinishTime: string | null;
      etaMinutes: number | null;
    } | null;
    transit: {
      driveMinutes: number;
      driveMiles: number;
      bufferMinutes: number;
      totalNeededMinutes: number;
      availableMinutes: number;
    } | null;
  } | null;
  outsidePreferredRadius: boolean
}

// ── Reusable Route Thumbnail SVG ──────────────────────────────────
function RouteThumbnail() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" className="shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
      <line x1="20" y1="0" x2="20" y2="100" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="40" y1="0" x2="40" y2="100" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="60" y1="0" x2="60" y2="100" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="80" y1="0" x2="80" y2="100" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="0" y1="20" x2="100" y2="20" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="0" y1="40" x2="100" y2="40" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="0" y1="60" x2="100" y2="60" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="0" y1="80" x2="100" y2="80" stroke="#e2e8f0" strokeWidth="0.5" />
      <path d="M20 80 C20 80, 30 55, 48 43 C65 30, 78 20, 80 20" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="80" r="5" fill="#22c55e" />
      <circle cx="20" cy="80" r="2.5" fill="white" />
      <circle cx="80" cy="20" r="5" fill="#22c55e" />
      <circle cx="80" cy="20" r="2.5" fill="white" />
    </svg>
  )
}

// ── Gig Card Component ────────────────────────────────────────────
function GigCard({ job, onClick, isMapsLoaded }: { job: JobItem; onClick: () => void; isMapsLoaded: boolean }) {
  const hasDropoffCoords = job.dropoffLat != null && job.dropoffLng != null
  const isBlocked = !!job.stackingBlocked
  const isOutsideRadius = !!job.outsidePreferredRadius
  const [showBlockedDialog, setShowBlockedDialog] = useState(false)

  // Friendly explanation for the driver based on the backend reason
  const blockedExplanation = (() => {
    const reason = job.stackingBlocked || ''
    const details = job.stackingDetails

    // If we have structured details, build a rich breakdown
    if (details && details.transit) {
      if (details.checkType === 'backward') {
        const conf = details.conflictingDelivery
        const estFinish = conf?.estimatedFinishTime
          ? new Date(conf.estimatedFinishTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ })
          : 'unknown'
        const confRoute = conf
          ? `${extractRouteLabel(conf.pickupAddress)} → ${extractRouteLabel(conf.dropoffAddress)}`
          : 'Your previous delivery'
        const parts = [
          `You have a delivery that conflicts with this one:`,
          confRoute,
          `Estimated finish time: ${estFinish}`,
          conf?.etaMinutes ? `Estimated drive time of that delivery: ${formatDuration(conf.etaMinutes)}` : null,
          `Drive time from that dropoff to this pickup: ~${details.transit.driveMinutes} min (${details.transit.driveMiles} mi)`,
          details.transit.bufferMinutes > 0 ? `Buffer time between deliveries: ${details.transit.bufferMinutes} min` : null,
          `Total time needed: ${details.transit.totalNeededMinutes} min`,
          `Available before this pickup window closes: ${details.transit.availableMinutes} min`,
        ].filter(Boolean)
        return {
          title: "Schedule Overlap",
          body: parts.join('\n'),
        }
      }
      if (details.checkType === 'forward') {
        const conf = details.conflictingDelivery
        const confPickup = conf?.pickupWindowStart
          ? new Date(conf.pickupWindowStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ })
          : 'unknown'
        const confRoute = conf
          ? `${extractRouteLabel(conf.pickupAddress)} → ${extractRouteLabel(conf.dropoffAddress)}`
          : 'Your next delivery'
        const parts = [
          `If you accept this delivery, you'd arrive late for another gig you already booked:`,
          confRoute,
          `That delivery's pickup time: ${confPickup}`,
          conf?.etaMinutes ? `Estimated drive time of that delivery: ${formatDuration(conf.etaMinutes)}` : null,
          `Drive time from this dropoff to that pickup: ~${details.transit.driveMinutes} min (${details.transit.driveMiles} mi)`,
          details.transit.bufferMinutes > 0 ? `Buffer time between deliveries: ${details.transit.bufferMinutes} min` : null,
          `Total time needed: ${details.transit.totalNeededMinutes} min`,
          `Available before that pickup: ${details.transit.availableMinutes} min`,
        ].filter(Boolean)
        return {
          title: "Would Make You Late",
          body: parts.join('\n'),
        }
      }
      if (details.checkType === 'radius') {
        const conf = details.conflictingDelivery
        const confRoute = conf
          ? `${extractRouteLabel(conf.pickupAddress)} → ${extractRouteLabel(conf.dropoffAddress)}`
          : 'Your last delivery'
        const parts = [
          `The pickup location for this delivery is too far from where your last delivery ends.`,
          confRoute,
          `Distance from last dropoff to this pickup: ~${details.transit.driveMiles} miles`,
          `Maximum allowed distance: 20 miles`,
          `This limit ensures you can reliably reach each pickup on time.`,
        ].filter(Boolean)
        return {
          title: "Too Far From Last Drop-off",
          body: parts.join('\n'),
        }
      }
    }

    // Fallback to generic text pattern matching
    if (reason.includes("Not enough time after your previous delivery") || reason.includes("after your delivery at")) {
      return {
        title: "Schedule Overlap",
        body: "This delivery overlaps with another one you already have booked. You won\u2019t have enough time to finish your current delivery and get to this pickup on time. Complete your active delivery first, then check back \u2014 this gig may become available.",
      }
    }
    if (reason.includes("would make you late for your next booking")) {
      return {
        title: "Would Make You Late",
        body: "If you accept this delivery, you\u2019d arrive late for another gig you already accepted. You can only accept deliveries that fit your schedule without making you late for your existing bookings.",
      }
    }
    if (reason.includes("too far from your last drop-off") || reason.includes("Pickup is too far")) {
      return {
        title: "Too Far From Last Drop-off",
        body: "The pickup location for this delivery is too far from where your last delivery ends. Our system limits the distance between consecutive deliveries so you can reliably make it on time.",
      }
    }
    return {
      title: "Schedule Conflict",
      body: "This delivery conflicts with your current schedule. You may have another delivery that overlaps with this time window. Try again after completing your current deliveries.",
    }
  })()

  return (
    <>
      <Card
        className={cn(
          "border-slate-200/70 dark:border-slate-700/50 shadow-md hover:shadow-lg hover:border-slate-300/80 dark:hover:border-slate-600/60 active:scale-[0.98] transition-all duration-150 rounded-2xl overflow-hidden",
          isBlocked ? "opacity-70" : "cursor-pointer",
          isOutsideRadius && !isBlocked ? "cursor-pointer" : ""
        )}
        onClick={isBlocked ? () => setShowBlockedDialog(true) : (isOutsideRadius ? () => setShowBlockedDialog(true) : onClick)}
      >
        <CardContent className="px-4 py-3">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="text-[12px] font-medium text-slate-400 dark:text-slate-500 leading-tight">
                {formatFullWeekdayDate(job.pickupWindowStartFull) || job.date}
                {job.timeWindow && (
                  <>
                    <span className="mx-1 text-slate-300 dark:text-slate-600">&middot;</span>
                    <span>{job.timeWindow}</span>
                  </>
                )}
              </div>

              <div className="flex items-start gap-2 mt-1.5">
                <div className="text-[17px] font-extrabold text-slate-900 dark:text-white leading-snug tracking-tight flex-1">
                  {job.pickup} <span className="text-slate-400 dark:text-slate-500 mx-0.5">&rarr;</span> {job.dropoff}
                </div>
                {isBlocked && (
                  <div className="shrink-0 mt-0.5">
                    <ShieldX className="w-4.5 h-4.5 text-amber-500" />
                  </div>
                )}
                {isOutsideRadius && !isBlocked && (
                  <div className="shrink-0 mt-0.5">
                    <Navigation className="w-4.5 h-4.5 text-blue-500" />
                  </div>
                )}
              </div>

              <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-tight">
                {[job.miles ? `${job.miles} mi` : null, job.etaMinutes ? `Est. ${formatDuration(job.etaMinutes)}` : null].filter(Boolean).join(' \u2013 ')}
              </div>
            </div>

            <div className="flex flex-col items-end justify-between shrink-0">
              {hasDropoffCoords ? (
                <MiniRouteMap
                  pickup={{ lat: job.lat, lng: job.lng }}
                  dropoff={{ lat: job.dropoffLat!, lng: job.dropoffLng! }}
                  isLoaded={isMapsLoaded}
                />
              ) : (
                <RouteThumbnail />
              )}

              {job.payout != null && (
                <span className="text-[22px] font-black text-green-600 dark:text-green-400 leading-none tracking-tight mt-2.5">
                  {formatCurrency(job.payout)}
                </span>
              )}
            </div>
          </div>
        </CardContent>

        <div className="h-11 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center bg-slate-50/60 dark:bg-slate-800/40">
          {isBlocked ? (
            <div className="flex items-center gap-1.5">
              <ShieldX className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Schedule Conflict</span>
            </div>
          ) : isOutsideRadius ? (
            <div className="flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Beyond Your Radius</span>
            </div>
          ) : (
            <ArrowRight className="w-7 h-7 text-green-600 dark:text-green-400" strokeWidth={3} />
          )}
        </div>
      </Card>

      {/* Blocked gig detail dialog — tap to see why */}
      <AlertDialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <AlertDialogContent className="rounded-2xl max-w-[340px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 mb-2">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                isBlocked ? "bg-amber-100 dark:bg-amber-900/20" : "bg-blue-100 dark:bg-blue-900/20"
              )}>
                {isBlocked ? (
                  <ShieldX className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Navigation className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <AlertDialogTitle className="text-left text-base">
                {isBlocked ? blockedExplanation.title : "Outside Your Distance Filter"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left text-sm leading-relaxed whitespace-pre-line">
              {isBlocked
                ? blockedExplanation.body
                : "This delivery is farther than the distance you selected in your filters. You can change your distance filter to \u201cAny\u201d to see it normally, or you can tap \u201cView Details\u201d to check it out anyway."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 mb-3">
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {job.pickup} <span className="mx-0.5">&rarr;</span> {job.dropoff}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {job.timeWindow}{job.miles ? ` \u00b7 ${job.miles} mi` : ''}
            </p>
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {!isBlocked && (
              <AlertDialogAction
                className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                onClick={() => { setShowBlockedDialog(false); onClick() }}
              >
                View Details
              </AlertDialogAction>
            )}
            <AlertDialogAction
              className={cn(
                "w-full rounded-xl font-bold",
                isBlocked
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
              )}
            >
              Got It
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function DriverGigBoardPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const driverId = user?.profileId
  const displayName = user?.fullName?.split(' ')[0] || user?.username || 'Driver'
  const navigate = useNavigate()

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    radiusMiles: 'ANY',
    datePreset: 'ALL',
    sortBy: 'ANY',
  })

  // Build query params from filter state
  const buildQueryParams = () => {
    const params = new URLSearchParams()
    params.append('limit', '20')

    if (filters.search.trim()) {
      params.append('search', filters.search.trim())
    }
    if (filters.radiusMiles && filters.radiusMiles !== 'ANY') {
      params.append('radiusMiles', filters.radiusMiles)
    }
    if (filters.datePreset && filters.datePreset !== 'ALL') {
      params.append('datePreset', filters.datePreset)
    }
    if (filters.sortBy && filters.sortBy !== 'ANY') {
      params.append('sortBy', filters.sortBy)
    }

    return params.toString()
  }

  const queryParams = buildQueryParams()
  const socketConnected = useSocketConnected()

  // Data fetch with filters
  const {
    data: deliveriesData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${driverId}?${queryParams}`,
    queryKey: ['driverFeed', driverId],
    noFilter: true,
    enabled: Boolean(driverId),
    staleTime: 0, // always refetch on mount so booked deliveries disappear immediately
    refetchInterval: socketConnected ? false : 60 * 1000, // only poll when socket is down
  })

  // ── Error-recovery polling: if socket connected but API is failing, keep retrying ──
  useEffect(() => {
    if (isError && socketConnected) {
      const interval = setInterval(() => refetch(), 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isError, socketConnected, refetch])

  const queryClient = useQueryClient()

  // ── SOCKET.IO: Join driver feed room ──
  useEffect(() => {
    if (driverId) socketJoinDriverFeed()
    return () => socketLeaveDriverFeed()
  }, [driverId])

  // ── SOCKET.IO: Listen for feed updates (new bookings, unbookings) ──
  const handleFeedUpdate = useCallback((data: any) => {
    if (!data?.deliveryId) return
    if (['BOOKED', 'CANCELLED', 'EXPIRED'].includes(data.status)) {
      queryClient.invalidateQueries({ queryKey: ['driverFeed', driverId] })
    } else if (data.status === 'LISTED') {
      queryClient.invalidateQueries({ queryKey: ['driverFeed', driverId] })
      const soundEnabled = localStorage.getItem('driverSoundEnabled') !== 'false'
      if (soundEnabled) {
        try { new Audio('/assets/notification.mp3').play() } catch { /* autoplay blocked */ }
      }
    }
  }, [driverId, queryClient])
  useSocketEvent('delivery:feed-update', handleFeedUpdate)

  // Notification count
  const { data: inboxData } = useDataQuery<NotificationInboxResponse>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/notificationEvents/my/inbox?take=1`,
    noFilter: true,
    enabled: Boolean(driverId),
  })
  const unreadCount = inboxData?.unreadCount || 0

  // Google Maps is needed only for MiniRouteMap in cards
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Proof cam onboarding guard
  useEffect(() => {
    try {
      const seen = localStorage.getItem('hasSeenProofCam')
      if (seen !== 'true') {
        navigate({ to: '/driver/proof-cam' })
      }
    } catch {}
  }, [navigate])

  // Theme
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    clearAuth()
    stopSessionKeepAlive()
    toast.success('Signed out successfully')
    navigate({ to: '/landing' })
  }

  // Update a single filter
  const updateFilter = (key: keyof typeof filters, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      radiusMiles: 'ANY',
      datePreset: 'ALL',
      sortBy: 'ANY',
    })
    toast.success('Filters reset to defaults')
  }

  const handleRefresh = () => {
    refetch()
    toast.success('Refreshed', { description: 'Job feed updated.' })
  }

  // Navigate to job details
  const handleViewJob = (jobId: string) => {
    navigate({ to: `/driver/job-details`, search: { jobId } })
  }

  // Transform API data
  const jobs: JobItem[] = useMemo(() => {
    return deliveriesData?.items?.map((item: any, index: number) => ({
      id: item.deliveryId,
      urgent: item.isUrgent || false,
      type: serviceTypeLabels[item.serviceType] || item.serviceType,
      date: formatDate(item.pickupWindowStart),
      timeWindow: formatTimeRange(item.pickupWindowStart, item.pickupWindowEnd),
      pickup: extractRouteLabel(item.pickupAddress || ''),
      dropoff: extractRouteLabel(item.dropoffAddress || ''),
      service: serviceTypeLabels[item.serviceType] || item.serviceType,
      miles: item.deliveryDistanceMiles || null,
      duration: formatDuration(item.etaMinutes),
      payout: item.payoutPreviewAmount,
      bonus: item.urgentBonusAmount,
      requirements: [],
      pickupAddressFull: item.pickupAddress || '',
      dropoffAddressFull: item.dropoffAddress || '',
      pickupWindowStartFull: item.pickupWindowStart || '',
      pickupWindowEndFull: item.pickupWindowEnd || '',
      etaMinutes: item.etaMinutes || null,
      isUrgent: item.isUrgent || false,
      lat: item.pickupLat && item.pickupLng ? item.pickupLat : mockPickupLocations[index % mockPickupLocations.length].lat,
      lng: item.pickupLat && item.pickupLng ? item.pickupLng : mockPickupLocations[index % mockPickupLocations.length].lng,
      dropoffLat: item.dropoffLat || null,
      dropoffLng: item.dropoffLng || null,
      stackingBlocked: item.stackingBlocked || null,
      stackingDetails: item.stackingDetails || null,
      outsidePreferredRadius: item.outsidePreferredRadius || false,
    })) || []
  }, [deliveriesData])

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex flex-col">
      {/* Top App Bar for Gig Board */}
      <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-[480px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-9 h-9 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <div className="leading-tight">
              <div className="text-[13px] font-black text-slate-900 dark:text-white">
                Gig Board (List)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {displayName}
              </span>
            </div>

            <Link
              to="/driver/inbox"
              className="relative w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-slate-950 text-[11px] font-black flex items-center justify-center border border-white dark:border-slate-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              to="/driver/dashboard"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Settings"
            >
              <Map className="w-4 h-4" />
            </Link>
            <Link
              to="/driver/preferences"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content: Gig Board */}
      <main className="flex-1 w-full max-w-[480px] mx-auto px-4 sm:px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Gig Board
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Available deliveries near you. Tap to see details and book.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="h-11 w-full pl-11 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
            placeholder="Search pickup location by city or ZIP"
          />
        </div>

        {/* Filters Row */}
        <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm mb-4">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Distance</span>
                <Select
                  value={filters.radiusMiles}
                  onValueChange={(value) => updateFilter('radiusMiles', value)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-xs min-w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.radiusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date</span>
                <Select
                  value={filters.datePreset}
                  onValueChange={(value) => updateFilter('datePreset', value)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-xs min-w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.datePresetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order</span>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => updateFilter('sortBy', value)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-xs min-w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                onClick={clearFilters}
                className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-px"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section header */}
        <div className="flex items-end justify-between gap-4 mb-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Gigs Nearby ({jobs.length})
          </h2>
        </div>

        {/* Loading */}
        {isLoading && (
          <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm p-8 text-center rounded-2xl">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading available gigs...</p>
            </div>
          </Card>
        )}

        {/* Error */}
        {isError && (
          <Card className="border-red-200 dark:border-red-900 shadow-sm p-8 rounded-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-semibold">Failed to load gigs. Please try again.</p>
            </div>
          </Card>
        )}

        {/* Empty */}
        {!isLoading && !isError && jobs.length === 0 && (
          <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm p-8 text-center rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <Inbox className="w-8 h-8 text-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-400">No gigs available at the moment.</p>
            </div>
          </Card>
        )}

        {/* Gig Cards */}
        {jobs.length > 0 && (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <GigCard
                key={job.id}
                job={job}
                onClick={() => handleViewJob(job.id)}
                isMapsLoaded={isLoaded}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
    </div>
  )
}