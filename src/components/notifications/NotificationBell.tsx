import React, { useState } from 'react'
import { Bell, CheckCircle, Clock, Calendar, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  subject: string
  body: string
  type: string
  status: string
  createdAt: string
  channel: string
  toEmail?: string
  toPhone?: string
  delivery?: { id: string }
  driver?: { id: string } | null
}

interface NotificationBellProps {
  customerId: string
  className?: string
}

// Map notification type to icon and color scheme
const getTypeStyle = (type: string) => {
  switch (type) {
    case 'DELIVERY_BOOKED':
      return {
        icon: FileText,
        bg: 'bg-amber-100',
        text: 'text-amber-600',
        badge: 'amber',
        label: 'Booked',
      }
    case 'TRACKING_STARTED':
      return {
        icon: Clock,
        bg: 'bg-blue-100',
        text: 'text-primary',
        badge: 'blue',
        label: 'Active',
      }
    case 'TRACKING_STOPPED':
      return {
        icon: CheckCircle,
        bg: 'bg-green-100',
        text: 'text-green-600',
        badge: 'green',
        label: 'Completed',
      }
    default:
      return {
        icon: Calendar,
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        badge: 'slate',
        label: 'Info',
      }
  }
}

export default function NotificationBell({ customerId, className }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  // Track expanded notification items by ID
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const {
    data: notifications,
    isLoading,
    error,
    refetch,
  } = useDataQuery<Notification[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/${customerId}/notifications`,
    noFilter: true,
    // refetchInterval: 30000, // poll every 30 seconds
    enabled: !!customerId,
  })

  const unreadCount = notifications?.length || 0

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

  return (
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
          <button className="text-xs text-primary font-medium hover:underline">
            Mark all as read
          </button>
        </div>

        {/* Notifications list */}
        <ScrollArea className="max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500">
              <p className="text-sm">Failed to load notifications.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && notifications?.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">We'll let you know when something arrives.</p>
            </div>
          )}

          {!isLoading &&
            !error &&
            notifications?.map((notification) => {
              const style = getTypeStyle(notification.type)
              const Icon = style.icon
              const isExpanded = expandedItems.has(notification.id)

              return (
                <div
                  key={notification.id}
                  className="p-4 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer"
                  onClick={() => toggleExpand(notification.id)}
                >
                  {/* Left icon */}
                  <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', style.bg, style.text)}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {notification.subject}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0',
                          style.badge === 'green' && 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
                          style.badge === 'blue' && 'bg-blue-50 text-primary border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
                          style.badge === 'amber' && 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
                          style.badge === 'slate' && 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                        )}
                      >
                        {style.label}
                      </Badge>
                    </div>

                    {/* Body text – truncate when collapsed, full when expanded */}
                    <p
                      className={cn(
                        'text-xs text-slate-600 dark:text-slate-400 mb-1 leading-snug',
                        !isExpanded && 'line-clamp-2'
                      )}
                    >
                      {notification.body}
                    </p>

                    {/* Show less button – only appears when expanded */}
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

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 text-center border-t border-slate-100 dark:border-slate-800">
          <button className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
            View all activity
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}