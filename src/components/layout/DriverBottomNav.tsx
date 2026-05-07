import React from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Search, Bookmark, Truck, CheckCircle } from 'lucide-react'

const tabs = [
  {
    id: 'available',
    label: 'Available',
    href: '/driver-dashboard',
    icon: Search,
  },
  {
    id: 'my-bookings',
    label: 'My Bookings',
    href: '/driver-booked-later',
    icon: Bookmark,
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    href: '/driver-active',
    icon: Truck,
  },
  {
    id: 'completed',
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
      <div className="max-w-[900px] mx-auto px-5 sm:px-6 py-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className="py-2 rounded-2xl transition"
              >
                <div className={cn(
                  "w-10 h-10 mx-auto rounded-2xl flex items-center justify-center transition",
                  isActive
                    ? "bg-primary/10"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                )}>
                  <tab.icon className={cn(
                    "w-5 h-5 transition",
                    isActive
                      ? "text-primary"
                      : "text-slate-400 dark:text-slate-500"
                  )} />
                </div>
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-widest mt-1 transition",
                  isActive
                    ? "text-primary"
                    : "text-slate-500 dark:text-slate-400"
                )}>
                  {tab.label}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
