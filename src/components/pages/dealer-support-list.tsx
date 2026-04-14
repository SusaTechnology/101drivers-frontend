// Dealer Support Request List Page
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  Plus,
  Eye,
  MessageSquare,
  Clock,
  Package,
  CreditCard,
  XCircle,
  Gavel,
  HelpCircle,
  Truck,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORIES_BY_ROLE,
  type SupportRequestStatus,
  type SupportRequestCategory,
  type SupportRequestPriority,
  type ListSupportRequestsResponse,
  type SupportRequestListItem,
} from '@/types/support'

// Status badge component
const StatusBadge = ({ status }: { status: SupportRequestStatus }) => {
  const config = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30',
    slate: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  }
  return (
    <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", colorClasses[config.color])}>
      {config.label}
    </Badge>
  )
}

// Priority badge
const PriorityBadge = ({ priority }: { priority: SupportRequestPriority }) => {
  const config = PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1]
  const colorClasses: Record<string, string> = {
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    slate: 'text-slate-500',
  }
  return (
    <span className={cn("text-[10px] font-bold uppercase", colorClasses[config.color])}>
      {config.label}
    </span>
  )
}

// Category icon
const CategoryIcon = ({ category }: { category: SupportRequestCategory }) => {
  const icons: Record<SupportRequestCategory, React.ReactNode> = {
    DELIVERY_ISSUE: <Package className="h-4 w-4" />,
    PAYMENT_ISSUE: <CreditCard className="h-4 w-4" />,
    SCHEDULE_CHANGE: <Clock className="h-4 w-4" />,
    CANCELLATION_REQUEST: <XCircle className="h-4 w-4" />,
    DISPUTE_HELP: <Gavel className="h-4 w-4" />,
    DRIVER_ISSUE: <Truck className="h-4 w-4" />,
    GENERAL: <HelpCircle className="h-4 w-4" />,
  }
  return <>{icons[category] || <HelpCircle className="h-4 w-4" />}</>
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function DealerSupportList() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const dealerId = user?.profileId

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Determine customer type
  const isPrivateCustomer = user?.userType === 'PRIVATE_CUSTOMER'

  // Fetch support requests
  const {
    data: supportData,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<ListSupportRequestsResponse>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests/my${statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''}`,
    noFilter: true,
    enabled: !!dealerId,
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

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/dealer-signin' })
  }

  // Header
  const Header = () => (
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
              {isPrivateCustomer ? 'Customer Portal' : 'Dealer Portal'}
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              My Support Requests
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dealer-dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-support-request"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              New Support Request
            </Link>
            <Separator className="my-2" />
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      )}
    </header>
  )

  // Footer
  const Footer = () => (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers logo"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              California-only operations • Email-first notifications
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">© {new Date().getFullYear()} 101 Drivers Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading support requests...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="w-full max-w-[1000px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Page header */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
              <Headphones className="h-7 w-7 text-lime-500" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
                My Support Requests
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Track and manage your support requests. Click to view details and replies.
              </p>
            </div>
          </div>

          <Link
            to="/dealer-support-request"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold"
          >
            <Plus className="h-4 w-4" />
            New Request
          </Link>
        </section>

        {/* Filters */}
        <Card className="border-slate-200 dark:border-slate-800 rounded-3xl mb-6">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-10 rounded-xl">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            <div className="sm:ml-auto text-sm text-slate-600 dark:text-slate-400">
              {supportData?.count || 0} request{(supportData?.count || 0) !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>

        {/* Support requests list */}
        {supportRequests.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                No support requests
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
                You haven't submitted any support requests yet. If you need help, click the button below.
              </p>
              <Link
                to="/dealer-support-request"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold"
              >
                <Plus className="h-4 w-4" />
                Create Support Request
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {supportRequests.map((request) => (
              <Card
                key={request.id}
                className="border-slate-200 dark:border-slate-800 rounded-3xl hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate({ to: '/dealer-support-detail', state: { id: request.id } })}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <CategoryIcon category={request.category} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <StatusBadge status={request.status} />
                          <PriorityBadge priority={request.priority} />
                        </div>
                        <h3 className="font-black text-slate-900 dark:text-white">
                          {request.subject}
                        </h3>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {request.deliveryId && (
                            <span className="mr-3">
                              Delivery: #{request.deliveryId.slice(-6).toUpperCase()}
                            </span>
                          )}
                          <span>Created: {formatDate(request.createdAt)} at {formatTime(request.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate({ to: '/dealer-support-detail', state: { id: request.id } })
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

// Add missing import
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={cn("text-sm font-medium", className)}>{children}</label>
}
