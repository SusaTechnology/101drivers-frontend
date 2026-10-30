// Admin Support Detail Page - View and manage support request
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PhotoDialog } from '@/components/ui/photo-dialog'
import { SupportMessageBody } from '@/components/shared/SupportMessageBody'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Headphones,
  Package,
  CreditCard,
  XCircle,
  Gavel,
  HelpCircle,
  Truck,
  Calendar,
  Send,
  Reply,
  AlertCircle,
  CheckCircle,
  User,
  Clock,
  Shield,
  RefreshCw,
  Building2,
  Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import { useSocketEvent } from '@/hooks/useSocket'
import { socketJoinSupport, socketLeaveSupport } from '@/lib/socket'
import {
  SupportAvatar,
  SupportContactLine,
  SupportIdentityCard,
} from '@/components/shared/SupportSenderIdentity'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type SupportRequestDetail,
  type SupportRequestCategory,
  type SupportRequestStatus,
  type SupportRequestPriority,
  type ReplySupportRequestPayload,
  type ReplySupportRequestResponse,
  type AddInternalNotePayload,
  type AddInternalNoteResponse,
  type ChangeSupportStatusPayload,
  type ChangeSupportStatusResponse,
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

// Actor role icons
const actorRoleIcons: Record<string, React.ReactNode> = {
  DEALER: <Building2 className="h-4 w-4" />,
  PRIVATE_CUSTOMER: <User className="h-4 w-4" />,
  DRIVER: <Car className="h-4 w-4" />,
  ADMIN: <Shield className="h-4 w-4" />,
}

// Status colors
const statusColors: Record<SupportRequestStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
}

