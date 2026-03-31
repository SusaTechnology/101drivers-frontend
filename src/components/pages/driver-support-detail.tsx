// Driver Support Detail Page - View individual support request
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  Send,
  Reply,
  Inbox,
  Home,
  Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import {
  STATUS_OPTIONS,
  type SupportRequestDetail,
  type SupportRequestCategory,
  type SupportRequestStatus,
  type ReplySupportRequestPayload,
  type ReplySupportRequestResponse,
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

export default function DriverSupportDetailPage() {
  const { state } = useLocation()
  const requestId = state?.id || ''
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [replyMessage, setReplyMessage] = useState('')
  const { theme, setTheme } = useTheme()
  const user = getUser()

  // Fetch support request details
  const {
    data: request,
    isLoading,
    error,
    refetch,
  } = useDataQuery<SupportRequestDetail>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}`,
    noFilter: true,
    enabled: !!requestId,
  })

  // Reply mutation
  const replyMutation = useCreate<ReplySupportRequestPayload, ReplySupportRequestResponse>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}/reply`,
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
      toast.error('Message required', { description: 'Please enter your reply.' })
      return
    }
    replyMutation.mutate({ message: replyMessage.trim() })
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

  // If no ID, redirect
  if (!requestId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">No Request Selected</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Please select a support request from the list.
            </p>
            <Link
              to="/driver-support-list"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-lime-500 text-slate-950 font-bold hover:bg-lime-600 transition"
            >
              View All Requests
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-support-list"
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
                Request #{requestId.slice(-6).toUpperCase()}
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
          </div>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {isLoading ? (
          <>
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-60 w-full rounded-3xl" />
          </>
        ) : error || !request ? (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
            <CardContent className="p-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">Failed to load request</p>
                <p className="text-sm text-red-600 dark:text-red-300">This request may not exist or you don't have access.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Request header */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardContent className="p-6 sm:p-7">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0 text-lime-500">
                      {categoryIcons[request.category]}
                    </div>
                    <div>
                      <Badge className={cn("font-bold mb-2", statusColors[request.status])}>
                        {request.status.replace('_', ' ')}
                      </Badge>
                      <h1 className="text-xl font-black text-slate-900 dark:text-white">
                        {request.subject}
                      </h1>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {categoryLabels[request.category]}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Created {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Related delivery */}
                {request.delivery && (
                  <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Related Delivery</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          #{request.delivery.id.slice(-6).toUpperCase()}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {request.delivery.pickupAddress?.split(',')[0]} → {request.delivery.dropoffAddress?.split(',')[0]}
                        </div>
                      </div>
                      <Badge variant="outline">{request.delivery.status}</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Original message */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-lime-500/15 flex items-center justify-center text-lime-500">
                    <Headphones className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Your Request</CardTitle>
                    <CardDescription className="text-xs">
                      {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {request.message}
                </p>
              </CardContent>
            </Card>

            {/* Conversation notes */}
            {request.notes && request.notes.length > 0 && (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Reply className="h-4 w-4" />
                    Conversation ({request.notes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {request.notes.map((note, index) => (
                    <div key={note.id}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className={cn(
                        "flex gap-3",
                        note.isInternal && "opacity-60"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                          note.authorRole === 'ADMIN' || note.authorRole === 'OPERATIONS'
                            ? "bg-blue-500/15 text-blue-500"
                            : "bg-lime-500/15 text-lime-500"
                        )}>
                          {note.authorRole === 'ADMIN' || note.authorRole === 'OPERATIONS' ? (
                            <Headphones className="h-4 w-4" />
                          ) : (
                            <Truck className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {note.authorName || note.authorRole}
                            </span>
                            {note.isInternal && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Internal
                              </Badge>
                            )}
                            <span className="text-xs text-slate-400">
                              {formatDate(note.createdAt)} {formatTime(note.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                            {note.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Reply form - only if not closed */}
            {request.status !== 'CLOSED' && request.status !== 'RESOLVED' && (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Add Reply</CardTitle>
                  <CardDescription>
                    Add more information or respond to Operations team.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply here..."
                    rows={4}
                    className="rounded-2xl"
                  />
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setReplyMessage('')}
                      className="rounded-2xl"
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={handleReply}
                      disabled={replyMutation.isPending || !replyMessage.trim()}
                      className="rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-bold gap-2"
                    >
                      {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status info */}
            {(request.status === 'RESOLVED' || request.status === 'CLOSED') && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="text-sm text-emerald-900 dark:text-emerald-200">
                  <span className="font-bold">This request has been {request.status.toLowerCase()}.</span>
                  {request.status === 'RESOLVED' && ' If you have further questions, please submit a new request.'}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                <item.icon className="w-5 h-5 mx-auto text-lime-500" />
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {item.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}
