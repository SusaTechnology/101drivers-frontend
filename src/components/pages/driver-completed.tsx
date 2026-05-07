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
  Package,
  ChevronRight,
  CheckCircle,
  Truck as LocalShipping,
  DollarSign,
  Loader2,
  Inbox,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'
import DriverBottomNav from '@/components/layout/DriverBottomNav'

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

// ── Main Page ───────────────────────────────────────────────────────

export default function DriverCompletedPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()
  const driverId = user?.profileId

  // Fetch driver's delivery assignments (completed)
  const { data: assignmentsData, isLoading, isError, refetch } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryAssignments?filter={"driverId":{"equals":"${driverId}"},"status":{"in":["DROPPED","COMPLETED"]}}&orderBy={"completedAt":"desc"}&take=50`,
    noFilter: true,
    enabled: Boolean(driverId),
  })

  const completedDeliveries = Array.isArray(assignmentsData)
    ? assignmentsData
    : (assignmentsData?.items || [])

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
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Driver
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Completed Deliveries
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

      {/* ── Main Content ── */}
      <main className="max-w-[980px] mx-auto px-5 sm:px-6 py-6 pb-28">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Completed
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your finished deliveries.
          </p>
        </div>

        {isError ? (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Failed to load deliveries</p>
            <Button
              variant="outline"
              className="mt-4 rounded-2xl"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : completedDeliveries.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">
              No completed deliveries yet
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
              Once you finish a delivery, it will appear here.
            </p>
            <Link to="/driver-dashboard">
              <Button className="mt-6 rounded-2xl bg-primary hover:bg-primary/90 text-slate-950 font-extrabold">
                Browse Gigs
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {completedDeliveries.map((item: any) => {
              const delivery = item.delivery || {}
              return (
                <Link
                  key={item.id}
                  to="/driver-job-details"
                  search={{ jobId: delivery.id }}
                  className="block"
                >
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[11px] font-bold border-0 rounded-lg">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                        {delivery.isUrgent && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[11px] font-bold border-0 rounded-lg">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      {item.completedAt && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {formatDate(item.completedAt)}
                        </span>
                      )}
                    </div>

                    {/* Route info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex flex-col items-center mt-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <div className="w-0.5 h-8 bg-slate-200 dark:bg-slate-700" />
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Pickup</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {extractRouteLabel(delivery.pickupAddress || '')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Drop-off</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {extractRouteLabel(delivery.dropoffAddress || '')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {delivery.pickupWindowStart ? formatTime(delivery.pickupWindowStart) : '--'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {delivery.vehicleType || '--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {delivery.payoutAmount != null && (
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(delivery.payoutAmount)}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Bottom Navigation ── */}
      <DriverBottomNav activeTab="completed" />
    </div>
  )
}