// Priority colors
const priorityColors: Record<SupportRequestPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  NORMAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function AdminSupportDetailPage({ supportRequestId }: { supportRequestId?: string }) {
  const { state } = useLocation()
  // URL search param wins (deep-linkable: notifications, refreshes, PWA
  // restores); router history state is the fallback for in-app navigations
  // that still pass state (support list page).
  const requestId = (supportRequestId ?? state?.id) || ''
  const navigate = useNavigate()
  const user = getUser()
  const adminId = user?.id

  // Form state
  const [replyMessage, setReplyMessage] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [newStatus, setNewStatus] = useState<SupportRequestStatus | ''>('')
  // Full-size preview for embedded attachment thumbnails
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [photoDialogSrc, setPhotoDialogSrc] = useState('')

  // Fetch support request details
  const {
    data: request,
    isLoading,
    // While switching conversations the previous request's payload is kept
    // as placeholder data (useDataQuery uses keepPreviousData). Rendering it
    // under the new URL is EXACTLY the "another dealer's messages in this
    // chat" bug — gate on it and show the skeleton until the real fetch lands.
    isPlaceholderData,
    error,
    refetch,
    isFetching,
  } = useDataQuery<SupportRequestDetail>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}/detail`,
    noFilter: true,
    enabled: !!requestId,
  })

  // ── Live conversation updates (WebSocket) ──
  // Join the private room for THIS conversation; the backend verifies
  // owner/admin membership on every join. Re-join whenever the conversation
  // changes; leave the previous room on unmount/id change.
  const isStaff = !!user?.roles?.includes('ADMIN')

  // ── Staff read receipt ──
  // Opening the conversation marks the ticket read (adminReadAt = now) so it
  // drops out of the navbar Support badge and its red dot on the list page.
  // The backend emits a contentless staff-ops ping, so OTHER admins' badges
  // and open list pages refresh live. Fired once per ticket per mount —
  // the endpoint is idempotent, this just avoids pointless traffic on
  // every refetch.
  const queryClient = useQueryClient()
  const markedReadRef = useRef<Set<string>>(new Set())
  const markAdminReadMutation = useCreate<undefined, { id: string; adminReadAt: string }>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}/mark-admin-read`,
    {
      // Silent housekeeping call — no "Created successfully" toast while an
      // admin is just opening a ticket.
      successMessage: '',
      onSuccess: () => {
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            (q.queryKey[0] === 'admin-support-unread-count' ||
              (typeof q.queryKey[1] === 'string' &&
                q.queryKey[1].includes('/supportRequests/'))),
        })
      },
    }
  )

  useEffect(() => {
    if (!requestId || !isStaff || isLoading || isPlaceholderData) return
    if (markedReadRef.current.has(requestId)) return
    markedReadRef.current.add(requestId)
    markAdminReadMutation.mutate(undefined as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, isStaff, isLoading, isPlaceholderData])

  useEffect(() => {
    if (!requestId) return
    socketJoinSupport(requestId, isStaff)
    return () => socketLeaveSupport(requestId)
  }, [requestId, isStaff])

  // New message in THIS thread → refetch the conversation.
  useSocketEvent<{ supportRequestId: string }>('support:message', (data) => {
    if (data?.supportRequestId === requestId) refetch()
  })

  // Status/assignment changed → refetch (badge + composer state stay live).
  useSocketEvent<{ supportRequestId: string }>('support:request-updated', (data) => {
    if (data?.supportRequestId === requestId) refetch()
  })

  const openAttachmentPreview = (url: string) => {
    setPhotoDialogSrc(url)
    setPhotoDialogOpen(true)
  }

  // Reply mutation
  const replyMutation = useCreate<ReplySupportRequestPayload, ReplySupportRequestResponse>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}/reply`,
    {
      onSuccess: () => {
        toast.success('Reply sent', { description: 'Your response has been added to the conversation.' })
        setReplyMessage('')
        refetch()
      },
      onError: (error: any) => {
        toast.error('Failed to send reply', { description: error.message || 'Please try again.' })
      },
    }
  )

  // Internal note mutation
  const internalNoteMutation = useCreate<AddInternalNotePayload, AddInternalNoteResponse>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}/internal-note`,
    {
      onSuccess: () => {
        toast.success('Note added', { description: 'Internal note has been added.' })
        setInternalNote('')
        refetch()
      },
      onError: (error: any) => {
        toast.error('Failed to add note', { description: error.message || 'Please try again.' })
      },
    }
  )

  // Change status mutation
  const changeStatusMutation = useCreate<ChangeSupportStatusPayload, ChangeSupportStatusResponse>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}/status`,
    {
      onSuccess: () => {
        toast.success('Status updated', { description: 'Request status has been changed.' })
        setNewStatus('')
        refetch()
      },
      onError: (error: any) => {
        toast.error('Failed to update status', { description: error.message || 'Please try again.' })
      },
    }
  )

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

  // Handle reply
  const handleReply = () => {
    if (!replyMessage.trim()) {
      toast.error('Message required', { description: 'Please enter your reply.' })
      return
    }
    replyMutation.mutate({ message: replyMessage.trim() })
  }

  // ── Chat-app shell helpers ──
  // The conversation lives in its own scrolling screen (the column itself
  // never scrolls on desktop), so new history must scroll THAT screen to
  // the bottom — WhatsApp behavior. Container scrollTop (not
  // scrollIntoView) so a mobile page-level scroller never jumps.
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const notesCount = request?.notes?.length ?? 0
  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [notesCount, requestId])

  // Chat convention: Enter sends, Shift+Enter adds a line, IME composition
  // (the pause while typing CJK/emoji suggestions) never triggers a send.
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!replyMutation.isPending && replyMessage.trim()) handleReply()
    }
  }

  // Auto-grow the composer with its content (capped), and shrink it back
  // once a sent message clears the field.
  const autoGrowComposer = () => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }
  useEffect(() => {
    if (replyMessage === '' && composerRef.current) {
      composerRef.current.style.height = ''
    }
  }, [replyMessage])

  // Handle internal note
  const handleAddInternalNote = () => {
    if (!internalNote.trim()) {
      toast.error('Note required', { description: 'Please enter your internal note.' })
      return
    }
    internalNoteMutation.mutate({ message: internalNote.trim() })
  }

  // Handle status change
  const handleChangeStatus = () => {
    if (!newStatus) {
      toast.error('Status required', { description: 'Please select a new status.' })
      return
    }
    changeStatusMutation.mutate({ status: newStatus })
  }

  // If no ID, redirect. The shell (Navbar → AppSidebar) still renders —
  // an admin landing here by direct URL keeps the same navigation chrome
  // as every other admin page; only the content area is the notice card.
  if (!requestId) {
    return (
      <div className="min-h-[calc(100dvh_-_4rem)] lg:min-h-[calc(100dvh_-_5rem)] bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
        <div className="flex items-center justify-center p-6">
          <Card className="w-full max-w-md border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">No Request Selected</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Please select a support request from the list.
              </p>
              <Link
                to="/admin-support-list"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-slate-950 font-bold hover:shadow-lg transition"
              >
                View All Requests
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh_-_4rem)] lg:h-[calc(100dvh_-_5rem)] lg:min-h-0 lg:overflow-hidden flex flex-col bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}

      {/* Chat-workspace shell. The navbar is persistent shell chrome ABOVE
          this page (AdminShell in the router root), so the frame's height is
          the viewport minus the navbar (h-16 mobile / h-20 desktop) — the
          old lg:h-dvh made the document 100dvh+80px: a dead scroll that cut
          the composer's bottom below the fold. Desktop: the page NEVER
          scrolls — the two columns own their own scrolling (chat screen
          inside the main column, the whole aside on the right). Mobile: the
          conversation is a bounded chat frame — strip fixed at its spot,
          composer pinned at the viewport bottom, messages scrolling between
          them — and the aside sits below the fold (window-scroll to it). */}
      <main className="w-full max-w-[1400px] mx-auto px-4 lg:px-5 py-3 lg:py-4 flex-1 lg:min-h-0 flex flex-col">
        {isLoading || isPlaceholderData ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Skeleton className="h-40 lg:col-span-2 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
            <Skeleton className="h-60 rounded-xl" />
          </div>
        ) : error || !request || request.id !== requestId ? (
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
          <div className="flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main column — chat app. Bounded on ALL viewports so the
                composer always lands at the bottom of the screen (no
                scrolling to find where to write): on mobile the column's
                height is the viewport minus navbar + page padding; on lg it
                stretches to the grid cell. The column itself never scrolls:
                header strip on top, the conversation screen takes the rest
                (the only scroller), the composer pinned at the bottom. */}
            <section className="h-[calc(100dvh_-_5.5rem)] lg:h-auto lg:col-span-2 lg:min-h-0 flex flex-col">
              {/* Chat-app header — "a little smaller than the navbar" strip
                  with the same content the old header cards had: identity,
                  subject, status + priority pills, refresh. */}
              <div className="relative z-20 shrink-0 h-14 flex items-center gap-2.5 pl-1.5 pr-2 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                <Link
                  to="/admin-support-list"
                  aria-label="Back to support list"
                  title="Back to support list"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <SupportAvatar
                  identity={request.user}
                  className="h-9 w-9 shrink-0"
                  onOpenPhoto={openAttachmentPreview}
                />
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
                    {request.subject}
                  </h1>
                  <div className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-slate-400">
                    <span className="truncate">{categoryLabels[request.category]}</span>
                    <span aria-hidden>•</span>
                    <span className="truncate">From {request.actorRole}</span>
                    <span aria-hidden>•</span>
                    <span className="whitespace-nowrap">{formatDate(request.createdAt)}</span>
                  </div>
                </div>
                <Badge className={cn("shrink-0 px-2 py-0 text-[9px] font-bold", statusColors[request.status])}>
                  {request.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className={cn("shrink-0 px-2 py-0 text-[9px] font-bold", priorityColors[request.priority])}>
                  {request.priority}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  aria-label="Refresh"
                  title="Refresh"
                  className="h-8 w-8 shrink-0 rounded-xl"
                >
                  <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                </Button>
              </div>

              {/* The conversation screen — takes everything between the
                  header strip and the composer (~90% of the column) and is
                  the ONLY scroller in this column. */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 overflow-y-auto p-3 sm:p-4 space-y-3"
              >
                {/* Original request = the thread's first bubble (the
                    standalone "Original Request" card is gone — its content
                    lives here, chat-style). */}
                <div className="flex items-end gap-2 justify-start">
                  <SupportAvatar
                    identity={request.user}
                    className="h-8 w-8"
                    onOpenPhoto={openAttachmentPreview}
                  />
                  <div className="max-w-[75%] rounded-2xl px-4 py-3 shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {request.user?.fullName || request.actorRole}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
                      </span>
                    </div>
                    <SupportMessageBody
                      message={request.message}
                      proseClassName="text-slate-700 dark:text-slate-300"
                      onOpenImage={openAttachmentPreview}
                    />
                  </div>
                </div>

                {request.notes && request.notes.length > 0 && (
                  <>
                      {request.notes.map((note) => {
                        if (note.isInternal) {
                          // Internal notes — shown as a centered system message
                          return (
                            <div key={note.id} className="text-center">
                              <div className="inline-block px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                                  Internal Note
                                </span>
                                <span className="text-[10px] text-amber-500 ml-2">
                                  {note.authorUser?.fullName || note.authorRole} • {formatTime(note.createdAt)}
                                </span>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 whitespace-pre-wrap">
                                  {note.message}
                                </p>
                              </div>
                            </div>
                          )
                        }

                        const isFromAdmin = note.authorRole === 'ADMIN' || note.authorRole === 'OPS'
                        const isOwnAdminNote = !!note.authorUserId && note.authorUserId === adminId

                        // Sender identity from the payload's authorUser — the
                        // old `authorName` field never existed, so the admin
                        // always saw generic "Customer"/"Driver" labels and
                        // the dealer/driver never saw WHO from support replied.
                        let senderLabel = 'Unknown'
                        if (isOwnAdminNote) {
                          senderLabel = 'You (Admin)'
                        } else if (isFromAdmin) {
                          senderLabel = note.authorUser?.fullName || 'Support Team'
                        } else if (note.authorRole === 'DEALER' || note.authorRole === 'PRIVATE_CUSTOMER') {
                          senderLabel = note.authorUser?.fullName || 'Customer'
                        } else if (note.authorRole === 'DRIVER') {
                          senderLabel = note.authorUser?.fullName || 'Driver'
                        } else {
                          senderLabel = note.authorUser?.fullName || note.authorRole || 'Unknown'
                        }

                        return (
                          <div
                            key={note.id}
                            className={cn(
                              "flex items-end gap-2",
                              isFromAdmin ? "justify-end" : "justify-start"
                            )}
                          >
                            {/* Sender avatar (selfie for drivers, initials
                                otherwise) — own messages need no avatar */}
                            {!isOwnAdminNote && (
                              <SupportAvatar
                                identity={note.authorUser}
                                className="h-8 w-8"
                                onOpenPhoto={openAttachmentPreview}
                              />
                            )}
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                                isFromAdmin
                                  ? "bg-blue-500 text-white rounded-br-md"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md border border-slate-200 dark:border-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-wide",
                                  isFromAdmin
                                    ? "text-white/70"
                                    : "text-slate-500 dark:text-slate-400"
                                )}>
                                  {senderLabel}
                                </span>
                                <span className={cn(
                                  "text-[10px]",
                                  isFromAdmin
                                    ? "text-white/60"
                                    : "text-slate-400 dark:text-slate-500"
                                )}>
                                  {formatTime(note.createdAt)}
                                </span>
                              </div>
                              <SupportMessageBody
                                message={note.message}
                                proseClassName={
                                  isFromAdmin
                                    ? 'text-white'
                                    : 'text-slate-700 dark:text-slate-300'
                                }
                                onOpenImage={openAttachmentPreview}
                              />
                              {/* Sender contact strip — email · phone of
                                  whoever sent this message */}
                              {!isOwnAdminNote && (
                                <SupportContactLine
                                  identity={note.authorUser}
                                  variant={isFromAdmin ? 'dark' : 'light'}
                                />
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </>
                )}
              </div>

              {/* Composer — pinned INSIDE the chat surface at the bottom,
                  WhatsApp-style. No "Reply to Request" chrome: just the
                  input (placeholder only) and the send button. Enter sends,
                  Shift+Enter adds a line. */}
              {request.status !== 'CLOSED' ? (
                <div className="relative z-20 shrink-0 mt-2 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm p-2 flex items-end gap-2">
                  <Textarea
                    ref={composerRef}
                    value={replyMessage}
                    onChange={(e) => {
                      setReplyMessage(e.target.value)
                      autoGrowComposer()
                    }}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Type your message..."
                    rows={1}
                    aria-label="Message"
                    className="flex-1 min-h-[40px] max-h-32 resize-none rounded-xl border-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                  />
                  <Button
                    onClick={handleReply}
                    disabled={replyMutation.isPending || !replyMessage.trim()}
                    size="icon"
                    aria-label="Send message"
                    title="Send"
                    className="h-9 w-9 shrink-0 rounded-xl bg-primary text-slate-950 hover:shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative z-20 shrink-0 mt-2 rounded-2xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 px-4 py-3 text-center text-xs font-semibold text-slate-400">
                  This request is closed — change the status to reopen the conversation.
                </div>
              )}
            </section>

            {/* Right column — Related Delivery, Change Status, Internal Note,
                Requested By, Assignment, Timestamps. Scrolls on its own; the
                page never does (desktop). */}
            <aside className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                {/* Related Delivery */}
                {request.delivery && (
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold">Related Delivery</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            #{request.delivery.id.slice(-6).toUpperCase()}
                          </span>
                          <Badge variant="outline">{request.delivery.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {request.delivery.pickupAddress?.split(',')[0]} → {request.delivery.dropoffAddress?.split(',')[0]}
                        </p>
                        <Link
                          to="/admin-delivery-detail"
                          state={{ id: request.delivery.id }}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          View Delivery
                          <ArrowLeft className="w-3 h-3 rotate-180" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Change Status */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold">Change Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SupportRequestStatus)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select new status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleChangeStatus}
                      disabled={changeStatusMutation.isPending || !newStatus || newStatus === request.status}
                      variant="outline"
                      className="w-full rounded-xl font-bold"
                    >
                      {changeStatusMutation.isPending ? 'Updating...' : 'Update Status'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Add Internal Note */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold">Internal Note</CardTitle>
                    <CardDescription className="text-xs">
                      Only visible to admins
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      placeholder="Add a private note..."
                      rows={3}
                      className="rounded-xl text-sm"
                    />
                    <Button
                      onClick={handleAddInternalNote}
                      disabled={internalNoteMutation.isPending || !internalNote.trim()}
                      variant="outline"
                      className="w-full rounded-xl font-bold"
                    >
                      {internalNoteMutation.isPending ? 'Adding...' : 'Add Note'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Requested By — the ticket owner's full identity:
                    selfie/avatar, name, business (dealers), email + phone */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4">
                    <SupportIdentityCard
                      identity={request.user}
                      title="Requested by"
                      onOpenPhoto={openAttachmentPreview}
                    />
                  </CardContent>
                </Card>

                {/* Assignment Info */}
                {request.assignedTo?.fullName && (
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold">Assigned To</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {request.assignedTo.fullName}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timestamps */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Created: {formatDate(request.createdAt)} {formatTime(request.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Updated: {formatDate(request.updatedAt)} {formatTime(request.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
            </aside>
          </div>
        )}
      </main>

      {/* Full-size attachment preview (tap a thumbnail) */}
      <PhotoDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        src={photoDialogSrc}
        title="Attachment"
      />
    </div>
  )
}
