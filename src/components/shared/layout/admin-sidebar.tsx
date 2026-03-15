// app/components/admin/Sidebar.tsx
import React from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  Truck,
  CreditCard,
  Shield,
  Gavel,
  BarChart3,
  Info,
} from 'lucide-react'

// Sidebar navigation items (export for use in other components)
export const sidebarItems = [
  { href: '/admin-reports-deliveries', label: 'Deliveries', icon: Truck },
  { href: '/admin/reports/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/reports/compliance', label: 'Compliance', icon: Shield },
  { href: '/admin/reports/disputes', label: 'Disputes', icon: Gavel },
  { href: '/admin/insurance', label: 'Insurance & Risk', icon: Shield },
  { href: '/admin/reports/ops-summary', label: 'Ops Summary', icon: BarChart3 },
]

interface SidebarProps {
  isMobile?: boolean
  currentPath?: string
  onItemClick?: () => void
  className?: string
}

export function Sidebar({ 
  isMobile = false, 
  currentPath = '/admin/reports/payments', 
  onItemClick,
  className 
}: SidebarProps) {
  return (
    <aside className={cn(
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 lg:p-5 h-fit",
      isMobile && "h-full overflow-y-auto pb-20",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          Reports
        </div>
        <Link
          to="/admin/reports"
          className="text-xs font-extrabold text-primary hover:opacity-90 transition"
          onClick={onItemClick}
        >
          All
        </Link>
      </div>

      <nav className="mt-4 space-y-1.5">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition",
              currentPath === item.href
                ? "bg-primary/15 text-slate-950 dark:text-white border border-primary/25"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
            onClick={onItemClick}
          >
            <item.icon className="w-5 h-5 text-primary" />
            {item.label}
          </Link>
        ))}

        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <Link
            to="/admin/reports"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
            onClick={onItemClick}
          >
            <BarChart3 className="w-5 h-5 text-primary" />
            Reporting Hub
          </Link>
        </div>
      </nav>

      <div className="mt-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            PRD: payments include auth/hold, capture, refunds, fees, payouts, and payment event history.
          </p>
        </div>
      </div>
    </aside>
  )
}