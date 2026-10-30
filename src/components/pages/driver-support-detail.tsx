// Driver Support Detail Page - View individual support request
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Menu,
  X,
  Package,
  CreditCard,
  XCircle,
  Gavel,
  HelpCircle,
  ImagePlus,
  Loader2,
  Clock,
  Truck,
  Calendar,
  AlertCircle,
  CheckCircle,
  Send,
  RefreshCw,
  Inbox,
  Home,
  Car,
} from 'lucide-react'
import { BUSINESS_TZ } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import { useSocketEvent } from '@/hooks/useSocket'
import { socketJoinSupport, socketLeaveSupport } from '@/lib/socket'
import { SupportMessageBody } from '@/components/shared/SupportMessageBody'
import { PhotoDialog } from '@/components/ui/photo-dialog'
import { useSupportAttachments } from '@/hooks/useSupportAttachments'
import {
  SupportAvatar,
  SupportContactLine,
} from '@/components/shared/SupportSenderIdentity'
import {
  STATUS_OPTIONS,
  type SupportRequestDetail,
  type SupportRequestCategory,
  type SupportRequestStatus,
  type SupportRequestPriority,
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

// Priority colors — same mapping the admin conversation strip uses
const priorityColors: Record<SupportRequestPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  NORMAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

// Bottom navigation items
// const bottomNavItems = [
//   { href: '/driver/dashboard', label: 'Home', icon: Home },
//   { href: '/driver-active', label: 'Active', icon: Car },
//   { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
//   { href: '/driver-menu', label: 'Menu', icon: Menu },
// ]

export default function DriverSupportDetailPage({ supportRequestId }: { supportRequestId?: string }) {
  const { state } = useLocation()
  // URL search param wins (deep-linkable: notifications, refreshes, PWA
  // restores); router history state is the fallback for in-app navigations
  // that still pass state (support list pages).
  const requestId = (supportRequestId ?? state?.id) || ''
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [replyMessage, setReplyMessage] = useState('')
  // Full-size preview for embedded attachment thumbnails
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [photoDialogSrc, setPhotoDialogSrc] = useState('')

  // Photos mid-conversation: compress → upload to the user-scoped
  // /uploads/support-attachment endpoint → thumbnail chips in the composer.
  // The URLs ride inside the message text as an [Attachments] block (there
  // is no attachments column on SupportRequest); SupportMessageBody lifts
  // them back out as tappable thumbnails on every chat surface.
  const {
    attachments,
    isUploading: isUploadingAttachment,
    inputRef: photoInputRef,
    openPicker,
    handleChosen: handleAttachmentChosen,
    removeAttachment,
    clearAttachments,
    buildAttachmentBlock,
  } = useSupportAttachments()
  const { theme, setTheme } = useTheme()
  const user = getUser()

  // Fetch support request details
  const {
    data: request,
    isLoading,
    // Switching conversations keeps the previous payload as placeholder
    // data (useDataQuery) — rendering it here would show another ticket's
    // chat under this URL. Skeleton until the real fetch lands.
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
  // The backend verifies owner/admin membership on every join.
  const isStaff = !!user?.roles?.includes('ADMIN')

  useEffect(() => {
    if (!requestId) return
    socketJoinSupport(requestId, isStaff)
    return () => socketLeaveSupport(requestId)
  }, [requestId, isStaff])

  useSocketEvent<{ supportRequestId: string }>('support:message', (data) => {
    if (data?.supportRequestId === requestId) refetch()
  })

  useSocketEvent<{ supportRequestId: string }>('support:request-updated', (data) => {
    if (data?.supportRequestId === requestId) refetch()
  })

  const openAttachmentPreview = (url: string) => {
    setPhotoDialogSrc(url)
    setPhotoDialogOpen(true)
  }

  // ── The opening message must show exactly once ──
  // createContactRequest persists the original text twice: on the ticket
  // itself (message) AND as the conversation's first note. The note copy
  // already renders as a regular chat bubble below, so rendering the
  // ticket-level "opening bubble" too duplicated the first message on
  // every role's conversation screen. When the thread carries the original
  // text as a note, the opening bubble stays hidden (the message still
  // renders once — as a message); a thread whose first note is missing
  // keeps the bubble so the text never disappears.
  const showOpeningBubble =
    !!request?.message && !(request.notes ?? []).some((n) => n.message === request.message)

  // Reply mutation — after a reply the "my requests" list previews are
  // stale (the list query caches for 5 minutes), so the list page would
  // show the OLD last message when the driver navigates back. Invalidate
  // every /supportRequests/ query (list + counters) alongside refetch().
  const queryClient = useQueryClient()
  // TData is the RESPONSE type (what onSuccess receives), TVariables the
  // payload (what mutate takes) — the swapped order made every mutate()
  // call a pre-existing tsc error.
  const replyMutation = useCreate<ReplySupportRequestResponse, ReplySupportRequestPayload>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/${requestId}/reply`,
    {
      onSuccess: () => {
        toast.success('Reply sent', { description: 'Your message has been added to the conversation.' })
        setReplyMessage('')
        clearAttachments()
        refetch()
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            typeof q.queryKey[1] === 'string' &&
            q.queryKey[1].includes('/supportRequests/'),
        })
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

  // Reply — text and/or attached photos; the photo URLs are embedded into
  // the message text as an [Attachments] block at send time.
  const handleReply = () => {
    const text = replyMessage.trim()
    if (!text && attachments.length === 0) {
      toast.error('Message required', { description: 'Write a message or attach a photo.' })
      return
    }
    replyMutation.mutate({ message: text + buildAttachmentBlock() })
  }

  // ── Chat-app shell helpers (the SAME UX as the admin conversation) ──
  // The conversation lives in its own scrolling screen, so new history must
  // scroll THAT screen to the bottom — WhatsApp behavior. Container
  // scrollTop (not scrollIntoView) so nothing else ever jumps.
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
      if (!replyMutation.isPending && !isUploadingAttachment && (replyMessage.trim() || attachments.length > 0)) handleReply()
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

  // Format date
  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: BUSINESS_TZ,
    })
  }

  // Format time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: BUSINESS_TZ,
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
              to="/driver/support-list"
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
    <div data-viewport-lock className="h-dvh overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-white">
      {/* Chat-app frame — the driver's own header (h-16 at every viewport)
          is the top chrome and lives INSIDE this frame, so the frame is the
          FULL viewport (h-dvh): header 4rem on top, the conversation takes
          the rest, the composer lands exactly at the bottom of the screen.
          (The old h-[calc(100dvh_-_4rem)] subtracted the header TWICE — it
          left a dead 4rem strip under the composer.) data-viewport-lock
          zeroes the body's PWA min-height (styles.css) so the document is
          EXACTLY the viewport — on screens shorter than 884px the old body
          floor added dead page scroll under the locked frame. The page
          NEVER scrolls: the conversation screen is the only scroller and
          the composer stays pinned at the bottom — no scrolling to the end
          of the thread to find where to write. */}
      {/* Header */}
      <header className="shrink-0 sticky top-0 z-40 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver/support-list"
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

      <main className="max-w-[900px] mx-auto w-full px-5 sm:px-6 py-3 flex-1 min-h-0 flex flex-col">
        {isLoading || isPlaceholderData ? (
          <>
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-60 w-full rounded-3xl" />
          </>
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
          <>
            {/* Chat-app column — the SAME conversation UI the admin support
                screen uses: a compact header strip fixed at its spot under
                the page header, the conversation screen as the ONLY scroller
                between the strip and the composer, and the composer pinned
                at the bottom of the screen (no scrolling to find where to
                write). z-index on both fixed parts so messages never paint
                over them. */}
            <section className="flex-1 min-h-0 flex flex-col">
              {/* Chat-app header strip — identity icon, subject, category +
                  date line, status + priority pills, refresh. */}
              <div className="relative z-20 shrink-0 h-14 flex items-center gap-2.5 pl-1.5 pr-2 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-lime-500/15 flex items-center justify-center text-lime-500">
                  {categoryIcons[request.category]}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
                    {request.subject}
                  </h1>
                  <div className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-slate-400">
                    <span className="truncate">{categoryLabels[request.category]}</span>
                    <span aria-hidden>•</span>
                    <span className="whitespace-nowrap">
                      Created {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
                    </span>
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
                  header strip and the composer and is the ONLY scroller in
                  the column (the window itself never scrolls). */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 overflow-y-auto p-3 sm:p-4 space-y-3"
              >
                {/* Related delivery — scrolls with the conversation */}
                {request.delivery && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Related Delivery</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          #{request.delivery.id.slice(-6).toUpperCase()}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {request.delivery.pickupAddress?.split(',')[0]} → {request.delivery.dropoffAddress?.split(',')[0]}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{request.delivery.status}</Badge>
                    </div>
                  </div>
                )}

                {/* Original request = the thread's first bubble — the
                    driver's own message, WhatsApp-style — but ONLY when the
                    notes don't already carry the same text: the creation
                    flow writes the opening message into the notes as the
                    first chat message too, so rendering both copies showed
                    the same text twice. */}
                {showOpeningBubble && (
                <div className="flex items-end gap-2 justify-end">
                  <div className="max-w-[75%] rounded-2xl px-4 py-3 shadow-sm bg-lime-500 text-slate-950 rounded-br-md">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-800/70">
                        You
                      </span>
                      <span className="text-[10px] text-slate-700/60">
                        {formatTime(request.createdAt)}
                      </span>
                    </div>
                    <SupportMessageBody
                      message={request.message}
                      proseClassName="text-slate-900"
                      onOpenImage={openAttachmentPreview}
                    />
                  </div>
                </div>
                )}

                {/* Conversation notes — same bubbles as before, now inside
                    the scrolling chat screen */}
                {request.notes && request.notes.length > 0 && (
                  <div className="space-y-3">
                  {request.notes.map((note) => {
                    if (note.isInternal) {
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

                    const isOwnNote = !!note.authorUserId && note.authorUserId === user?.id
                    const isFromDriver = note.authorRole === 'DRIVER'
                    const isFromSupport = note.authorRole === 'ADMIN' || note.authorRole === 'OPS'

                    // Sender identity from the payload's authorUser (the old
                    // `authorName` field never existed — names never showed).
                    let label = 'Unknown'
                    if (isOwnNote) label = 'You'
                    else if (isFromSupport) label = note.authorUser?.fullName || 'Support Team'
                    else if (note.authorRole === 'DEALER' || note.authorRole === 'PRIVATE_CUSTOMER') label = note.authorUser?.fullName || 'Customer'
                    else label = note.authorUser?.fullName || note.authorRole || 'Unknown'

                    return (
                      <div
                        key={note.id}
                        className={cn(
                          "flex items-end gap-2",
                          (isOwnNote || (isFromDriver && !note.authorUserId)) ? "justify-end" : "justify-start"
                        )}
                      >
                        {/* Sender avatar (selfie for drivers, initials
                            otherwise) — own messages need no avatar */}
                        {!isOwnNote && (
                          <SupportAvatar
                            identity={note.authorUser}
                            className="h-8 w-8"
                            onOpenPhoto={openAttachmentPreview}
                          />
                        )}
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                            isFromDriver
                              ? "bg-lime-500 text-slate-950 rounded-br-md"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md border border-slate-200 dark:border-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-wide",
                              isFromDriver
                                ? "text-slate-800/70"
                                : "text-slate-500 dark:text-slate-400"
                            )}>
                              {label}
                            </span>
                            <span className={cn(
                              "text-[10px]",
                              isFromDriver
                                ? "text-slate-700/60"
                                : "text-slate-400 dark:text-slate-500"
                            )}>
                              {formatTime(note.createdAt)}
                            </span>
                          </div>
                          <SupportMessageBody
                            message={note.message}
                            proseClassName={
                              isFromDriver
                                ? 'text-slate-900'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                            onOpenImage={openAttachmentPreview}
                          />
                          {/* Sender contact strip — email · phone of whoever
                              sent this message (e.g. the support agent) */}
                          {!isOwnNote && (
                            <SupportContactLine
                              identity={note.authorUser}
                              variant={isFromDriver ? 'dark' : 'light'}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                  </div>
                )}
              </div>

            {/* Composer — pinned at the bottom of the screen (inside the
                chat column), WhatsApp-style: input + send, no "Add Reply"
                chrome. Enter sends, Shift+Enter adds a line. A closed or
                resolved request gets the notice instead. */}
            {request.status !== 'CLOSED' && request.status !== 'RESOLVED' ? (
              <div className="relative z-20 shrink-0 mt-2 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm p-2">
                {/* Hidden file picker for the attach button */}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAttachmentChosen}
                />
                {/* Pending photo chips — tap to preview, ✕ to remove */}
                {(attachments.length > 0 || isUploadingAttachment) && (
                  <div className="flex flex-wrap gap-2 px-1 pb-2">
                    {attachments.map((url, idx) => (
                      <div key={url} className="relative">
                        <img
                          src={url}
                          alt={`Attachment ${idx + 1}`}
                          onClick={() => openAttachmentPreview(url)}
                          className="h-12 w-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition"
                          aria-label="Remove attachment"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {isUploadingAttachment && (
                      <div className="h-12 w-12 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openPicker}
                    disabled={isUploadingAttachment || replyMutation.isPending}
                    aria-label="Attach a photo"
                    title="Attach a photo"
                    className="h-9 w-9 shrink-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </Button>
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
                    disabled={replyMutation.isPending || isUploadingAttachment || (!replyMessage.trim() && attachments.length === 0)}
                    size="icon"
                    aria-label="Send message"
                    title="Send"
                    className="h-9 w-9 shrink-0 rounded-xl bg-lime-500 text-slate-950 hover:bg-lime-600"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="shrink-0 mt-2 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="text-sm text-emerald-900 dark:text-emerald-200">
                  <span className="font-bold">This request has been {request.status.toLowerCase()}.</span>
                  {request.status === 'RESOLVED' && ' If you have further questions, please submit a new request.'}
                </div>
              </div>
            )}
            </section>
          </>
        )}
      </main>

      {/* Full-size attachment preview (tap a thumbnail) */}
      <PhotoDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        src={photoDialogSrc}
        title="Attachment"
      />

      {/* Bottom navigation */}
      {/* <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800">
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
      </nav> */}
    </div>
  )
}
