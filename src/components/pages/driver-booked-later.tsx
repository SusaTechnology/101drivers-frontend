// app/pages/driver/booked-later.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Sun,
  Moon,
  LogOut,
  MapPin,
  Clock,
  Car,
  Calendar,
  Navigation,
  Package,
  ChevronRight,
  CheckCircle,
  Truck as LocalShipping,
  DollarSign,
  Route as RouteIcon,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'

// ── Helpers ─────────────────────────────────────────────────────────

const formatTime = (isoString?: string | null): string => {
  if (!isoString) return '--'
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const formatCurrency = (amount?: number | null): string => {
  if (amount == null) return '--'
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

const formatTimeRange = (startIso?: string | null, endIso?: string | null): string => {
  if (!startIso || !endIso) return '--'
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${startStr} - ${endStr}`
}

// ── Main Page ───────────────────────────────────────────────────────

export default function DriverBookedLaterPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const driverId = user?.profileId

  // Fetch active + booked deliveries
  const { data: activeData, isLoading, isError, refetch } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/active-delivery/${driverId}`,
    noFilter: true,
    enabled: Boolean(driverId),
    refetchInterval: 15000,
  })

  const assignments = Array.isArray(activeData) ? activeData : []
  // Only show BOOKED deliveries (not ACTIVE — those are on the active delivery page)
  const bookedDeliveries = assignments.filter((a: any) => a.delivery?.status === 'BOOKED')

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

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 font-sans antialiased">
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-2xl" />
            <Skeleton className="h-4 w-48" />
          </div>
        </header>
        <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-white">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-dashboard"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Your Queue
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Booked for Later
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
              {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-24">
        {/* ── Page header ── */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            Booked for Later
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {bookedDeliveries.length > 0
              ? `You have ${bookedDeliveries.length} gig${bookedDeliveries.length > 1 ? 's' : ''} booked. Tap to start the pickup checklist when you're ready.`
              : 'No gigs booked yet. Browse available gigs and tap "Book for Later" to queue them up.'}
          </p>
        </div>

        {/* ── Empty state ── */}
        {bookedDeliveries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              No bookings yet
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
              When you find a gig you like, tap "Book for Later" on the gig details page to add it here.
            </p>
            <Link to="/driver-dashboard">
              <Button className="mt-6 rounded-2xl px-6 font-extrabold lime-btn">
                Browse Gigs
              </Button>
            </Link>
          </div>
        )}

        {/* ── Booked delivery cards ── */}
        {bookedDeliveries.length > 0 && (
          <div className="space-y-4">
            {bookedDeliveries.map((assignment: any, idx: number) => {
              const d = assignment.delivery
              const pickupLabel = extractRouteLabel(d.pickupAddress || '')
              const dropoffLabel = extractRouteLabel(d.dropoffAddress || '')
              const hasActiveDelivery = assignments.some((a: any) => a.delivery?.status === 'ACTIVE')

              return (
                <Card
                  key={d.id}
                  className={cn(
                    "border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-all cursor-pointer overflow-hidden group",
                    !hasActiveDelivery && "hover:border-primary/30"
                  )}
                  onClick={() => navigate({ to: '/driver-pickup-checklist', search: { jobId: d.id } as any })}
                >
                  <CardContent className="p-0">
                    {/* Top accent bar */}
                    <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

                    <div className="p-5 sm:p-6">
                      {/* Queue position + service type */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          #{idx + 1} in queue
                        </span>
                        {d.serviceType && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {d.serviceType.replace(/_/g, ' ')}
                          </span>
                        )}
                        {d.isUrgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Urgent
                          </span>
                        )}
                      </div>

                      {/* Route — main info */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-1 shrink-0">
                          <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-100 dark:ring-green-900/40" />
                          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mt-1" />
                          <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-100 dark:red-900/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {pickupLabel || d.pickupAddress || 'Pickup'}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {d.pickupAddress || '--'}
                          </p>
                          <div className="my-2" />
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {dropoffLabel || d.dropoffAddress || 'Dropoff'}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {d.dropoffAddress || '--'}
                          </p>
                        </div>

                        {/* Payout + nav arrow */}
                        <div className="text-right shrink-0">
                          {d.payoutPreviewAmount != null && (
                            <p className="text-xl font-black text-green-600 dark:text-green-400">
                              {formatCurrency(d.payoutPreviewAmount)}
                            </p>
                          )}
                          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-primary transition mt-1 ml-auto" />
                        </div>
                      </div>

                      {/* Bottom details row */}
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                        {/* Pickup time */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>{formatDate(d.pickupWindowStart)}</span>
                          {d.pickupWindowStart && (
                            <span className="font-bold">{formatTimeRange(d.pickupWindowStart, d.pickupWindowEnd)}</span>
                          )}
                        </div>

                        {/* Distance */}
                        {d.pickupDistanceMiles != null && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <Navigation className="w-3.5 h-3.5 text-primary" />
                            <span>{d.pickupDistanceMiles} mi</span>
                          </div>
                        )}

                        {/* Vehicle info */}
                        {(d.vehicleMake || d.vehicleModel) && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <Car className="w-3.5 h-3.5 text-primary" />
                            <span>{[d.vehicleColor, d.vehicleYear, d.vehicleMake, d.vehicleModel].filter(Boolean).join(' ')}</span>
                          </div>
                        )}

                        {/* Urgent bonus */}
                        {d.urgentBonusAmount != null && d.urgentBonusAmount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>+{formatCurrency(d.urgentBonusAmount)} bonus</span>
                          </div>
                        )}
                      </div>

                      {/* Warning if another delivery is active */}
                      {hasActiveDelivery && (
                        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-800 dark:text-amber-200 font-semibold">
                            Complete your current active delivery first, then come back to start this one.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── Info card at the bottom ── */}
        {bookedDeliveries.length > 0 && (
          <div className="mt-8 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <LocalShipping className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  How it works
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Tap any booked gig above to open the pickup checklist. Complete the checklist and tap "Start Trip" when you're at the pickup location.
                  If you have another delivery in progress, you'll need to complete it first.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Floating action button: browse gigs ── */}
      {bookedDeliveries.length >= 0 && (
      <DriverBottomNav activeTab="my-bookings" />

      )}
    </div>
  )
}
