import React, { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bell, CheckCircle, Clock, Calendar, FileText, X, Truck, DollarSign, AlertCircle, AlertTriangle, Info, MessageSquare, XCircle, MailCheck, Archive, ExternalLink, ArchiveX, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useDataQuery, useCreate, authFetch, getUser } from '@/lib/tanstack/dataQuery'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  NOTIFICATION_TYPE_STYLES,
  type NotificationEventItem,
  type NotificationInboxResponse,
  type NotificationEventType,
  type MarkAllReadResponse,
  type ArchiveNotificationResponse,
  type TrackClickResponse,
} from '@/types/notification'

interface NotificationBellProps {
  className?: string
  userType?: 'admin' | 'dealer' // To determine navigation paths
}

// Icon mapping
const getNotificationIcon = (type: NotificationEventType) => {
  const iconMap: Record<string, React.ElementType> = {
    DELIVERY_STATUS_CHANGED: Truck,
    DELIVERY_ASSIGNED: Truck,
    DELIVERY_COMPLETED: CheckCircle,
    DELIVERY_CANCELLED: XCircle,
    PAYMENT_RECEIVED: DollarSign,
    PAYMENT_FAILED: AlertCircle,
    SCHEDULE_CHANGED: Calendar,
    COMPLIANCE_REQUEST: FileText,
    COMPLIANCE_REMINDER: AlertTriangle,
    SUPPORT_REQUEST_CREATED: Bell,
    SUPPORT_REQUEST_UPDATED: MessageSquare,
    DISPUTE_CREATED: AlertTriangle,
    DISPUTE_RESOLVED: CheckCircle,
    SYSTEM_ALERT: Bell,
    GENERAL: Info,
  }
  return iconMap[type] || Info
}

// Color mapping
const getNotificationColor = (type: NotificationEventType) => {
  const style = NOTIFICATION_TYPE_STYLES[type] || NOTIFICATION_TYPE_STYLES.GENERAL
  switch (style.color) {
    case 'blue': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', badge: 'blue' }
    case 'green':
    case 'emerald': return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', badge: 'green' }
    case 'amber': return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', badge: 'amber' }
    case 'red': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', badge: 'red' }
    default: return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', badge: 'slate' }
  }
}

