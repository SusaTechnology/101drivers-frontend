// Driver Inbox Page - Real API Integration
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Search,
  Mail,
  Inbox as InboxIcon,
  Truck,
  FileCheck,
  Calendar,
  Shield,
  Headset,
  Phone,
  MailCheck,
  ArrowRight,
  LayoutDashboard,
  Bell,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  MessageSquare,
  RefreshCw,
  MoreHorizontal,
  Archive,
  ExternalLink,
  ArchiveX,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { getUser, useDataQuery, useCreate, authFetch } from '@/lib/tanstack/dataQuery'
import {
  NOTIFICATION_TYPE_STYLES,
  type NotificationEventItem,
  type NotificationInboxResponse,
  type NotificationEventType,
  type MarkReadPayload,
  type MarkReadResponse,
  type MarkAllReadResponse,
  type ArchiveNotificationResponse,
  type TrackClickResponse,
} from '@/types/notification'

// Filter options
const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'delivery', label: 'Delivery updates' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'system', label: 'System' },
]

// Tab options
const tabOptions = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
]

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
    COMPLIANCE_REQUEST: FileCheck,
    COMPLIANCE_REMINDER: AlertTriangle,
    SUPPORT_REQUEST_CREATED: Headset,
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
  return style.color
}

// Get delivery link from notification
const getDeliveryLink = (notification: NotificationEventItem): string | null => {
  if (notification.payload?.deliveryId) {
    return '/driver-active'
  }
  if (notification.delivery?.id) {
    return '/driver-active'
  }
  return null
}

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/driver-active', label: 'Active', icon: Truck },
  { href: '/driver-inbox', label: 'Inbox', icon: InboxIcon, active: true },
  { href: '/driver-menu', label: 'Menu', icon: MoreHorizontal },
]

