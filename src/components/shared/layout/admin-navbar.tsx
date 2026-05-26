// app/components/admin/Navbar.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Menu,
  ChevronLeft,
  LogOut,
  Sun,
  Moon,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavbarProps {
  title: string
  showBackButton?: boolean
  backTo?: string
  backLabel?: string
  onMenuClick?: () => void
  className?: string
  locationBadge?: string
}

export function Navbar({ 
  title, 
  showBackButton = true,
  backTo = '/admin/reports',
  backLabel = 'Back to Reports',
  onMenuClick,
  className,
  locationBadge = 'California Only'
}: NavbarProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/admin-signin' })
  }

  return (
    <header className={cn(
      "sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md",
      className
    )}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          {onMenuClick && (
            <Button
              variant="outline"
              size="icon"
              className="xl:hidden w-11 h-11 rounded-2xl"
              onClick={onMenuClick}
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}

          <Link to="/admin/reports" className="flex items-center gap-3" aria-label="101 Drivers Admin">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Admin
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {title}
              </div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
              {locationBadge}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme toggle */}
          <Button
            variant="outline"
            size="icon"
            className="w-11 h-11 rounded-2xl"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>

          {showBackButton && (
            <Link
              to={backTo}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-extrabold text-slate-700 dark:text-slate-200"
            >
              <ChevronLeft className="w-4 h-4 text-primary" />
              {backLabel}
            </Link>
          )}

          <Button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}