export default function NotificationBell({ className, userType }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set())
  const [selectedNotification, setSelectedNotification] = useState<NotificationEventItem | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const navigate = useNavigate()

  // Auto-detect user type from token if not provided
  const user = getUser()
  const effectiveUserType = userType || user?.userType || 'dealer'

  // Fetch notifications using the new API
  const {
    data: inboxData,
    isLoading,
    error,
    refetch,
  } = useDataQuery<NotificationInboxResponse>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/notificationEvents/my/inbox?take=20`,
    noFilter: true,
  })

  const notifications = inboxData?.items || []
  const unreadCount = inboxData?.unreadCount || 0

  // Mark all as read mutation
  const markAllReadMutation = useCreate<undefined, MarkAllReadResponse>(
    `${import.meta.env.VITE_API_URL}/api/notificationEvents/mark-all-read`,
    {
      onSuccess: () => {
        refetch()
      },
    }
  )

  // Archive mutation
  const archiveMutation = useCreate<{ archived: boolean }, ArchiveNotificationResponse>(
    `${import.meta.env.VITE_API_URL}/api/notificationEvents`,
    {
      onSuccess: () => {
        refetch()
      },
      onError: (error: any) => {
        toast.error('Failed to archive notification', {
          description: error.message || 'Please try again.',
        })
      },
    }
  )

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return dateString
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Get navigation target URL based on notification type and user type
  const getNavigationUrl = (notification: NotificationEventItem): string | null => {
    const deliveryId = notification.payload?.deliveryId || notification.delivery?.id
    const supportRequestId = notification.payload?.supportRequestId
    const disputeId = notification.payload?.disputeId

    if (deliveryId) {
      // Delivery-related notifications
      if (effectiveUserType === 'admin') {
        return `/admin-delivery-details?id=${deliveryId}`
      }
      return `/dealer-delivery-details?id=${deliveryId}`
    }

    if (supportRequestId && notification.type.includes('SUPPORT')) {
      // Support request notifications
      if (effectiveUserType === 'admin') {
        return `/admin-support-detail?id=${supportRequestId}`
      }
      return `/dealer-support-detail?id=${supportRequestId}`
    }

    if (disputeId && notification.type.includes('DISPUTE')) {
      // Dispute notifications - only admin has access
      if (effectiveUserType === 'admin') {
        return `/admin-dispute-details?id=${disputeId}`
      }
      return null // Dealers don't have dispute detail access
    }

    return null
  }

  // Check if notification has actionable navigation
  const hasNotificationAction = (notification: NotificationEventItem): boolean => {
    return getNavigationUrl(notification) !== null
  }

  // Open notification - marks as read and tracks open event
  const handleNotificationOpen = async (notification: NotificationEventItem) => {
    try {
      await authFetch(`${import.meta.env.VITE_API_URL}/api/notificationEvents/${notification.id}/open`, {
        method: 'POST',
        body: JSON.stringify({ markRead: true }),
      })
      refetch()
    } catch (e) {
      console.error('Failed to open notification', e)
    }
  }

  // Click on notification to show detail dialog
  const handleNotificationClick = async (notification: NotificationEventItem) => {
    // Open the notification (marks as read)
    await handleNotificationOpen(notification)
    
    // Show detail dialog
    setSelectedNotification(notification)
    setDetailDialogOpen(true)
    setOpen(false) // Close popover
  }

  // Navigate to related entity from notification detail
  const handleNavigateToRelated = async () => {
    if (!selectedNotification) return

    const targetUrl = getNavigationUrl(selectedNotification)

    if (targetUrl) {
      // Track click
      try {
        await authFetch(`${import.meta.env.VITE_API_URL}/api/notificationEvents/${selectedNotification.id}/click`, {
          method: 'POST',
          body: JSON.stringify({ targetUrl }),
        })
      } catch (e) {
        console.error('Failed to track click', e)
      }

      setDetailDialogOpen(false)
      navigate({ to: targetUrl })
    }
  }

  // Archive from dialog
  const handleArchiveFromDialog = async () => {
    if (!selectedNotification) return
    setArchivingIds(prev => new Set(prev).add(selectedNotification.id))

    try {
      await authFetch(`${import.meta.env.VITE_API_URL}/api/notificationEvents/${selectedNotification.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archived: true }),
      })
      toast.success('Notification archived')
      setDetailDialogOpen(false)
      refetch()
    } catch (error: any) {
      toast.error('Failed to archive notification', {
        description: error.message || 'Please try again.',
      })
    } finally {
      setArchivingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(selectedNotification.id)
        return newSet
      })
    }
  }

  // Archive notification
  const handleArchive = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    setArchivingIds(prev => new Set(prev).add(notificationId))

    try {
      await authFetch(`${import.meta.env.VITE_API_URL}/api/notificationEvents/${notificationId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archived: true }),
      })
      toast.success('Notification archived')
      refetch()
    } catch (error: any) {
      toast.error('Failed to archive notification', {
        description: error.message || 'Please try again.',
      })
    } finally {
      setArchivingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
    }
  }

  const handleMarkAllRead = async () => {
    markAllReadMutation.mutate(undefined as any)
  }

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative rounded-full', className)}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white border-2 border-white dark:border-slate-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[390px] p-0 shadow-xl rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Notifications</h2>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
            >
              {markAllReadMutation.isPending ? 'Updating...' : 'Mark all as read'}
            </button>
          )}
        </div>

        {/* Notifications list */}
        <ScrollArea className="max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Failed to load notifications.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && notifications.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">We'll let you know when something arrives.</p>
            </div>
          )}

          {!isLoading &&
            !error &&
            notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type)
              const colorStyle = getNotificationColor(notification.type)
              const isExpanded = expandedItems.has(notification.id)
              const style = NOTIFICATION_TYPE_STYLES[notification.type] || NOTIFICATION_TYPE_STYLES.GENERAL

              const isArchiving = archivingIds.has(notification.id)

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "group p-4 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer relative",
                    !notification.isRead && "bg-blue-50/30 dark:bg-blue-900/10",
                    isArchiving && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Left icon */}
                  <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', colorStyle.bg, colorStyle.text)}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate pr-2">
                        {notification.subject}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0',
                          colorStyle.badge === 'green' && 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
                          colorStyle.badge === 'blue' && 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
                          colorStyle.badge === 'amber' && 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
                          colorStyle.badge === 'red' && 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
                          colorStyle.badge === 'slate' && 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                        )}
                      >
                        {style.label}
                      </Badge>
                    </div>

                    {/* Body text */}
                    <p
                      className={cn(
                        'text-xs text-slate-600 dark:text-slate-400 mb-1 leading-snug',
                        !isExpanded && 'line-clamp-2'
                      )}
                    >
                      {notification.body}
                    </p>

                    {isExpanded && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(notification.id)
                        }}
                        className="text-[10px] font-semibold text-primary hover:underline mt-1"
                      >
                        Show less
                      </button>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatTime(notification.createdAt)}
                      </p>
                      {/* Click action hint for actionable notifications */}
                      {hasNotificationAction(notification) && (
                        <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Unread indicator + Archive button */}
                  <div className="flex flex-col items-end gap-2">
                    {/* Unread indicator */}
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}

                    {/* Archive button - visible on hover */}
                    <button
                      onClick={(e) => handleArchive(e, notification.id)}
                      disabled={isArchiving}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                      title="Archive notification"
                    >
                      {isArchiving ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <Archive className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 text-center border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </PopoverContent>
    </Popover>

    {/* Notification Detail Dialog */}
    <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
      <DialogContent className="max-w-lg">
        {selectedNotification && (() => {
          const Icon = getNotificationIcon(selectedNotification.type)
          const colorStyle = getNotificationColor(selectedNotification.type)
          const style = NOTIFICATION_TYPE_STYLES[selectedNotification.type] || NOTIFICATION_TYPE_STYLES.GENERAL
          const hasAction = hasNotificationAction(selectedNotification)

          return (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                    colorStyle.bg, colorStyle.text
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-extrabold">
                        {style.label}
                      </Badge>
                      {selectedNotification.payload?.deliveryId && (
                        <Badge variant="outline" className="text-[10px] font-extrabold text-slate-500">
                          #{selectedNotification.payload.deliveryId.slice(-6).toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-lg font-black mt-2">
                      {selectedNotification.subject}
                    </DialogTitle>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-4">
                <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                  {selectedNotification.body}
                </DialogDescription>

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <span>{formatTime(selectedNotification.createdAt)}</span>
                  {selectedNotification.channel === 'EMAIL' && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-400" />
                      <span>Email</span>
                    </>
                  )}
                  {selectedNotification.channel === 'SMS' && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-400" />
                      <span>SMS</span>
                    </>
                  )}
                  {selectedNotification.isRead && selectedNotification.readAt && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-400" />
                      <span>Read {formatTime(selectedNotification.readAt)}</span>
                    </>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleArchiveFromDialog}
                  disabled={archivingIds.has(selectedNotification.id)}
                  className="w-full sm:w-auto"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </Button>
                {hasAction && (
                  <Button
                    onClick={handleNavigateToRelated}
                    className="w-full sm:w-auto bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  >
                    {selectedNotification.type.includes('SUPPORT') 
                      ? 'View Support Request' 
                      : selectedNotification.type.includes('DISPUTE')
                        ? 'View Dispute'
                        : 'View Delivery'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </DialogFooter>
            </>
          )
        })()}
      </DialogContent>
    </Dialog>
    </>
  )
}
