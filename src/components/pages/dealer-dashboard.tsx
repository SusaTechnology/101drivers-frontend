// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from '@/lib/theme'
import { safeLocalStorage } from '@/lib/safeStorage'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PhotoDialog } from '@/components/ui/photo-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Home,
  Truck,
  Wrench,
  Search,
  Plus,
  MapPin,
  Flag,
  Clock,
  CheckCircle,
  User,
  Navigation,
  Package,
  Calendar as CalendarIcon,
  Phone,
  Sun,
  Moon,
  LogOut,
  FileText,
  History,
  Eye,
  EyeOff,
  Bell,
  BellRing,
  HelpCircle,
  Share2,
  Menu,
  X,
  Car,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Edit3,
  MessageSquare,
  Activity,
  Timer,
  ArrowRight,
  CheckSquare,
  Settings,
  XCircle,
  Map,
  Download,
  Filter,
  Smartphone,
  Mail,
  Layers,
  Star,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import InlineErrorCard from '@/components/shared/InlineErrorCard'
import { getUser, useDataQuery, useDataMutation, authFetch, clearAuth, stopSessionKeepAlive, serverLogout } from '@/lib/tanstack/dataQuery'
import NotificationBell from '@/components/notifications/NotificationBell'
// Postpaid billing panel — dealer-facing read-only summary (outstanding,
// next invoice, frozen banner, cap usage). Only rendered when the customer
// has postpaidEnabled=true on their profile.
import PostpaidStatusPanel from '@/components/postpaid/PostpaidStatusPanel'
// Referral code card — dealer-facing "Refer & Earn" with copy + QR + share URL.
// Calls the customer-side referral endpoints (my-customer-referral-code +
// my-customer-referral-stats + program-config). The card is conditional on
// the program being active and the customer having a referral code.
import { ReferralCodeCard } from '@/components/referral/ReferralCodeCard'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config'
import { BUSINESS_TZ } from '@/lib/timezone'
import { useDealerDeliverySocket } from '@/hooks/useDealerDeliverySocket'

// Helper functions
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TZ })
}

const formatDateLong = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TZ })
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })
}

