// app/pages/driver/job-details.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Bolt,
  QrCode,
  Camera,
  Gauge as Speed,
  Route,
  Info,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getUser, useCreate, useDataQuery } from '@/lib/tanstack/dataQuery'

// Helper functions (same as dashboard)
const formatDate = (isoString?: string): string => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const formatTimeRange = (startIso?: string, endIso?: string): string => {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endStr = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${startStr}–${endStr}`
}

const formatDuration = (minutes?: number): string => {
  if (!minutes) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

const formatCurrency = (amount?: number | null): string => {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const getShortAddress = (address?: string): string => {
  if (!address) return ''
  const parts = address.split(',')
  return parts[0] // first part before comma
}

// Service type mapping
const serviceTypeLabels: Record<string, string> = {
  HOME_DELIVERY: 'Home Delivery',
  BETWEEN_LOCATIONS: 'Between Locations',
  SERVICE_PICKUP_RETURN: 'Pickup & Return',
}

// Bottom action buttons (unchanged)
const bottomActions = [
  {
    label: 'Book This Job',
    primary: true,
    action: 'book',
  },
  {
    label: 'Message Ops',
    primary: false,
    action: 'message',
  },
]

export default function DriverJobDetailsPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const { jobId } = useSearch({ strict: false }) as { jobId: string }

  // Fetch real job details
  const { data, isLoading, isError, error } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${user?.profileId}/${jobId}`,
    noFilter: true,
    enabled: Boolean(jobId && user?.profileId)
  })

  // Book job mutation
  const bookJob = useCreate(`${import.meta.env.VITE_API_URL}/api/deliveryRequests/${jobId}/book`, {
    onSuccess: () => {
      toast.success('Job booked successfully!', {
        description: 'You have been assigned to this delivery.',
      })
      navigate({ to: `/driver-pickup-checklist`,search: { jobId }}) 
    },
    onError: (error) => {
      toast.error('Failed to book job', {
        description: error.message,
      })
    }
  })

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
    navigate({ to: '/auth/dealer-signin?userType=driver' })
  }

  const handleBookJob = () => {
    if (!user?.profileId || !user?.id) {
      toast.error('User not authenticated')
      return
    }
    bookJob.mutate({
      driverId: user.profileId,
      bookedByUserId: user.id,
      reason: '' // optional note, can be empty string
    })
  }

  const handleMessageOps = () => {
    toast.info('Opening message to Ops', {
      description: 'You can now send a message to operations.',
    })
    // Navigate to messaging or open modal
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
        <header className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/driver-dashboard"
                className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Delivery
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Loading...
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="w-10 h-10 rounded-2xl" onClick={toggleTheme}>
                {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button onClick={handleSignOut} variant="link" className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition p-0 h-auto">
                Sign Out
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-32">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">Loading job details...</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Error state
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
        <header className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/driver-dashboard"
                className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Delivery
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Error
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="w-10 h-10 rounded-2xl" onClick={toggleTheme}>
                {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button onClick={handleSignOut} variant="link" className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition p-0 h-auto">
                Sign Out
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-32">
          <Card className="border-red-200 dark:border-red-900 shadow-lg">
            <CardContent className="p-8 text-center">
              <p className="text-red-600 dark:text-red-400">Failed to load job details. Please try again.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Data is available – extract fields
  const job = data

  // Compute display values
  const route = `${getShortAddress(job.pickupAddress)} → ${getShortAddress(job.dropoffAddress)}`
  const serviceLabel = serviceTypeLabels[job.serviceType] || job.serviceType
  const typeLabel = job.originSource === 'homeBase' ? 'Near home base' : 'Matched job'
  const urgent = job.isUrgent
  const bonus = job.urgentBonusAmount
  const payout = job.payoutPreviewAmount
  const basePay = payout && bonus ? payout - bonus : payout // estimate if needed, but we don't have basePay separate
  const miles = job.pickupDistanceMiles // could also be trip distance, but pickupDistanceMiles is given
  const windowDate = formatDate(job.pickupWindowStart)
  const windowTime = formatTimeRange(job.pickupWindowStart, job.pickupWindowEnd)
  const window = `${windowDate} • ${windowTime}`
  const driveTime = formatDuration(job.etaMinutes)

  // Static requirements (could be dynamic later)
  const pickupRequirements = [
    { icon: QrCode, label: 'VIN last-4' },
    { icon: Camera, label: '6 Pickup Photos' },
    { icon: Speed, label: 'Odometer Start' },
  ]
  const dropoffRequirements = [
    { icon: Camera, label: '6 Drop-off Photos' },
    { icon: Speed, label: 'Odometer End' },
    { icon: Route, label: 'Tap Complete' },
  ]

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-dashboard"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Delivery
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {route}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
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
              variant="link"
              className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition p-0 h-auto"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-32">
        {/* Summary Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                {urgent && (
                  <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold">
                    <Bolt className="w-4 h-4 text-amber-500" />
                    Urgent
                  </Badge>
                )}

                <h1 className="mt-4 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {route}
                </h1>

                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Service: {serviceLabel} • {typeLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">Status: {job.status}</p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-3xl font-black text-primary">
                  {formatCurrency(payout)}
                </p>
                {bonus ? (
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Includes {formatCurrency(bonus)} bonus
                  </p>
                ) : (
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    No bonus
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Miles
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                  {miles ? `${miles} mi` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Window
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                  {window}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Est. Drive Time
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                  {driveTime}
                </p>
              </div>
            </div>

            {/* Additional fields: afterHours, matchScore */}
            {(job.afterHours || job.matchScore != null) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {job.afterHours && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-300">
                    After Hours
                  </Badge>
                )}
                {job.matchScore != null && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-300">
                    Match Score: {job.matchScore}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pickup Requirements */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">Required at Pickup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {pickupRequirements.map((req, index) => (
                <Badge 
                  key={index}
                  variant="outline" 
                  className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <req.icon className="w-4 h-4 text-primary mr-1" />
                  {req.label}
                </Badge>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
              You cannot tap "Start Delivery" until all checklist items are completed.
            </p>
          </CardContent>
        </Card>

        {/* Drop-off Requirements */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">Required at Drop-off</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {dropoffRequirements.map((req, index) => (
                <Badge 
                  key={index}
                  variant="outline" 
                  className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <req.icon className="w-4 h-4 text-primary mr-1" />
                  {req.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Job Details Card – shows all remaining fields */}
        <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery ID</p>
                <p className="font-medium">{job.deliveryId}</p>
              </div> */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Type</p>
                <p className="font-medium">{serviceLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                <p className="font-medium">{job.status}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match Score</p>
                <p className="font-medium">{job.matchScore ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match Reasons</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {job.matchReasons?.map((reason: string, i: number) => (
                    <Badge key={i} variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100">
                      {reason}
                    </Badge>
                  )) || '—'}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup Distance (mi)</p>
                <p className="font-medium">{job.pickupDistanceMiles ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup ETA (min)</p>
                <p className="font-medium">{job.pickupEtaMinutes ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Origin Source</p>
                <p className="font-medium">{job.originSource}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">After Hours</p>
                <p className="font-medium">{job.afterHours ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created At</p>
                <p className="font-medium">{new Date(job.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Notes */}
        <Alert className="mt-6 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
            Important Policy
          </AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-sm mt-1">
            No cancellation from Driver UI. If an issue occurs, report it through Support. All actions are logged for audit purposes.
          </AlertDescription>
        </Alert>
      </main>

      {/* Bottom Action Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleBookJob}
              disabled={bookJob.isPending}
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bookJob.isPending ? 'Booking...' : 'Book This Job'}
            </Button>

            <Button
              onClick={handleMessageOps}
              variant="outline"
              className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-extrabold hover:bg-primary/5 transition"
            >
              Message Ops
            </Button>
          </div>
        </div>
      </nav>
    </div>
  )
}