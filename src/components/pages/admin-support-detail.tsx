// Admin Support Detail Page - View and manage support request
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  FileText,
  MessageSquare,
  Shield,
  RefreshCw,
  Building2,
  Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import { Navbar } from '@/components/shared/layout/testNavbar'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
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

export default function AdminSupportDetailPage() {
  const { state } = useLocation()
  const requestId = state?.id || ''
  const navigate = useNavigate()
  const { actionItems, signOut } = useAdminActions()
  const user = getUser()
  const adminId = user?.id

  // Form state
  const [replyMessage, setReplyMessage] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [newStatus, setNewStatus] = useState<SupportRequestStatus | ''>('')

  // Fetch support request details
  const {
    data: request,
    isLoading,
    error,
    refetch,
    isFetching,
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

  // If no ID, redirect
  if (!requestId) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-6">
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
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Support Request"
      />

      <main className="w-full max-w-[1400px] mx-auto px-4 lg:px-5 py-4 lg:py-5">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Skeleton className="h-40 lg:col-span-2 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
            <Skeleton className="h-60 rounded-xl" />
          </div>
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
            {/* Back button and actions */}
            <section className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/admin-support-list"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Support List
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-4">
                {/* Request Header */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 text-primary">
                        {categoryIcons[request.category]}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className={cn("font-bold", statusColors[request.status])}>
                            {request.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className={priorityColors[request.priority]}>
                            {request.priority}
                          </Badge>
                        </div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">
                          {request.subject}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-500">
                          <span>{categoryLabels[request.category]}</span>
                          <span>•</span>
                          <span>From {request.actorRole}</span>
                          <span>•</span>
                          <span>{formatDate(request.createdAt)} at {formatTime(request.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Original Message */}
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        {actorRoleIcons[request.actorRole] || <User className="h-4 w-4" />}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">Original Request</CardTitle>
                        <CardDescription className="text-xs">
                          {request.actorRole} • {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
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

                {/* Conversation */}
                {request.notes && request.notes.length > 0 && (
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Conversation ({request.notes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {request.notes.map((note, index) => (
                        <div key={note.id}>
                          {index > 0 && <Separator className="mb-4" />}
                          <div className={cn("flex gap-3", note.isInternal && "opacity-80")}>
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              note.authorRole === 'ADMIN' || note.authorRole === 'OPERATIONS'
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                : note.isInternal
                                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                                  : "bg-primary/15 text-primary"
                            )}>
                              {note.isInternal ? (
                                <FileText className="h-4 w-4" />
                              ) : (
                                actorRoleIcons[note.authorRole] || <User className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  {note.authorName || note.authorRole}
                                </span>
                                {note.isInternal && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                                    Internal Note
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

                {/* Reply Section */}
                {request.status !== 'CLOSED' && (
                  <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-base font-bold">Reply to Request</CardTitle>
                      <CardDescription>
                        Send a response to the user who submitted this request.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your response here..."
                        rows={4}
                        className="rounded-xl"
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleReply}
                          disabled={replyMutation.isPending || !replyMessage.trim()}
                          className="rounded-xl bg-primary text-slate-950 hover:shadow-lg font-bold gap-2"
                        >
                          {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
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

                {/* Assignment Info */}
                {request.assignedToUser && (
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
                          {request.assignedToUser.fullName}
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
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-8 pb-8">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Admin Console • California-only operations
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
