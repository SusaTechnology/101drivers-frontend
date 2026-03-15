// app/pages/driver/menu.tsx
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
  User,
  Verified,
  Mail,
  Shield,
  Bell,
  Calendar,
  CreditCard,
  Badge,
  QrCode,
  Camera,
  FileCheck as FactCheck,
  Headset as SupportAgent,
  FileText,
  Shield as PrivacyTip,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Home,
  Car,
  Inbox,
  Menu as MenuIcon,
  Settings,
  Sliders,
  Clock,
  CalendarDays,
  DollarSign,
  Receipt,
  History,
  FileCheck,
  FileWarning,
  FileX,
  HelpCircle,
  MessageSquare,
  Phone,
  Mail as MailIcon,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  MapPin,
  Navigation,
  Compass,
  Gauge,
  Fuel,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge as UIBadge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Menu sections data
const MENU_SECTIONS = [
  {
    title: 'Quick links',
    description: 'Most-used driver pages.',
    items: [
      {
        href: '/driver-active',
        icon: Car,
        title: 'Active delivery',
        description: 'Start/stop tracking & steps',
      },
      {
        href: '/driver-inbox',
        icon: Inbox,
        title: 'Inbox',
        description: 'Alerts & compliance requests',
      },
    ],
  },
  {
    title: 'Settings',
    description: 'These are driver-side settings implied by PRD flows.',
    items: [
      {
        href: '/driver/notifications',
        icon: Bell,
        title: 'Notification preferences',
        description: 'Email-first; SMS optional if enabled by Admin policy',
      },
      {
        href: '/driver/availability',
        icon: Calendar,
        title: 'Availability',
        description: 'Time windows, days, and blackout periods',
      },
      {
        href: '/driver/payouts',
        icon: CreditCard,
        title: 'Payouts',
        description: 'Payout method, history, and statements',
      },
    ],
  },
  {
    title: 'Compliance',
    description: 'Driver-required documents and delivery proof protocol.',
    items: [
      {
        href: '/driver/documents',
        icon: Badge,
        title: 'Driver profile & documents',
        description: 'License, insurance, background, training (prototype)',
      },
      {
        href: '/driver-pickup-checklist',
        icon: QrCode,
        title: 'Pickup checklist',
        description: 'VIN last-4, photos, odometer start',
      },
      {
        href: '/driver-dropoff-checklist',
        icon: FactCheck,
        title: 'Drop-off checklist',
        description: 'Photos, odometer end, completion confirmation',
      },
    ],
  },
  {
    title: 'Support & legal',
    description: 'Help, safety, and documents.',
    items: [
      {
        href: '/driver/support',
        icon: SupportAgent,
        title: 'Contact support',
        description: 'Report issues, disputes, emergencies',
      },
      {
        href: '/terms',
        icon: FileText,
        title: 'Terms of service',
        description: 'Driver obligations & platform rules',
      },
      {
        href: '/privacy',
        icon: PrivacyTip,
        title: 'Privacy policy',
        description: 'How data is used',
      },
      {
        href: '/carrier-policy',
        icon: Shield,
        title: 'Carrier policy',
        description: 'Insurance, claims, and protocol',
      },
    ],
  },
]

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: MenuIcon, active: true },
]

export default function DriverMenuPage() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

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
    navigate({ to: '/auth/dealer-signin?userType=driver' })
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
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
                Menu
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
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

      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* Profile */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-3xl bg-primary/15 flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      Driver Account
                    </h1>
                    <UIBadge variant="outline" className="chip bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <Verified className="w-3.5 h-3.5 text-primary mr-1" />
                      Certified (Prototype)
                    </UIBadge>
                  </div>

                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    Manage availability, compliance documents, and notification preferences.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <UIBadge variant="outline" className="chip bg-primary/10 border-primary/25 text-slate-800 dark:text-slate-200">
                      <Mail className="w-3.5 h-3.5 text-primary mr-1" />
                      Email-first
                    </UIBadge>
                    <UIBadge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <Shield className="w-3.5 h-3.5 text-primary mr-1" />
                      CA MVP
                    </UIBadge>
                  </div>
                </div>
              </div>

              <Link
                to="/driver-dashboard"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
              >
                Back to Home
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, sectionIndex) => (
          <Card key={sectionIndex} className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg font-black">{section.title}</CardTitle>
              <CardDescription className="text-sm mt-1">
                {section.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-7 space-y-3">
              {section.items.map((item, itemIndex) => (
                <Link
                  key={itemIndex}
                  to={item.href}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition hover-lift"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary" />
                </Link>
              ))}
            </CardContent>

            {sectionIndex === 2 && (
              <div className="p-6 sm:p-7 border-t border-slate-100 dark:border-slate-800">
                <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                    Compliance Note
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                    Proof capture requirements are controlled by Admin compliance policy and may vary by service type.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </Card>
        ))}

        {/* Sign out */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Sign out</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Use the shared sign-in page for all roles.
                </p>
              </div>

              <Button
                onClick={handleSignOut}
                className="lime-btn inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl hover:shadow-xl hover:shadow-primary/20 transition"
              >
                Sign Out
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "py-2 rounded-2xl transition",
                  item.active 
                    ? "bg-slate-50 dark:bg-slate-900" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                )}
              >
                <div className="w-10 h-10 mx-auto rounded-2xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  item.active 
                    ? "text-slate-900 dark:text-white" 
                    : "text-slate-500 dark:text-slate-400"
                )}>
                  {item.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}