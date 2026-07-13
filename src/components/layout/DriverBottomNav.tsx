import React, { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { List, Bookmark, Truck, CheckCircle, Map } from 'lucide-react'
import { subscribe } from '@/lib/driver-feed-tracker'

const tabs = [
  {
    id: 'available' as const,
    label: 'Available',
    href: '/driver/job-list',
    icon: List,
  },
  {
    id: 'my-bookings' as const,
    label: 'My Bookings',
    href: '/driver/booked-later',
    icon: Bookmark,
  },
  {
    id: 'in-progress' as const,
    label: 'Active',
    href: '/driver/active',
    icon: Truck,
  },
  {
    id: 'completed' as const,
    label: 'Completed',
    href: '/driver/completed',
    icon: CheckCircle,
  },
]

export type DriverTabId = 'available' | 'my-bookings' | 'in-progress' | 'completed'

interface DriverBottomNavProps {
  activeTab?: DriverTabId
}

/** Subscribe to the shared unread-new-deliveries count for the badge */
function useNewFeedCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    return subscribe(setCount)
  }, [])
  return count
}

export default function DriverBottomNav({ activeTab }: DriverBottomNavProps) {
  const newFeedCount = useNewFeedCount()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 safe-bottom">
      <div className="max-w-[480px] mx-auto">
        <div className="grid grid-cols-4 gap-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 py-3 transition",
                  isActive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                <div className="relative">
                  <tab.icon className="w-5 h-5" />
                  {tab.id === 'available' && newFeedCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] leading-none text-white font-bold flex items-center justify-center">
                      {newFeedCount > 9 ? '9+' : newFeedCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  isActive && 'text-green-600 dark:text-green-400'
                )}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
