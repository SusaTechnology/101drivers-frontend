// Dealer Support Request Detail Page
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { useTheme } from '@/lib/theme'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
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
import { BUSINESS_TZ } from '@/lib/timezone'
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TZ })
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BUSINESS_TZ })
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

  // Determine customer type from roles array (NOT userType — that field
  // doesn't exist on the user object, so this was always false before).
  const isPrivateCustomer = user?.roles?.includes('PRIVATE_CUSTOMER') ?? false

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

  // Auto-scroll the chat to the newest message when the thread loads/updates
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [supportData])

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
    <header className="sticky top-0 z-50 w-full shrink-0 bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
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

  // Viewport-locked chat layout: the page itself never scrolls — only the
  // message thread does — so the composer stays pinned at the bottom of the
  // screen at all times, WhatsApp-style. No Footer on this page.
  return (
    <div className="h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 min-h-0 w-full max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col">
        {/* Compact title strip — minimized so the conversation gets the screen */}
        <div className="mb-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={supportData.status} />
            <PriorityBadge priority={supportData.priority} />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              #{supportData.id.slice(-6).toUpperCase()}
            </span>
          </div>
          <h1 className="mt-1 text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
            {supportData.subject}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateTime(supportData.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Updated {formatDateTime(supportData.updatedAt)}
            </span>
            {supportData.assignedToUser && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Assigned to {supportData.assignedToUser.fullName}
              </span>
            )}
            {supportData.delivery && (
              <Link
                to="/dealer-delivery-details"
                state={{ id: supportData.delivery.id }}
                className="inline-flex items-center gap-1.5 font-bold text-lime-600 hover:text-lime-500"
              >
                <Package className="h-3.5 w-3.5" />
                Delivery #{supportData.delivery.id.slice(-6).toUpperCase()} →
              </Link>
            )}
          </div>
        </div>

        {/* Chat panel — fills the rest of the screen like a messenger */}
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800">
          <CardHeader className="py-3 px-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Headphones className="h-4 w-4 text-lime-500" />
              Conversation
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                with 101 Drivers Support
              </span>
            </CardTitle>
          </CardHeader>

          {/* Messages — the whole thread scrolls in here */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 bg-slate-100/70 dark:bg-slate-900/50"
          >
            {/* Original request shown as the first message in the thread */}
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-lime-600 dark:text-lime-400">
                    <CategoryIcon category={supportData.category} />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Original Request · {supportData.category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatTime(supportData.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
                  {supportData.message}
                </p>
              </div>
            </div>

                  {publicNotes.map((note) => {
                    // Explicitly check each role — no "else" fallback
                    const isFromDealer = note.authorRole === 'DEALER' || note.authorRole === 'PRIVATE_CUSTOMER'
                    const isFromSupport = note.authorRole === 'ADMIN' || note.authorRole === 'OPS'
                    const isFromDriver = note.authorRole === 'DRIVER'

                    // Determine label based on who wrote it
                    let label = 'Unknown'
                    if (isFromDealer) label = 'You'
                    else if (isFromSupport) label = 'Support Team'
                    else if (isFromDriver) label = 'Driver'
                    else label = note.authorName || note.authorRole || 'Unknown'

                    return (
                      <div
                        key={note.id}
                        className={cn(
                          "flex",
                          isFromDealer ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                            isFromDealer
                              ? "bg-lime-500 text-slate-950 rounded-br-md"
                              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md border border-slate-200 dark:border-slate-700"
                          )}
                        >
                          {/* Author label */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-wide",
                              isFromDealer
                                ? "text-slate-800/70"
                                : "text-slate-500 dark:text-slate-400"
                            )}>
                              {label}
                            </span>
                            <span className={cn(
                              "text-[10px]",
                              isFromDealer
                                ? "text-slate-700/60"
                                : "text-slate-400 dark:text-slate-500"
                            )}>
                              {formatTime(note.createdAt)}
                            </span>
                          </div>
                          {/* Message body */}
                          <p className={cn(
                            "text-sm whitespace-pre-wrap break-words",
                            isFromDealer
                              ? "text-slate-900"
                              : "text-slate-700 dark:text-slate-300"
                          )}>
                            {note.message}
                          </p>
                        </div>
                      </div>
                    )
                  })}
          </div>

          {/* WhatsApp-style composer — lives inside the chat panel */}
          {supportData.status !== 'CLOSED' && supportData.status !== 'RESOLVED' ? (
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleReply()
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 min-h-[44px] max-h-32 resize-none rounded-3xl py-3"
                />
                <Button
                  onClick={handleReply}
                  disabled={replyMutation.isPending || !replyMessage.trim()}
                  size="icon"
                  aria-label="Send reply"
                  className="h-11 w-11 shrink-0 rounded-full bg-lime-500 text-slate-950 hover:bg-lime-600 shadow-lg shadow-lime-500/25"
                >
                  {replyMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-slate-400">
                Enter to send · Shift + Enter for a new line
              </p>
            </div>
          ) : (
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/10 px-5 py-3">
              <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="h-4 w-4" />
                This request has been {supportData.status.toLowerCase()} — create a
                <Link
                  to="/dealer-support-request"
                  className="font-extrabold underline underline-offset-2 hover:text-emerald-600"
                >
                  new request
                </Link>
                if you need further assistance.
              </p>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