const formatTimeWindow = (start: string, end: string) => {
  if (!start || !end) return ''
  return `${formatTime(start)} – ${formatTime(end)}`
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Status configuration with colors
const statusConfig = {
  QUOTED: { label: 'Quoted', color: 'slate', bgColor: 'bg-slate-100 dark:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-400', borderColor: 'border-slate-200 dark:border-slate-700', dotColor: 'bg-slate-400' },
  LISTED: { label: 'Listed', color: 'slate', bgColor: 'bg-slate-100 dark:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-400', borderColor: 'border-slate-200 dark:border-slate-700', dotColor: 'bg-slate-400' },
  BOOKED: { label: 'Booked', color: 'blue', bgColor: 'bg-blue-50 dark:bg-blue-950/30', textColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-200 dark:border-blue-800', dotColor: 'bg-blue-500' },
  ACTIVE: { label: 'Active', color: 'lime', bgColor: 'bg-lime-50 dark:bg-lime-950/30', textColor: 'text-lime-600 dark:text-lime-400', borderColor: 'border-lime-200 dark:border-lime-800', dotColor: 'bg-lime-500' },
  COMPLETED: { label: 'Completed', color: 'green', bgColor: 'bg-green-50 dark:bg-green-950/30', textColor: 'text-green-600 dark:text-green-400', borderColor: 'border-green-200 dark:border-green-800', dotColor: 'bg-green-500' },
  CLOSED: { label: 'Closed', color: 'slate', bgColor: 'bg-slate-100 dark:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-400', borderColor: 'border-slate-200 dark:border-slate-700', dotColor: 'bg-slate-500' },
  CANCELLED: { label: 'Cancelled', color: 'red', bgColor: 'bg-red-50 dark:bg-red-950/30', textColor: 'text-red-600 dark:text-red-400', borderColor: 'border-red-200 dark:border-red-800', dotColor: 'bg-red-500' },
  EXPIRED: { label: 'Expired', color: 'amber', bgColor: 'bg-amber-50 dark:bg-amber-950/30', textColor: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-200 dark:border-amber-800', dotColor: 'bg-amber-500' },
}

export default function DealerDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'LISTED' | 'BOOKED' | 'ACTIVE' | 'EXPIRED' | 'HISTORY'>('LISTED')
  const [showAll, setShowAll] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Pull-to-refresh uses REFS, not state: every setState during a touch
  // gesture re-renders this ~1000-line component (and the whole delivery
  // list) on the main thread — on iPhones that made every tap on the FAB,
  // bottom nav and other buttons feel sluggish, because touchstart on ANY
  // element at scroll-top pumped a state update through the entire page
  // before the click even fired. The indicator element is now driven by
  // direct style writes; React state is touched only when a real refresh
  // starts/stops.
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  const pullDistanceRef = useRef(0)
  const pullIndicatorRef = useRef<HTMLDivElement>(null)
  // Photo dialog state for driver avatar
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [photoDialogSrc, setPhotoDialogSrc] = useState('')
  const [photoDialogTitle, setPhotoDialogTitle] = useState('')
  
  // New state for features
  const [showMapView, setShowMapView] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState<Date | undefined>()
  const [dateTo, setDateTo] = useState<Date | undefined>()
  // Controlled open-state for the inner From / To date-picker popovers.
  // Without this the calendar popover stays open after a date is picked
  // (Radix uncontrolled Popover has no idea the user is "done"), which
  // forces the dealer to tap outside to dismiss it. We close it on select.
  // Also: on tablets/iPads the calendar popover can render too tall (collides
  // with the top of the viewport and Radix flips it / clips it). Controlling
  // open state lets us also pass explicit collision props below.
  const [showFromCalendar, setShowFromCalendar] = useState(false)
  const [showToCalendar, setShowToCalendar] = useState(false)
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    statusUpdates: true,
    driverAssigned: true,
    deliveryComplete: true,
    newMessages: true,
  })
  
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const dealerId = user?.profileId

  // ─── Landing-page quote handoff ("Sign up and request a delivery") ──
  // A customer who quoted on the public landing page and then signed in /
  // finished signup lands here with a quoteDraft in localStorage. The quote
  // is saved as a DRAFT delivery request via the existing drafts system and
  // they are taken straight into the pre-filled delivery form — nothing is
  // retyped.
  //  • BUSINESS — the account may still be PENDING admin approval, so the
  //    draft waits in their Drafts until the account is approved.
  //  • PERSONAL — private customers are auto-approved at signup (they get
  //    tokens at OTP and are treated exactly like any logged-in user), so
  //    the same draft handoff drops them into the pre-filled form ready to
  //    submit.
  const attachIsPersonalRef = useRef(false)
  const quoteDraftAttach = useDataMutation<
    { id?: string },
    { customerId: string; quoteId: string; serviceType: string }
  >({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/create-draft-from-quote`,
    onSuccess: (data) => {
      // The handoff is complete — the request now lives server-side as a
      // real draft. Clear BOTH keys: quoteDraft (signup handoff; also
      // prevents a duplicate draft on next login) and homeQuotePrefill
      // (the landing page's "remember my addresses" rule — otherwise the
      // public From/To fields still show these addresses after sign-out).
      try {
        localStorage.removeItem('quoteDraft')
        localStorage.removeItem('homeQuotePrefill')
      } catch { /* ignore */ }
      if (attachIsPersonalRef.current) {
        toast.success('Your delivery request is ready', {
          description: 'We pre-filled the form from your quote — review the details and submit.',
          duration: 8000,
        })
      } else {
        toast.success('Your delivery request is saved', {
          description: "It's waiting in your Drafts — submit it once your account is approved.",
          duration: 8000,
        })
      }
      // The system already knows a request was started on the public page
      // — take them straight to it instead of making them hunt for it in
      // their Drafts list.
      if (data?.id) {
        navigate({
          to: '/dealer-create-delivery',
          search: { draftId: data.id },
        })
      }
    },
    onError: () => {
      // Draft stays in localStorage — retried on the next login.
    },
  })

  useEffect(() => {
    if (!dealerId) return
    let raw: string | null = null
    try { raw = localStorage.getItem('quoteDraft') } catch { return }
    if (!raw) return
    let draft: { deliveryType?: string; quoteData?: { id?: string; serviceType?: string } } | null = null
    try { draft = JSON.parse(raw) } catch { return }
    // PERSONAL draft: private customers are auto-approved at signup and
    // arrive here already logged in (tokens issued at OTP verification).
    // Save the quote as a real server-side draft — same handoff as
    // business — and take them straight into the pre-filled delivery form
    // (addresses + price). If they leave midway the draft waits in their
    // Drafts list, exactly like any other saved draft.
    if (draft?.deliveryType === 'PERSONAL' && draft?.quoteData?.id) {
      attachIsPersonalRef.current = true
      quoteDraftAttach.mutate({
        customerId: dealerId,
        quoteId: draft.quoteData.id,
        serviceType: draft.quoteData.serviceType || 'HOME_DELIVERY',
      })
      return
    }
    if (draft?.deliveryType !== 'BUSINESS' || !draft?.quoteData?.id) return
    attachIsPersonalRef.current = false
    quoteDraftAttach.mutate({
      customerId: dealerId,
      quoteId: draft.quoteData.id,
      serviceType: 'BETWEEN_LOCATIONS',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId])

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  useEffect(() => {
    setMounted(true)
    const savedSettings = safeLocalStorage.get('notificationSettings')
    if (savedSettings) {
      setNotificationSettings(JSON.parse(savedSettings))
    }
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    // Ask the backend to clear the httpOnly refresh-token cookie (best effort),
    // otherwise the 7-day cookie would survive logout in the browser.
    serverLogout()
    clearAuth()
    stopSessionKeepAlive()
    toast.success('Signed out successfully')
    navigate({ to: '/home' })
  }

  const { data: customerProfile } = useDataQuery<{
    id: string
    businessName: string | null
    contactName: string
    contactEmail: string
    customerType: 'PRIVATE' | 'BUSINESS'
    approvalStatus: string
    postpaidEnabled: boolean
  }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${dealerId}`,
    noFilter: true,
    enabled: Boolean(dealerId),
  })

  const isPrivateCustomer = customerProfile?.customerType === 'PRIVATE'

  const { socketConnected } = useDealerDeliverySocket({ dealerId })

  const { data: deliveriesData, isLoading, isFetching, isError, error, refetch } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${dealerId}/deliveries`,
    queryKey: ['deliveries', dealerId],
    noFilter: true,
    enabled: Boolean(dealerId),
    staleTime: 0,
    refetchInterval: 30 * 1000,
  })

  // ── Error-recovery polling: if socket connected but API is failing, keep retrying ──
  useEffect(() => {
    if (isError && socketConnected) {
      const interval = setInterval(() => refetch(), 30 * 1000)
      return () => clearInterval(interval)
    }
  }, [isError, socketConnected, refetch])

  const deliveries = useMemo(() => {
    if (!deliveriesData) return []
    return deliveriesData.filter((item: any) => item.status !== 'DRAFT').map((item: any) => {
      const assignment = item.assignments?.[0]
      const driverRatings = assignment?.driver?.ratingsReceived || []
      const driverAvgRating = driverRatings.length > 0
        ? driverRatings.reduce((sum: number, r: any) => sum + r.stars, 0) / driverRatings.length
        : null
      const driver = assignment?.driver ? {
        id: assignment.driver.id,
        name: assignment.driver.user?.fullName || assignment.driver.name || 'Driver',
        phone: assignment.driver.phone,
        rating: driverAvgRating,
        avatar: assignment.driver.selfiePhotoUrl || assignment.driver.profilePhotoUrl || assignment.driver.user?.avatar || assignment.driver.avatar,
        verified: assignment.driver.status === 'APPROVED',
      } : null

      const scheduleDate = item.customerChose === 'PICKUP_WINDOW' ? formatDate(item.pickupWindowStart) : formatDate(item.dropoffWindowStart)
      const scheduleTime = item.customerChose === 'PICKUP_WINDOW' ? formatTimeWindow(item.pickupWindowStart, item.pickupWindowEnd) : formatTimeWindow(item.dropoffWindowStart, item.dropoffWindowEnd)
      const carPhoto = item.proofs?.find((p: any) => p.type === 'PICKUP_START' || p.type === 'PICKUP_PHOTO')?.photoUrl
      // progress removed — was using Math.random() fake data
      const etaMinutes = item.etaMinutes || item.quote?.etaMinutes || 0
      const price = item.quote?.estimatedPrice || item.payment?.amount || 0
      const miles = item.quote?.distanceMiles || 0

      return {
        id: item.id,
        ref: item.id.slice(-6).toUpperCase(),
        status: item.status,
        serviceType: item.serviceType,
        vehicle: { make: item.vehicleMake, model: item.vehicleModel, color: item.vehicleColor, licensePlate: item.licensePlate },
        pickup: item.pickupAddress?.split(',')[0] || 'Pickup',
        pickupFull: item.pickupAddress,
        pickupLat: item.pickupLat,
        pickupLng: item.pickupLng,
        dropoff: item.dropoffAddress?.split(',')[0] || 'Dropoff',
        dropoffFull: item.dropoffAddress,
        dropoffLat: item.dropoffLat,
        dropoffLng: item.dropoffLng,
        scheduleDate,
        scheduleTime,
        pickupWindowStart: item.pickupWindowStart,
        pickupPin: item.pickupPin,
        price,
        miles,
        driver,
        carPhoto,
        etaMinutes,
        createdById: item.customer?.id,
        createdAt: item.createdAt,
      }
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [deliveriesData])

  // ── Fetch rating + tip status for completed deliveries (History tab) ──
  const completedIds = useMemo(
    () => deliveries.filter(d => d.status === 'COMPLETED').map(d => d.id),
    [deliveries],
  )
  const { data: ratingStatuses } = useDataQuery<any[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRatings?limit=1000`,
    noFilter: true,
    enabled: completedIds.length > 0,
    staleTime: 60_000,
  })
  const { data: tipStatuses } = useDataQuery<any[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/tips?limit=1000`,
    noFilter: true,
    enabled: completedIds.length > 0,
    staleTime: 60_000,
  })
  const ratedDeliveryIds = useMemo(
    () => new Set((ratingStatuses || []).map((r: any) => r.delivery?.id).filter(Boolean)),
    [ratingStatuses],
  )
  const tippedDeliveryIds = useMemo(
    () => new Set((tipStatuses || []).map((t: any) => t.delivery?.id).filter(Boolean)),
    [tipStatuses],
  )


  // ── "Today" window (dealer's local calendar day) ──
  // A delivery counts toward today's revenue when its pickup happens
  // today (pickupWindowStart, falling back to createdAt when missing)
  // and it is actually in motion or finished (ACTIVE / COMPLETED).
  // Previously this summed ALL active+completed deliveries with no date
  // filter, so the "Today" tile showed lifetime value — misleading.
  const isToday = (d: { pickupWindowStart?: string | null; createdAt?: string | null }) => {
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const when = new Date(d.pickupWindowStart || d.createdAt || 0).getTime()
    return when >= dayStart && when < dayStart + 24 * 60 * 60 * 1000
  }

  const stats = useMemo(() => ({
    active: deliveries.filter(d => d.status === 'ACTIVE').length,
    listed: deliveries.filter(d => ['LISTED', 'QUOTED'].includes(d.status)).length,
    booked: deliveries.filter(d => d.status === 'BOOKED').length,
    expired: deliveries.filter(d => d.status === 'EXPIRED').length,
    todayRevenue: deliveries
      .filter(d => ['ACTIVE', 'COMPLETED'].includes(d.status) && isToday(d))
      .reduce((sum, d) => sum + (d.price || 0), 0),
  }), [deliveries])

  const filteredDeliveries = useMemo(() => {
    let result = deliveries
    if (activeFilter === 'ACTIVE') result = result.filter(d => d.status === 'ACTIVE')
    else if (activeFilter === 'LISTED') result = result.filter(d => d.status === 'LISTED' || d.status === 'QUOTED')
    else if (activeFilter === 'BOOKED') result = result.filter(d => d.status === 'BOOKED')
    else if (activeFilter === 'EXPIRED') result = result.filter(d => d.status === 'EXPIRED')
    else if (activeFilter === 'HISTORY') result = result.filter(d => ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(d.status))
    if (!showAll && dealerId) result = result.filter(d => d.createdById === dealerId)
    if (dateFrom) result = result.filter(d => new Date(d.pickupWindowStart || d.createdAt) >= dateFrom)
    if (dateTo) result = result.filter(d => new Date(d.pickupWindowStart || d.createdAt) <= dateTo)
    if (searchQuery) {
      const query = searchQuery.replace(/^#/, '').toLowerCase()
      result = result.filter(d => 
        d.ref.toLowerCase().includes(query) ||
        d.id.toLowerCase().includes(query) ||
        d.vehicle.licensePlate?.toLowerCase().includes(query) ||
        d.vehicle.make?.toLowerCase().includes(query) ||
        d.vehicle.model?.toLowerCase().includes(query) ||
        d.pickup.toLowerCase().includes(query) ||
        d.dropoff.toLowerCase().includes(query) ||
        d.driver?.name?.toLowerCase().includes(query) ||
        d.driver?.phone?.toLowerCase().includes(query)
      )
    }
    return result
  }, [deliveries, activeFilter, showAll, searchQuery, dealerId, dateFrom, dateTo])

  const activeDeliveriesForMap = useMemo(() => deliveries.filter(d => d.status === 'ACTIVE' && d.pickupLat && d.dropoffLat), [deliveries])

  // ── Quick action: manage/close delivery from dashboard cards ──
  const [actionDialogDeliveryId, setActionDialogDeliveryId] = useState<string | null>(null)
  const [actionDialogStatus, setActionDialogStatus] = useState<'ACTIVE' | 'BOOKED' | null>(null)

  const transitionMutation = useDataMutation({
    apiEndPoint: actionDialogDeliveryId
      ? `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${actionDialogDeliveryId}/transition-status`
      : '',
    method: 'POST',
    onSuccess: (_data, variables) => {
      setActionDialogDeliveryId(null)
      setActionDialogStatus(null)
      const target = (variables as any)?.toStatus
      if (target === 'CLOSED') {
        toast.success('Delivery closed', { description: 'This delivery has been marked as closed.' })
      } else if (target === 'COMPLETED') {
        toast.success('Delivery completed', { description: 'This delivery has been marked as completed.' })
      } else if (target === 'LISTED') {
        toast.success('Delivery reverted', { description: 'The driver has been unassigned and the delivery is back on the board.' })
      }
      refetch()
    },
    onError: (error: any) => {
      toast.error('Action failed', { description: error.message || 'Something went wrong.' })
    },
  })

  const openActionDialog = (deliveryId: string, status: 'ACTIVE' | 'BOOKED') => {
    setActionDialogDeliveryId(deliveryId)
    setActionDialogStatus(status)
  }

  const handleTransition = (toStatus: string, note: string) => {
    if (!actionDialogDeliveryId) return
    transitionMutation.mutate({
      toStatus,
      actorUserId: user?.id || null,
      // Derive actorRole from the customer profile so audit logs correctly
      // label private-customer actions as PRIVATE_CUSTOMER.
      actorRole: isPrivateCustomer ? 'PRIVATE_CUSTOMER' : 'BUSINESS_CUSTOMER',
      note,
    })
  }

  const handleExportCSV = () => {
    const headers = ['Reference', 'Status', 'Vehicle', 'License Plate', 'Pickup', 'Dropoff', 'Date', 'Price', 'Driver']
    const rows = filteredDeliveries.map(d => [d.ref, d.status, `${d.vehicle.make} ${d.vehicle.model}`, d.vehicle.licensePlate || '', d.pickup, d.dropoff, d.scheduleDate, d.price?.toString() || '0', d.driver?.name || ''])
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `deliveries-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Export complete', { description: `Downloaded ${filteredDeliveries.length} deliveries` })
  }

  const handleSaveNotificationSettings = () => {
    safeLocalStorage.set('notificationSettings', JSON.stringify(notificationSettings))
    toast.success('Settings saved', { description: 'Your notification preferences have been updated.' })
    setNotificationSettingsOpen(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = containerRef.current?.scrollTop === 0 ? e.touches[0].clientY : null }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || containerRef.current?.scrollTop !== 0) return
    const distance = e.touches[0].clientY - touchStartY.current
    if (distance > 0 && distance < 150) {
      pullDistanceRef.current = distance
      // Drive the indicator via the DOM — no re-render per finger move.
      const el = pullIndicatorRef.current
      if (el) { el.style.opacity = '1'; el.style.top = `${distance * 0.5}px` }
    }
  }
  const handleTouchEnd = async () => {
    const pulled = pullDistanceRef.current
    pullDistanceRef.current = 0
    touchStartY.current = null
    const el = pullIndicatorRef.current
    if (el) { el.style.opacity = '0'; el.style.top = '0px' }
    if (pulled > 80) { setRefreshing(true); await refetch(); setRefreshing(false) }
  }
  const clearDateFilters = () => { setDateFrom(undefined); setDateTo(undefined) }

  if (isLoading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div><p className="mt-4 text-slate-600 dark:text-slate-400">Loading deliveries...</p></div></div>
  // NOTE: no full-page error swap here anymore. A failed deliveries fetch
  // used to replace the ENTIRE page — header, bottom nav, everything —
  // with a centered card, which read as "the app broke". The shell now
  // stays alive and the cause-specific InlineErrorCard renders at the top
  // of the content area (see the isError block just below </header>).

  // Header date labels (both formats cut from ONE render so they can never
  // straddle midnight mid-render). The long form is shown on >=sm screens;
  // on phones the compact form keeps the header row from overflowing.
  const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: BUSINESS_TZ });
  const todayShort = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TZ });

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* NOTE: no overflow-x-hidden here. overflow-x:hidden turns this div into
          a CSS scroll container (overflow-y computes to auto), and position:
          sticky then sticks to THIS div instead of the viewport — since the
          div grows with its content and never scrolls internally, the sticky
          header scrolled away with the page ("nav bar is scrollable"). Any
          stray horizontal overflow is now clipped once, globally, on <html>
          (styles.css), which keeps sticky working. */}
      {/* Pull to refresh indicator — position/opacity written directly by
          the touch handlers (see refs above); React never re-renders while
          the finger is down. */}
      <div ref={pullIndicatorRef} className="absolute left-0 right-0 flex justify-center pt-4 transition-all duration-200 z-50 opacity-0" style={{ top: 0 }}><RefreshCw className={cn("h-6 w-6 text-lime-500", refreshing && "animate-spin")} /></div>

      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-[980px] mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* min-w-0 + truncate: lets the date/title shrink instead of being
              squeezed under the icon row on narrow iPhones — previously the
              long date wrapped and got clipped by the fixed h-16 bar. */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link to="/" className="flex items-center shrink-0"><div className="w-10 h-10 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-200"><img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" /></div></Link>
            <div className="leading-tight min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 truncate"><span className="hidden sm:inline">{todayLong}</span><span className="sm:hidden">{todayShort}</span></div><div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{isPrivateCustomer ? 'My Deliveries' : 'Delivery Dashboard'}</div></div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className={cn("text-xs font-bold transition-colors", !showAll ? "text-lime-600" : "text-slate-400")}>My</span>
              <Switch checked={showAll} onCheckedChange={setShowAll} className="data-[state=checked]:bg-lime-500" />
              <span className={cn("text-xs font-bold transition-colors", showAll ? "text-lime-600" : "text-slate-400")}>All</span>
            </div> */}
            <Button variant={showMapView ? "default" : "outline"} size="icon" className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl", showMapView && "bg-lime-500 text-slate-950")} onClick={() => setShowMapView(!showMapView)} title="Map view"><Map className="h-5 w-5" /></Button>
            <NotificationBell userType="dealer" />
            <Button asChild variant="ghost" size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl" title="Help">
              <Link to="/help-customer"><HelpCircle className="h-5 w-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl" onClick={toggleTheme} title="Toggle theme">{mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex w-10 h-10 rounded-xl" onClick={handleExportCSV} title="Export CSV"><Share2 className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex w-10 h-10 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleSignOut} title="Sign Out"><LogOut className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="sm:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="max-w-[980px] mx-auto px-4 py-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800"><span className="text-sm font-bold">View Mode</span><div className="flex items-center gap-2"><span className={cn("text-xs font-bold", !showAll && "text-lime-600")}>My</span><Switch checked={showAll} onCheckedChange={setShowAll} className="data-[state=checked]:bg-lime-500" /><span className={cn("text-xs font-bold", showAll && "text-lime-600")}>All</span></div></div>
              <Button onClick={() => setNotificationSettingsOpen(true)} variant="outline" className="w-full justify-start p-3 rounded-xl font-bold"><Bell className="h-4 w-4 mr-2" />Notifications</Button>
              <Link to="/help-customer" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"><HelpCircle className="h-4 w-4 inline mr-2" />Help Center</Link>
              <button onClick={handleExportCSV} className="w-full text-left p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"><Share2 className="h-4 w-4 inline mr-2" />Export Deliveries (CSV)</button>
              <Link to="/dealer-drafts" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"><FileText className="h-4 w-4 inline mr-2" />Drafts</Link>
              <Link to="/dealer-settings" className="block p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"><User className="h-4 w-4 inline mr-2" />Settings</Link>
              <button onClick={handleSignOut} className="w-full p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 font-bold text-left"><LogOut className="h-4 w-4 inline mr-2" />Sign Out</button>
            </div>
          </div>
        )}
      </header>

      {/* Data-load failure — cause-specific banner INSIDE the live shell.
          The header, bottom nav, pull-to-refresh and map view all stay
          usable while the list failed; the card explains WHAT failed
          (offline / session expired / our server / no access) and retries.
          Offline cards ALSO auto-retry the moment the device reconnects,
          and the socket-reconnect effect above refetches on its own —
          transient mobile failures now self-heal without any tap. */}
      {isError && (
        <div className="max-w-[980px] mx-auto px-4 pt-4">
          <InlineErrorCard
            error={error}
            title="Couldn't load your deliveries"
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        </div>
      )}

      {/* Map View */}
      {showMapView && (
        <div className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-40 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[980px] mx-auto">
            <div className="h-64 sm:h-80 relative bg-slate-200 dark:bg-slate-800">
              {isLoaded && activeDeliveriesForMap.length > 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <Layers className="h-12 w-12 text-lime-500 mx-auto mb-2" />
                    <div className="font-bold text-slate-900 dark:text-white">{activeDeliveriesForMap.length} Active Deliveries on Map</div>
                    <div className="text-sm text-slate-500 mt-1">Click a delivery to track live</div>
                    <div className="mt-4 space-y-2">
                      {activeDeliveriesForMap.slice(0, 3).map(d => (
                        <Link key={d.id} to="/dealer-delivery-details" search={{ id: d.id }} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg text-sm">
                          <div className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
                          <span className="font-bold">{d.vehicle.make} {d.vehicle.model}</span>
                          <span className="text-slate-400">• {d.pickup} → {d.dropoff}</span>
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center p-4"><MapPin className="h-12 w-12 text-slate-300 mx-auto mb-2" /><div className="text-slate-500">No active deliveries to display</div></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Postpaid billing status panel — only for BUSINESS customers on
          weekly postpaid. Shows outstanding balance, next invoice date,
          cap usage, and a frozen banner if the dealer's weekly charge
          failed. The panel polls /api/postpaid-billing/me/status every
          minute so changes (e.g. admin unfreeze, new invoice payment)
          surface without a manual refresh.
          `collapsible` adds a collapse toggle (chevron in the panel
          header) so the dealer can fold it to a one-line strip to save
          screen space; the choice persists via localStorage and the
          default is expanded. */}
      {customerProfile?.postpaidEnabled && dealerId && (
        <PostpaidStatusPanel customerId={dealerId} collapsible />
      )}

      {/* Referral code card — "Refer & Earn" with copy + QR + share URL.
          Renders only when dealerId is available (the user is logged in
          as a customer). The card internally fetches its own data + adapts
          to the program being paused. `collapsible` adds a collapse
          toggle so the dealer can fold it to a one-line strip. */}
      {/* {dealerId && (
        <div className="px-4 pt-4 max-w-[980px] mx-auto">
          <ReferralCodeCard referrerType="CUSTOMER" collapsible />
        </div>
      )} */}

      {/* Stats Summary */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto">
          {/* 2x2 on phones (4-across was unreadable on iPhone), 4-across from sm up.
              p-2/text-xl on phones keeps each card compact; full size from sm up. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setActiveFilter('ACTIVE')}
              className={cn(
                "text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all hover:scale-105 hover:shadow-md cursor-pointer",
                activeFilter === 'ACTIVE'
                  ? "bg-lime-100 dark:bg-lime-950/50 border-lime-400 dark:border-lime-600 ring-2 ring-lime-500"
                  : "bg-lime-50 dark:bg-lime-950/30 border-lime-200 dark:border-lime-800"
              )}
            >
              <div className="text-xl sm:text-2xl font-black text-lime-600 dark:text-lime-400">{stats.active}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-lime-700 dark:text-lime-500">Active</div>
            </button>
            <button
              onClick={() => setActiveFilter('BOOKED')}
              className={cn(
                "text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all hover:scale-105 hover:shadow-md cursor-pointer",
                activeFilter === 'BOOKED'
                  ? "bg-blue-100 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500"
                  : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
              )}
            >
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">{stats.booked}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-500">Booked</div>
            </button>
            <button
              onClick={() => setActiveFilter('LISTED')}
              className={cn(
                "text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all hover:scale-105 hover:shadow-md cursor-pointer",
                activeFilter === 'LISTED'
                  ? "bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-500 ring-2 ring-slate-500"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              )}
            >
              <div className="text-xl sm:text-2xl font-black text-slate-600 dark:text-slate-400">{stats.listed}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Listed</div>
            </button>
            <button
              onClick={() => setActiveFilter('HISTORY')}
              className={cn(
                "text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all hover:scale-105 hover:shadow-md cursor-pointer",
                activeFilter === 'HISTORY'
                  ? "bg-green-100 dark:bg-green-950/50 border-green-400 dark:border-green-600 ring-2 ring-green-500"
                  : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
              )}
            >
              <div className="text-base sm:text-lg font-black text-green-600 dark:text-green-400">{formatCurrency(stats.todayRevenue)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-500">Today</div>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-40 bg-slate-50 dark:bg-slate-950 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              <Input className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-12 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm sm:text-base" placeholder="Search by #order, VIN, plate, driver name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              {isFetching && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 animate-spin" />}
            </div>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-10 sm:h-12 px-3 sm:px-4 rounded-2xl", (dateFrom || dateTo) && "border-lime-500 bg-lime-50 dark:bg-lime-950/30")}><Filter className="h-4 w-4 sm:h-5 sm:w-5" />{(dateFrom || dateTo) && <Badge className="ml-2 bg-lime-500 text-slate-950">Filtered</Badge>}</Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-4 rounded-2xl"
                align="end"
                // Keep the filter panel away from the viewport edges so it
                // never flips too high / off-screen on tablets & iPads.
                sideOffset={8}
                collisionPadding={{ top: 16, bottom: 16, left: 16, right: 16 }}
                avoidCollisions
              >
                <div className="space-y-4">
                  <div className="font-black text-slate-900 dark:text-white">Date Range</div>
                  <div className="space-y-2">
                    <div className="text-sm font-bold text-slate-500">From</div>
                    <Popover open={showFromCalendar} onOpenChange={setShowFromCalendar}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start rounded-xl h-11"><CalendarIcon className="h-4 w-4 mr-2" />{dateFrom ? formatDateLong(dateFrom.toISOString()) : 'Select date'}</Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        // Tablet/iPad fix: the calendar's intrinsic height plus
                        // Radix's default 4px sideOffset can push the popover
                        // above the viewport, where Radix then either clips it
                        // or flips it to a weird position. Pin it with a larger
                        // sideOffset, allow collisions to reposition, and give
                        // it generous padding so it always lands inside the
                        // viewport. sticky="always" keeps it attached to the
                        // trigger while scrolling so it doesn't drift away.
                        sideOffset={8}
                        collisionPadding={{ top: 16, bottom: 16, left: 16, right: 16 }}
                        avoidCollisions
                        sticky="always"
                      >
                        <div className="max-h-[70vh] overflow-auto">
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={(d) => {
                              setDateFrom(d)
                              // Close the calendar immediately after picking
                              // so the dealer doesn't have to tap outside.
                              // Tiny delay so the click that selected the
                              // date doesn't re-open the trigger.
                              setTimeout(() => setShowFromCalendar(false), 80)
                            }}
                            initialFocus
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-bold text-slate-500">To</div>
                    <Popover open={showToCalendar} onOpenChange={setShowToCalendar}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start rounded-xl h-11"><CalendarIcon className="h-4 w-4 mr-2" />{dateTo ? formatDateLong(dateTo.toISOString()) : 'Select date'}</Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        sideOffset={8}
                        collisionPadding={{ top: 16, bottom: 16, left: 16, right: 16 }}
                        avoidCollisions
                        sticky="always"
                      >
                        <div className="max-h-[70vh] overflow-auto">
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={(d) => {
                              setDateTo(d)
                              setTimeout(() => setShowToCalendar(false), 80)
                            }}
                            initialFocus
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={clearDateFilters} className="flex-1 rounded-xl">Clear</Button>
                    <Button
                      onClick={() => {
                        setShowFilters(false)
                        // Give the dealer clear feedback that the filter was
                        // applied — otherwise the green "Filtered" badge on
                        // the filter chip looks identical to a stuck/pressed
                        // state and they can't tell if anything happened.
                        if (dateFrom || dateTo) {
                          toast.success('Filter applied', {
                            description: `Showing deliveries ${dateFrom ? `from ${formatDateLong(dateFrom.toISOString())}` : ''}${dateFrom && dateTo ? ' to ' : ''}${dateTo ? `to ${formatDateLong(dateTo.toISOString())}` : ''}.`,
                          })
                        } else {
                          toast.info('No filter selected', {
                            description: 'Pick a From and/or To date, then Apply.',
                          })
                        }
                      }}
                      className="flex-1 rounded-xl bg-lime-500 text-slate-950"
                    >Apply</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={handleExportCSV} className="h-12 px-4 rounded-2xl hidden sm:flex"><Download className="h-5 w-5 mr-2" />Export</Button>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="px-4 py-3">
        <div className="max-w-[980px] mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[{ id: 'LISTED', label: 'Listed', icon: <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />, count: stats.listed }, { id: 'BOOKED', label: 'Booked', icon: <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />, count: stats.booked }, { id: 'ACTIVE', label: 'Active', icon: <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4" />, count: stats.active }, { id: 'EXPIRED', label: 'Expired', icon: <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />, count: stats.expired }, { id: 'HISTORY', label: 'History', icon: <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />, count: deliveries.filter(d => ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(d.status)).length }].map((tab) => (
              <Button key={tab.id} variant={activeFilter === tab.id ? "default" : "outline"} className={cn("flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full h-auto shrink-0", activeFilter === tab.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900")} onClick={() => setActiveFilter(tab.id)}>
                {tab.icon}<span className="font-bold text-xs sm:text-sm">{tab.label}</span>{tab.count > 0 && <Badge variant="secondary" className="ml-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full">{tab.count}</Badge>}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <main className="px-4 py-2">
        <div className="max-w-[980px] mx-auto space-y-4">
          <Button variant="outline" onClick={handleExportCSV} className="w-full h-12 rounded-2xl sm:hidden"><Download className="h-5 w-5 mr-2" />Export {filteredDeliveries.length} Deliveries</Button>
          {filteredDeliveries.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">{activeFilter === 'ACTIVE' ? <Navigation className="h-8 w-8 text-slate-400" /> : activeFilter === 'HISTORY' ? <History className="h-8 w-8 text-slate-400" /> : activeFilter === 'EXPIRED' ? <Timer className="h-8 w-8 text-slate-400" /> : <Package className="h-8 w-8 text-slate-400" />}</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">No {activeFilter.toLowerCase()} deliveries</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{activeFilter === 'ACTIVE' ? "You don't have any active deliveries right now" : activeFilter === 'HISTORY' ? "Completed and past deliveries will appear here" : activeFilter === 'EXPIRED' ? "Expired listings will appear here. You can reactivate them." : "Create a new delivery to get started"}</p>
                {!['HISTORY', 'EXPIRED'].includes(activeFilter) && <Link to="/dealer-create-delivery" className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-600 transition"><Plus className="h-5 w-5" />New Delivery</Link>}
              </CardContent>
            </Card>
          ) : (
            filteredDeliveries.map((delivery) => {
              const config = statusConfig[delivery.status] || statusConfig.LISTED
              return (
                <Card key={delivery.id} className={cn("border-2 rounded-3xl overflow-hidden transition-all hover:shadow-lg", config.borderColor, delivery.status === 'ACTIVE' && "ring-2 ring-lime-500/20")}>
                  <div className={cn("px-4 py-2 flex items-center justify-between", config.bgColor)}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2.5 h-2.5 rounded-full", config.dotColor, delivery.status === 'ACTIVE' && "animate-pulse")} />
                      <span className={cn("text-sm font-black uppercase tracking-wider", config.textColor)}>{config.label}</span>
                      {delivery.status === 'ACTIVE' && <Badge className="ml-2 bg-lime-500 text-slate-950 text-[10px] animate-pulse"><Activity className="h-3 w-3 mr-1" />LIVE</Badge>}
                      {delivery.status === 'CLOSED' && <Badge className="ml-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px]"><CheckSquare className="h-3 w-3 mr-1" />Closed by you</Badge>}
                    </div>
                    <div className="flex items-center gap-2"><span className="text-xs font-mono text-slate-500">#{delivery.ref}</span><span className="text-xs font-bold text-slate-400">{delivery.miles.toFixed(1)} mi</span></div>
                  </div>
                  <CardContent className="p-4">
                    {delivery.status === 'ACTIVE' && (
                      <div className="mb-4 p-3 rounded-2xl bg-lime-50 dark:bg-lime-950/20 border border-lime-200 dark:border-lime-800">
                        {/* TODO: Re-enable with real progress from tracking data instead of random mock */}
                        {/* <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Timer className="h-4 w-4 text-lime-600" /><span className="text-sm font-bold text-lime-700 dark:text-lime-400">{formatDuration(delivery.etaMinutes)} remaining</span></div><span className="text-sm font-bold text-lime-600">{delivery.progress}%</span></div> */}
                        {/* <Progress value={delivery.progress} className="h-2 bg-lime-200 dark:bg-lime-900" /> */}
                        <div className="flex items-center justify-between text-xs text-lime-600 dark:text-lime-400"><span>{delivery.pickup}</span><ArrowRight className="h-3 w-3" /><span>{delivery.dropoff}</span></div>
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">{delivery.carPhoto ? <img src={delivery.carPhoto} alt={`${delivery.vehicle.color} ${delivery.vehicle.make}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Car className="h-8 w-8 text-slate-300" /></div>}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-900 dark:text-white truncate">{[delivery.vehicle.make, delivery.vehicle.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{delivery.vehicle.color} • {delivery.vehicle.licensePlate || 'No plate'}</div>
                        <div className="mt-2 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-lime-500 shrink-0" /><span className="truncate text-slate-600 dark:text-slate-300">{delivery.pickup}</span></div>
                        <div className="flex items-center gap-2 text-sm"><Flag className="h-4 w-4 text-red-500 shrink-0" /><span className="truncate text-slate-600 dark:text-slate-300">{delivery.dropoff}</span></div>
                      </div>
                      <div className="text-right"><div className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(delivery.price)}</div><div className="text-[10px] font-bold text-slate-400 uppercase">Est.</div></div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400"><div className="flex items-center gap-4"><div className="flex items-center gap-1.5"><CalendarIcon className="h-4 w-4" /><span>{delivery.scheduleDate}</span></div><div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /><span>{delivery.scheduleTime}</span></div></div>{delivery.pickupPin && (<span className="text-sm font-bold text-green-600 dark:text-green-400">PIN: {delivery.pickupPin}</span>)}</div>
                    {delivery.driver && (
                      <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-lime-500 cursor-pointer" onClick={() => { if (delivery.driver.avatar) { setPhotoDialogSrc(delivery.driver.avatar); setPhotoDialogTitle(delivery.driver.name); setPhotoDialogOpen(true); }}}><AvatarImage src={delivery.driver.avatar} alt={delivery.driver.name} /><AvatarFallback className="bg-lime-100 text-lime-700 font-bold">{delivery.driver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                          <div><div className="font-bold text-slate-900 dark:text-white">{delivery.driver.name}</div><div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">{delivery.driver.rating && <><Sparkles className="h-3 w-3 text-amber-500" /><span>{delivery.driver.rating.toFixed(1)}</span></>}{delivery.driver.verified && <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 border-lime-500 text-lime-600">Verified</Badge>}</div></div>
                        </div>
                        <div className="flex items-center gap-2"><a href={`sms:${delivery.driver.phone}`} className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 hover:bg-blue-200 transition"><MessageSquare className="h-5 w-5" /></a><a href={`tel:${delivery.driver.phone}`} className="w-10 h-10 rounded-xl bg-lime-500 flex items-center justify-center text-slate-950 hover:bg-lime-600 transition"><Phone className="h-5 w-5" /></a></div>
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      {delivery.status === 'ACTIVE' ? (
                        <><Link to="/dealer-delivery-details" search={{ id: delivery.id }} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-600 transition"><Navigation className="h-5 w-5" />Live Tracking<ChevronRight className="h-5 w-5" /></Link><button onClick={() => openActionDialog(delivery.id, 'ACTIVE')} className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 hover:bg-emerald-200 transition" title="Close Delivery"><CheckSquare className="h-5 w-5" /></button></>
                      ) : delivery.status === 'BOOKED' ? (
                        <><Link to="/dealer-delivery-details" search={{ id: delivery.id }} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition"><Eye className="h-5 w-5" />View</Link><button onClick={() => openActionDialog(delivery.id, 'BOOKED')} className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition" title="Manage Delivery"><Settings className="h-5 w-5" /></button>{delivery.driver && <a href={`tel:${delivery.driver.phone}`} className="w-12 h-12 rounded-2xl bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-lime-600 hover:bg-lime-200 transition"><Phone className="h-5 w-5" /></a>}</>
                      ) : delivery.status === 'LISTED' || delivery.status === 'QUOTED' || delivery.status === 'EXPIRED' ? (
                        <Link to="/dealer-edit-delivery" state={{ id: delivery.id }} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition"><Edit3 className="h-5 w-5" />{delivery.status === 'EXPIRED' ? 'Reactivate' : 'Edit'}</Link>
                      ) : (
                        // History tab: COMPLETED / CANCELLED — show View Details + Rate & Tip Driver
                        <div className="flex gap-2 w-full">
                          <Link to="/dealer-delivery-details" search={{ id: delivery.id }} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition text-sm"><Eye className="h-4 w-4" />View Details</Link>
                          {delivery.status === 'COMPLETED' && delivery.driver && (
                            <Link
                              to="/dealer-delivery-details"
                              search={{ id: delivery.id }}
                              className={cn(
                                "flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition text-sm",
                                ratedDeliveryIds.has(delivery.id) && tippedDeliveryIds.has(delivery.id)
                                  ? "bg-green-500 text-white hover:bg-green-600"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700"
                              )}
                            >
                              {ratedDeliveryIds.has(delivery.id) && tippedDeliveryIds.has(delivery.id) ? (
                                <><CheckCircle2 className="h-4 w-4" />Done</>
                              ) : (
                                <><Star className="h-4 w-4" />Rate & Tip Driver</>
                              )}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </main>
      {dealerId && (
        <div className="px-4 pt-4 max-w-[980px] mx-auto">
          <ReferralCodeCard referrerType="CUSTOMER" collapsible />
        </div>
      )}
      {/* Quick Action Dialog — Manage / Close Delivery */}
      <AlertDialog open={!!actionDialogDeliveryId} onOpenChange={(open) => { if (!open) { setActionDialogDeliveryId(null); setActionDialogStatus(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialogStatus === 'BOOKED' ? 'Manage Delivery' : 'Close Delivery'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialogStatus === 'BOOKED'
                ? 'This delivery is booked but not yet started. You can complete it now or revert it to Listed so another driver can pick it up.'
                : 'Are you sure you want to close this delivery? This will move it to Closed and cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transitionMutation.isPending}>Cancel</AlertDialogCancel>
            {actionDialogStatus === 'BOOKED' && (
              <button
                onClick={() => handleTransition('LISTED', 'Dealer reverted delivery to Listed')}
                disabled={transitionMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-extrabold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
              >
                <RefreshCw className="h-4 w-4" />
                {transitionMutation.isPending ? 'Reverting...' : 'Revert to Listed'}
              </button>
            )}
            <button
              onClick={() => handleTransition('CLOSED', 'Dealer manually closed delivery')}
              disabled={transitionMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold disabled:opacity-50 transition"
            >
              <CheckSquare className="h-4 w-4" />
              {transitionMutation.isPending ? 'Closing...' : 'Close Delivery'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notification Settings Dialog */}
      <Dialog open={notificationSettingsOpen} onOpenChange={setNotificationSettingsOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-black flex items-center gap-2"><Bell className="h-5 w-5" />Notification Settings</DialogTitle><DialogDescription>Choose how you want to receive updates about your deliveries.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3"><div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Channels</div>
              {[{ key: 'pushEnabled', icon: <Smartphone className="h-5 w-5 text-lime-500" />, label: 'Push Notifications', desc: 'Instant alerts on your device' }, { key: 'emailEnabled', icon: <Mail className="h-5 w-5 text-blue-500" />, label: 'Email', desc: 'Daily summaries and receipts' }, { key: 'smsEnabled', icon: <Phone className="h-5 w-5 text-green-500" />, label: 'SMS', desc: 'Text message alerts' }].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><div className="flex items-center gap-3">{item.icon}<div><div className="font-bold">{item.label}</div><div className="text-xs text-slate-500">{item.desc}</div></div></div><Switch checked={notificationSettings[item.key]} onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, [item.key]: checked })} /></div>
              ))}
            </div>
            <div className="space-y-3"><div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Alert Types</div>
              {[{ key: 'statusUpdates', label: 'Status Updates', desc: 'When delivery status changes' }, { key: 'driverAssigned', label: 'Driver Assigned', desc: 'When a driver books your delivery' }, { key: 'deliveryComplete', label: 'Delivery Complete', desc: 'When delivery is finished' }, { key: 'newMessages', label: 'New Messages', desc: 'Messages from drivers' }].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><div><div className="font-bold">{item.label}</div><div className="text-xs text-slate-500">{item.desc}</div></div><Switch checked={notificationSettings[item.key]} onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, [item.key]: checked })} /></div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex gap-3"><Button variant="outline" onClick={() => setNotificationSettingsOpen(false)} className="flex-1 rounded-2xl">Cancel</Button><Button onClick={handleSaveNotificationSettings} className="flex-1 rounded-2xl bg-lime-500 text-slate-950">Save Settings</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-4">
          <div className="flex items-center justify-around h-16">
            <Link to="/dealer-create-delivery" className="flex flex-col items-center gap-1 py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-lime-600 dark:hover:text-lime-400 transition"><Plus className="h-6 w-6" /><span className="text-[10px] font-bold uppercase tracking-wider">Create</span></Link>
            <Link to="/dealer-dashboard" className="flex flex-col items-center gap-1 py-2 px-4 text-lime-600 dark:text-lime-400"><Navigation className="h-6 w-6" /><span className="text-[10px] font-bold uppercase tracking-wider">Active</span></Link>
            <Link to="/dealer-drafts" className="flex flex-col items-center gap-1 py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-lime-600 dark:hover:text-lime-400 transition"><FileText className="h-6 w-6" /><span className="text-[10px] font-bold uppercase tracking-wider">Drafts</span></Link>
            <Link to="/dealer-settings" className="flex flex-col items-center gap-1 py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-lime-600 dark:hover:text-lime-400 transition"><User className="h-6 w-6" /><span className="text-[10px] font-bold uppercase tracking-wider">Profile</span></Link>
          </div>
        </div>
      </nav>

      {/* Floating Action Button — must clear the bottom nav's FULL iPhone
          height (h-16 content + home-indicator safe inset) plus a 12px gap,
          otherwise the nav covers its lower half. The old bottom-20 (80px)
          assumed a 64px nav with no safe area. */}
      <Link to="/dealer-create-delivery" className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] w-14 h-14 rounded-2xl bg-lime-500 text-slate-950 flex items-center justify-center shadow-lg shadow-lime-500/30 hover:bg-lime-600 hover:scale-105 transition-all z-40 sm:hidden"><Plus className="h-7 w-7" /></Link>

      {/* Photo Dialog for driver avatar */}
      <PhotoDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        src={photoDialogSrc}
        title={photoDialogTitle}
      />
    </div>
  )
}
