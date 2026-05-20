import React from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Search, Bookmark, Truck, CheckCircle } from 'lucide-react'

const tabs = [
  {
    id: 'available' as const,
    label: 'Available',
    href: '/driver-dashboard',
    icon: Search,
  },
  {
    id: 'my-bookings' as const,
    label: 'My Bookings',
    href: '/driver-booked-later',
    icon: Bookmark,
  },
  {
    id: 'in-progress' as const,
    label: 'In Progress',
    href: '/driver-active',
    icon: Truck,
  },
  {
    id: 'completed' as const,
    label: 'Completed',
    href: '/driver-completed',
    icon: CheckCircle,
  },
]

export type DriverTabId = 'available' | 'my-bookings' | 'in-progress' | 'completed'

interface DriverBottomNavProps {
  activeTab?: DriverTabId
}

export default function DriverBottomNav({ activeTab }: DriverBottomNavProps) {
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
                  "flex flex-col items-center gap-1 py-3 transition",
                  isActive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                <tab.icon className="w-5 h-5" />
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
