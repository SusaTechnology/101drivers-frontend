// Driver Support List Page - View submitted support requests
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Menu,
  X,
  Headphones,
  Package,
  CreditCard,
  XCircle,
  Gavel,
  HelpCircle,
  Clock,
  Truck,
  Calendar,
  AlertCircle,
  CheckCircle,
  Plus,
  Inbox,
  Home,
  Car,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'
import {
  STATUS_OPTIONS,
  type SupportRequestListItem,
  type SupportRequestStatus,
  type SupportRequestCategory,
} from '@/types/support'

// Category icons
const categoryIcons: Record<SupportRequestCategory, React.ReactNode> = {
  DELIVERY_ISSUE: <Package className="h-4 w-4" />,
  PAYMENT_ISSUE: <CreditCard className="h-4 w-4" />,
  SCHEDULE_CHANGE: <Calendar className="h-4 w-4" />,
  CANCELLATION_REQUEST: <XCircle className="h-4 w-4" />,
  DISPUTE_HELP: <Gavel className="h-4 w-4" />,
  DRIVER_ISSUE: <Truck className="h-4 w-4" />,
  GENERAL: <HelpCircle className="h-4 w-4" />,
}

// Category labels
const categoryLabels: Record<SupportRequestCategory, string> = {
  DELIVERY_ISSUE: 'Delivery Issue',
  PAYMENT_ISSUE: 'Payment Issue',
  SCHEDULE_CHANGE: 'Schedule Change',
  CANCELLATION_REQUEST: 'Cancellation Request',
  DISPUTE_HELP: 'Dispute Help',
  DRIVER_ISSUE: 'Driver Issue',
  GENERAL: 'General',
}

// Status colors
const statusColors: Record<SupportRequestStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
}

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: Menu },
]

export default function DriverSupportListPage() {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<SupportRequestStatus | 'ALL'>('ALL')
  const { theme, setTheme } = useTheme()
  const user = getUser()

  // Fetch support requests
  const {
    data: supportData,
    isLoading,
    error,
    refetch,
  } = useDataQuery<{ items: SupportRequestListItem[]; count: number }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests/my${statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''}`,
    noFilter: true,
  })

  const supportRequests = supportData?.items || []

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  // Format date
  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Format time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-menu"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Driver Portal
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                My Support Requests
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
                <X className="w-4 h-4 text-yellow-500" />
              ) : (
                <X className="w-4 h-4 text-slate-600" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="max-w-[900px] mx-auto px-5 py-4 flex flex-col gap-2">
              <Link
                to="/driver-dashboard"
                className="px-4 py-3 rounded-2xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/driver-issue-report"
                className="px-4 py-3 rounded-2xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Submit New Request
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* Page header */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
                  <Headphones className="h-7 w-7 text-lime-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                    Support Requests
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Track your submitted requests and view responses from Operations.
                  </p>
                </div>
              </div>
              <Link
                to="/driver-issue-report"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold transition"
              >
                <Plus className="w-4 h-4" />
                New Request
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SupportRequestStatus | 'ALL')}>
            <SelectTrigger className="w-40 h-10 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-10 rounded-2xl"
          >
            Refresh
          </Button>
        </div>

        {/* Request list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Skeleton className="w-10 h-10 rounded-2xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
            <CardContent className="p-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">Failed to load requests</p>
                <p className="text-sm text-red-600 dark:text-red-300">Please try again later.</p>
              </div>
            </CardContent>
          </Card>
        ) : supportRequests.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-10 text-center">
              <Inbox className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No support requests</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {statusFilter !== 'ALL'
                  ? `No ${statusFilter.toLowerCase().replace('_', ' ')} requests found.`
                  : "You haven't submitted any support requests yet."}
              </p>
              <Link
                to="/driver-issue-report"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-600 transition"
              >
                <Plus className="w-4 h-4" />
                Submit a Request
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {supportRequests.map((request) => (
              <Link
                key={request.id}
                to="/driver-support-detail"
                state={{ id: request.id }}
                className="block"
              >
                <Card className="border-slate-200 dark:border-slate-800 hover:border-lime-500/50 hover:shadow-lg transition cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lime-500 shrink-0">
                          {categoryIcons[request.category]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-slate-900 dark:text-white truncate">
                            {request.subject}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {categoryLabels[request.category]}
                            </span>
                            {request.deliveryId && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Delivery #{request.deliveryId.slice(-6).toUpperCase()}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn("shrink-0 font-bold", statusColors[request.status])}>
                        {request.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Info note */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
            <span className="font-bold">Response time:</span> Our team typically responds within 2-4 hours during business hours. For urgent safety issues, call the emergency line.
          </div>
        </div>
      </main>

      {/* Bottom navigation */}
      <DriverBottomNav />

    </div>
  )
}
