// Dealer Support Request Detail Page
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Menu,
  X,
  Headphones,
  Send,
  Package,
  CreditCard,
  Clock,
  XCircle,
  Gavel,
  HelpCircle,
  Truck,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type SupportRequestStatus,
  type SupportRequestCategory,
  type SupportRequestPriority,
  type SupportRequestDetail,
  type ReplySupportRequestPayload,
  type ReplySupportRequestResponse,
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
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30',
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  }
  return (
    <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-widest", colorClasses[config.color])}>
      {config.label} Priority
    </Badge>
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

const formatDateTime = (dateString: string) => {
  return `${formatDate(dateString)} at ${formatTime(dateString)}`
}

// Role colors
const roleColors: Record<string, string> = {
  DEALER: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30',
  PRIVATE_CUSTOMER: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30',
  DRIVER: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30',
  ADMIN: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-900/30',
}

export default function DealerSupportDetail() {
  const { state } = useLocation()
  const id = state?.id
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const dealerId = user?.profileId

  const [replyMessage, setReplyMessage] = useState('')

  // Determine customer type
  const isPrivateCustomer = user?.userType === 'PRIVATE_CUSTOMER'

  // Fetch support request detail
  const {
    data: supportData,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<SupportRequestDetail>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests/${id}/detail`,
    noFilter: true,
    enabled: !!id,
  })

  // Reply mutation
  const replyMutation = useCreate<ReplySupportRequestPayload, ReplySupportRequestResponse>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/${id}/reply`,
    {
      onSuccess: () => {
        toast.success('Reply sent', { description: 'Your message has been added to the conversation.' })
        setReplyMessage('')
        refetch()
      },
      onError: (error: any) => {
        toast.error('Failed to send reply', { description: error.message || 'Please try again.' })
      },
    }
  )

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleReply = () => {
    if (!replyMessage.trim()) {
      toast.error('Message required', { description: 'Please enter your message.' })
      return
    }
    replyMutation.mutate({ message: replyMessage.trim() })
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
              Support Request
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dealer-support-list"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to List
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
              to="/dealer-support-list"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              My Support Requests
            </Link>
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dashboard
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
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading support request...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Error state
  if (isError || !supportData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Header />
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
            <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950">Retry</Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // Public notes only (filter out internal notes for non-admin)
  const publicNotes = supportData.notes?.filter(note => !note.isInternal) || []

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="w-full max-w-[900px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Request header */}
        <section className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
            <Headphones className="h-7 w-7 text-lime-500" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge status={supportData.status} />
              <PriorityBadge priority={supportData.priority} />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
              {supportData.subject}
            </h1>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Request ID: #{supportData.id.slice(-6).toUpperCase()} • Created {formatDateTime(supportData.createdAt)}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - conversation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Original message */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <CategoryIcon category={supportData.category} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      {supportData.category.replace(/_/g, ' ')}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">Original Request</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {supportData.message}
                </p>
              </CardContent>
            </Card>

            {/* Conversation thread */}
            {publicNotes.length > 0 && (
              <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Conversation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {publicNotes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        "p-4 rounded-2xl border",
                        note.authorRole === 'ADMIN'
                          ? "bg-lime-50/50 border-lime-200 dark:bg-lime-900/10 dark:border-lime-900/30"
                          : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", roleColors[note.authorRole] || roleColors.GENERAL)}>
                            {note.authorRole}
                          </Badge>
                          {note.authorName && (
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                              {note.authorName}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{formatTime(note.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {note.message}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Reply form (only if not closed) */}
            {supportData.status !== 'CLOSED' && supportData.status !== 'RESOLVED' && (
              <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Reply</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply here..."
                    rows={4}
                    className="rounded-2xl"
                  />
                  <Button
                    onClick={handleReply}
                    disabled={replyMutation.isPending || !replyMessage.trim()}
                    className="w-full py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold gap-2"
                  >
                    {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                    <Send className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Resolved/Closed notice */}
            {(supportData.status === 'CLOSED' || supportData.status === 'RESOLVED') && (
              <Card className="border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    This request has been {supportData.status.toLowerCase()}
                  </h3>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
                    If you need further assistance, please create a new support request.
                  </p>
                  <Link
                    to="/dealer-support-request"
                    className="inline-flex items-center gap-2 mt-4 px-5 py-3 rounded-2xl bg-emerald-500 text-white font-extrabold hover:bg-emerald-600"
                  >
                    Create New Request
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - details */}
          <div className="space-y-6">
            {/* Request details */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-lg font-black">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Created</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatDateTime(supportData.createdAt)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <RefreshCw className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Last Updated</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatDateTime(supportData.updatedAt)}
                    </div>
                  </div>
                </div>

                {supportData.assignedToUser && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Assigned To</div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {supportData.assignedToUser.fullName}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Related delivery */}
            {supportData.delivery && (
              <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Related Delivery</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Delivery ID</div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      #{supportData.delivery.id.slice(-6).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Route</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {supportData.delivery.pickupAddress?.split(',')[0]} → {supportData.delivery.dropoffAddress?.split(',')[0]}
                    </div>
                  </div>
                  <Link
                    to="/dealer-delivery-details"
                    state={{ id: supportData.delivery.id }}
                    className="inline-flex items-center gap-2 text-sm font-bold text-lime-600 hover:text-lime-500"
                  >
                    View Delivery →
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
              <CardContent className="p-5 space-y-3">
                <Link
                  to="/dealer-support-list"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to List
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
