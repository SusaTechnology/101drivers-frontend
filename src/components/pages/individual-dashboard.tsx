//@ts-nocheck
/**
 * IndividualDashboard — dashboard for personal (private) customers.
 *
 * Simpler than the dealer dashboard — no postpaid billing, no drafts,
 * no bulk operations. Just:
 *   • Active deliveries (in progress)
 *   • Recent delivery history
 *   • "Request a Delivery" CTA
 *   • Quick links to settings
 *
 * Reuses the same API endpoints as the dealer dashboard
 * (/api/customers/:id/deliveries) since private customers are also
 * Customer rows.
 */
import React, { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from '@/lib/theme'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Home,
  Truck,
  Plus,
  Clock,
  CheckCircle,
  User,
  LogOut,
  History,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  Package,
  MapPin,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Settings,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, clearAuth, stopSessionKeepAlive } from '@/lib/tanstack/dataQuery'
import NotificationBell from '@/components/notifications/NotificationBell'
import { BUSINESS_TZ } from '@/lib/timezone'

// ── Helpers ─────────────────────────────────────────────────────────────
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TZ })
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TZ })
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null) return '—'
  return `$${amount.toFixed(2)}`
}

// Status badge colors
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'LISTED':
      return { label: 'Finding driver', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
    case 'BOOKED':
      return { label: 'Driver assigned', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
    case 'ACTIVE':
      return { label: 'In transit', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' }
    case 'COMPLETED':
      return { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' }
    case 'CLOSED':
      return { label: 'Closed', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
    case 'DRAFT':
      return { label: 'Draft', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
    case 'EXPIRED':
      return { label: 'Expired', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' }
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
  }
}

// ── Component ───────────────────────────────────────────────────────────
export default function IndividualDashboard() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const user = getUser()
  const customerId = user?.profileId

  // Fetch customer profile
  const { data: profile } = useDataQuery<{
    id: string
    contactName: string | null
    contactEmail: string | null
    customerType: string
  }>({
    apiEndPoint: customerId ? `${import.meta.env.VITE_API_URL}/api/customers/${customerId}` : '',
    noFilter: true,
    enabled: Boolean(customerId),
  })

  // Fetch deliveries (same endpoint as dealer dashboard)
  const { data: deliveriesData, isLoading, isFetching, isError, error, refetch } = useDataQuery({
    apiEndPoint: customerId ? `${import.meta.env.VITE_API_URL}/api/customers/${customerId}/deliveries` : '',
    queryKey: ['individual-deliveries', customerId],
    noFilter: true,
    enabled: Boolean(customerId),
    staleTime: 0,
    refetchInterval: 30 * 1000,
  })

  const deliveries: any[] = deliveriesData?.items || deliveriesData || []

  // Split into active and history
  const activeStatuses = ['LISTED', 'BOOKED', 'ACTIVE', 'DRAFT']
  const activeDeliveries = deliveries.filter((d: any) => activeStatuses.includes(d.status))
  const pastDeliveries = deliveries
    .filter((d: any) => !activeStatuses.includes(d.status))
    .slice(0, 5) // Show only 5 most recent

  const handleLogout = () => {
    stopSessionKeepAlive()
    clearAuth()
    navigate({ to: '/home' })
  }

  // ── Loading state ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md p-6 text-center border-slate-200 dark:border-slate-800 rounded-3xl">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
          <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950 rounded-2xl">
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  const displayName = profile?.contactName || user?.fullName || 'there'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[980px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-200">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
              </div>
            </Link>
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: BUSINESS_TZ })}
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">My Deliveries</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-xl">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 rounded-xl text-slate-500 hover:text-rose-500">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="max-w-[980px] mx-auto px-4 py-6 space-y-6">
        {/* Welcome + CTA */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Hi, {displayName.split(' ')[0]}!
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {activeDeliveries.length > 0
                ? `You have ${activeDeliveries.length} active ${activeDeliveries.length === 1 ? 'delivery' : 'deliveries'}.`
                : 'No active deliveries right now.'}
            </p>
          </div>
          <Button
            asChild
            className="bg-lime-500 text-slate-950 hover:bg-lime-400 rounded-2xl font-extrabold h-12 px-6"
          >
            <Link to="/home">
              <Plus className="w-4 h-4 mr-2" />
              Request a Delivery
            </Link>
          </Button>
        </section>

        {/* Active Deliveries */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-lime-500" />
              Active Deliveries
            </h2>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="text-xs">
              <RefreshCw className={cn("w-3 h-3 mr-1", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {activeDeliveries.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 rounded-2xl">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  No active deliveries
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Request a delivery to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeDeliveries.map((delivery: any) => (
                <DeliveryCard key={delivery.id} delivery={delivery} />
              ))}
            </div>
          )}
        </section>

        {/* Recent History */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Recent Deliveries
            </h2>
          </div>

          {pastDeliveries.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 rounded-2xl">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  No delivery history yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pastDeliveries.map((delivery: any) => (
                <DeliveryCard key={delivery.id} delivery={delivery} />
              ))}
            </div>
          )}
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <QuickLink
              to="/dealer-setting"
              icon={<Settings className="w-5 h-5" />}
              label="Settings"
              description="Saved cards & account"
            />
            <QuickLink
              to="/home"
              icon={<Plus className="w-5 h-5" />}
              label="New Delivery"
              description="Request a delivery"
            />
            <QuickLink
              to="/dealer-support-list"
              icon={<Bell className="w-5 h-5" />}
              label="Support"
              description="Get help"
            />
          </div>
        </section>
      </main>

      {/* ── Bottom nav (mobile) ────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[980px] mx-auto px-4 h-16 flex items-center justify-around">
          <Link to="/individual-dashboard" className="flex flex-col items-center gap-1 text-lime-600 dark:text-lime-400">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">Home</span>
          </Link>
          <Link to="/home" className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-bold">New</span>
          </Link>
          <Link to="/dealer-setting" className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-bold">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function DeliveryCard({ delivery }: { delivery: any }) {
  const statusBadge = getStatusBadge(delivery.status)
  const pickup = delivery.pickup?.address || delivery.pickupAddress || '—'
  const dropoff = delivery.dropoff?.address || delivery.dropoffAddress || '—'
  const price = delivery.quote?.estimatedPrice || delivery.estimatedPrice
  const distance = delivery.quote?.distanceMiles || delivery.distanceMiles
  const createdAt = delivery.createdAt || delivery.created_at

  return (
    <Link
      to="/dealer-delivery-details"
      search={{ id: delivery.id }}
      className="block"
    >
      <Card className="border-slate-200 dark:border-slate-800 rounded-2xl hover:border-lime-300 dark:hover:border-lime-700 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px] font-bold", statusBadge.className)}>
                {statusBadge.label}
              </Badge>
              <span className="text-xs text-slate-400">
                #{delivery.id.slice(-8).toUpperCase()}
              </span>
            </div>
            {price != null && (
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {formatCurrency(price)}
              </span>
            )}
          </div>

          {/* Route */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-lime-500 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pickup</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{pickup}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dropoff</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{dropoff}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {createdAt && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {formatDate(createdAt)}
                </span>
              )}
              {distance != null && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {distance.toFixed(1)} mi
                </span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function QuickLink({ to, icon, label, description }: {
  to: string
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <Link to={to as any}>
      <Card className="border-slate-200 dark:border-slate-800 rounded-2xl hover:border-lime-300 dark:hover:border-lime-700 transition-colors cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center text-lime-600 dark:text-lime-400 shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{label}</p>
              <p className="text-xs text-slate-400 truncate">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