export default function DriverInboxPage() {
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [activeTab, setActiveTab] = useState('all')
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set())
  const [selectedNotification, setSelectedNotification] = useState<NotificationEventItem | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const user = getUser()

  // Fetch notifications
  const {
    data: inboxData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useDataQuery<NotificationInboxResponse>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/notificationEvents/my/inbox${activeTab === 'unread' ? '?unreadOnly=true' : ''}`,
    noFilter: true,
  })

  const notifications = inboxData?.items || []
  const unreadCount = inboxData?.unreadCount || 0

  // Mark all as read mutation
  const markAllReadMutation = useCreate<undefined, MarkAllReadResponse>(
    `${import.meta.env.VITE_API_URL}/api/notificationEvents/mark-all-read`,
    {
      onSuccess: (data) => {
        toast.success('All messages marked as read', {
          description: `${data.updatedCount} notifications updated.`,
        })
        refetch()
      },
      onError: (error: any) => {
        toast.error('Failed to mark as read', {
          description: error.message || 'Please try again.',
        })
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
    navigate({ to: '/driver-signin' })
  }

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined as any, {
      // Override the URL for this specific mutation
      apiEndPoint: `${import.meta.env.VITE_API_URL}/api/notificationEvents/mark-all-read`,
    } as any)
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

  // Open notification detail dialog
  const handleNotificationClick = async (notification: NotificationEventItem) => {
    // Open the notification (marks as read)
    await handleNotificationOpen(notification)
    
    // Show detail dialog
    setSelectedNotification(notification)
    setDetailDialogOpen(true)
  }

  // Navigate to related entity from notification detail
  const handleNavigateToRelated = async () => {
    if (!selectedNotification) return

    const deliveryLink = getDeliveryLink(selectedNotification)
    let targetUrl = ''

    if (deliveryLink) {
      targetUrl = deliveryLink
    } else if (selectedNotification.type.includes('SUPPORT')) {
      targetUrl = '/driver-support-list'
    }

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
    e.preventDefault()
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

  const handleContactSupport = () => {
    navigate({ to: '/driver-issue-report' })
  }

  const handleGoToActiveDelivery = () => {
    navigate({ to: '/driver-active' })
  }

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!notification.subject.toLowerCase().includes(query) &&
          !notification.body.toLowerCase().includes(query) &&
          !notification.payload?.deliveryId?.toLowerCase().includes(query)) {
        return false
      }
    }

    // Type filter
    if (filterType === 'unread' && notification.isRead) return false
    if (filterType === 'delivery' && !notification.type.includes('DELIVERY')) return false
    if (filterType === 'compliance' && !notification.type.includes('COMPLIANCE')) return false
    if (filterType === 'scheduling' && !notification.type.includes('SCHEDULE')) return false
    if (filterType === 'system' && notification.type !== 'SYSTEM_ALERT' && notification.type !== 'GENERAL') return false

    return true
  })

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-dashboard"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Driver
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Inbox
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* Title / Filters */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Email-first notifications
                  </span>
                </div>

                <h1 className="mt-4 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Messages & alerts
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
                  Delivery updates, compliance requests, scheduling changes, and system notifications.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 w-full sm:w-72 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                    placeholder="Search delivery ID, keyword..."
                  />
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm min-w-[140px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              {tabOptions.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition",
                    activeTab === tab.id
                      ? "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                >
                  {tab.label}
                  {tab.id === 'unread' && unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-slate-950 text-[10px] font-black">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inbox List */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Inbox</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                </CardDescription>
              </div>

              {unreadCount > 0 && (
                <Button
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                >
                  <MailCheck className="w-4 h-4" />
                  {markAllReadMutation.isPending ? 'Updating...' : 'Mark all read'}
                </Button>
              )}
            </div>
          </CardHeader>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              // Loading skeleton
              Array(4).fill(null).map((_, i) => (
                <div key={i} className="p-6 sm:p-7 flex gap-4">
                  <Skeleton className="w-11 h-11 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Failed to load notifications
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type)
                const color = getNotificationColor(notification.type)
                const deliveryLink = getDeliveryLink(notification)
                const isArchiving = archivingIds.has(notification.id)
                const hasAction = deliveryLink || notification.type.includes('SUPPORT')

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group p-6 sm:p-7 hover:bg-slate-50 dark:hover:bg-slate-950 transition",
                      isArchiving && "opacity-50 pointer-events-none"
                    )}
                  >
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left flex items-start gap-4"
                    >
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                        color === 'blue' && "bg-blue-500/15",
                        color === 'green' && "bg-emerald-500/15",
                        color === 'emerald' && "bg-emerald-500/15",
                        color === 'amber' && "bg-amber-500/15",
                        color === 'red' && "bg-red-500/15",
                        color === 'slate' && "bg-slate-500/15",
                      )}>
                        <Icon className={cn(
                          "w-5 h-5 text-primary",
                          color === 'amber' && "text-amber-600",
                          color === 'red' && "text-red-500",
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!notification.isRead && (
                            <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                              <span className="w-2 h-2 rounded-full bg-primary" />
                              Unread
                            </Badge>
                          )}
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            {NOTIFICATION_TYPE_STYLES[notification.type]?.label || notification.type}
                          </span>
                          {notification.payload?.deliveryId && (
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                              #{notification.payload.deliveryId.slice(-6).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                          {notification.subject}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                          {notification.body}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>{formatTime(notification.createdAt)}</span>
                          {notification.channel === 'EMAIL' && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              <span>Email</span>
                            </>
                          )}
                          {notification.channel === 'SMS' && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              <span>SMS</span>
                            </>
                          )}
                          {!notification.isRead && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              <span className="text-primary">New</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right side: Chevron indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => handleArchive(e, notification.id)}
                          disabled={isArchiving}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Archive notification"
                        >
                          {isArchiving ? (
                            <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                          ) : (
                            <Archive className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                          )}
                        </button>
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </button>
                  </div>
                )
              })
            ) : (
              <div className="p-12 text-center">
                <InboxIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  No messages found
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Try adjusting your filters or search query
                </p>
              </div>
            )}
          </div>

          <CardContent className="p-6 sm:p-7 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Notifications follow Admin policy (email-first; SMS optional if enabled) and messages link directly to
              deliveries, checklists, or disputes.
            </p>
          </CardContent>
        </Card>

        {/* Help / policy */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Headset className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Need help?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  If you can't complete a checklist due to access issues, contact support and document what happened.
                </p>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleGoToActiveDelivery}
                    variant="outline"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                  >
                    Go to Active Delivery
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </Button>

                  <Button
                    onClick={handleContactSupport}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                  >
                    <Phone className="w-4 h-4" />
                    Contact Support
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <DriverBottomNav />


      {/* Notification Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          {selectedNotification && (() => {
            const Icon = getNotificationIcon(selectedNotification.type)
            const color = getNotificationColor(selectedNotification.type)
            const deliveryLink = getDeliveryLink(selectedNotification)
            const hasAction = deliveryLink || selectedNotification.type.includes('SUPPORT')

            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                      color === 'blue' && "bg-blue-500/15",
                      color === 'green' && "bg-emerald-500/15",
                      color === 'emerald' && "bg-emerald-500/15",
                      color === 'amber' && "bg-amber-500/15",
                      color === 'red' && "bg-red-500/15",
                      color === 'slate' && "bg-slate-500/15",
                    )}>
                      <Icon className={cn(
                        "w-6 h-6 text-primary",
                        color === 'amber' && "text-amber-600",
                        color === 'red' && "text-red-500",
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-extrabold">
                          {NOTIFICATION_TYPE_STYLES[selectedNotification.type]?.label || selectedNotification.type}
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
                      {selectedNotification.type.includes('SUPPORT') ? 'View Support Request' : 'View Delivery'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
