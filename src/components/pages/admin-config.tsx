// app/pages/admin/config-hub.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { 
  Menu, 
  X, 
  Settings, 
  ChevronRight,
  Users,
  Truck,
  CreditCard,
  Gavel,
  BarChart3,
  Sliders,
  DollarSign,
  Calendar,
  Bell,
  Shield,
  MapPin,
  Mail,
  Phone,
  Check,
  ArrowRight,
  Info,
  LogOut,
  Sun,
  Moon,
  AlertCircle,
  Clock,
  Percent,
  Route,
  FileText,
  Download,
  Verified,
  Ban,
  MailCheck,
 MessageSquare as Sms,
  Flag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { navItems } from '@/lib/items/navItems'

// Mock config data - would come from API in production
const MOCK_CONFIG = {
  region: "California-only",
  defaultChannel: "Email-first",
  pricingMode: "Rules enabled",
  scheduling: "Policy enabled",
  guardrails: [
    {
      icon: Mail,
      title: "Email-first",
      description: "All key lifecycle events should notify stakeholders via email."
    },
    {
      icon: Sms,
      title: "SMS optional",
      description: "Use SMS only when enabled by policy + consent; reserve for high priority."
    },
    {
      icon: MapPin,
      title: "CA only",
      description: "Ensure address validation and operations remain limited to California."
    }
  ]
}

// Navigation items


// Config cards data
const configCards = [
  {
    href: "/admin-pricing",
    icon: DollarSign,
    title: "Pricing",
    description: "Configure pricing structure (A/B/C), rate rules, overrides, and min/max constraints used to generate quotes.",
    chips: [
      { icon: AlertCircle, label: "Rules" },
      { icon: Percent, label: "Fees" },
      { icon: Route, label: "Overrides" },
    ]
  },
  {
    href: "/admin-scheduling-policy",
    icon: Calendar,
    title: "Scheduling Policy",
    description: "Define when deliveries can be scheduled, lead times, blackout windows, and assignment constraints.",
    chips: [
      { icon: Clock, label: "Rules" },
      { icon: Calendar, label: "Lead time" },
      { icon: Ban, label: "Blackouts" },
    ]
  },
  {
    href: "/admin-notification-policy",
    icon: Bell,
    title: "Notification Policy",
    description: "Email-first configuration, optional SMS settings, quiet hours, rate limits, and event routing.",
    chips: [
      { icon: MailCheck, label: "Email" },
      { icon: Sms, label: "SMS" },
      { icon: Route, label: "Routing" },
    ]
  },
  {
    href: "/admin-insurance-reporting",
    icon: Shield,
    title: "Insurance & Reporting",
    description: "Configure insurance requirements, compliance proofs, and admin reporting exports.",
    chips: [
      { icon: Verified, label: "Proofs" },
      { icon: FileText, label: "Requirements" },
      { icon: Download, label: "Exports" },
    ]
  }
]

export default function AdminConfigHubPage() {
  const { actionItems, signOut } = useAdminActions();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  // Handle theme toggle
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  // Handle mount state for theme
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle mobile sidebar
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileSidebarOpen])

  // Sidebar component (shared between desktop and mobile)
  const Sidebar = ({ isMobile = false }) => (
    <aside className={cn(
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 lg:p-5 h-fit",
      isMobile && "h-full overflow-y-auto pb-20"
    )}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          Admin
        </div>
        <Badge variant="outline" className="chip-gray">
          <Settings className="w-3.5 h-3.5 text-primary mr-1" />
          SYS
        </Badge>
      </div>

      {/* <nav className="mt-4 space-y-1.5">
        {navItems.map((section) => (
          <div key={section.section}>
            {section.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition",
                  item.active
                    ? "bg-primary/15 text-slate-950 dark:text-white border border-primary/25"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
                onClick={() => isMobile && setMobileSidebarOpen(false)}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  item.active ? "text-primary" : "text-primary"
                )} />
                {item.label}
              </Link>
            ))}
            {section.section !== navItems[navItems.length - 1].section && (
              <Separator className="my-4" />
            )}
          </div>
        ))}
      </nav> */}

      <div className="mt-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            Config pages control global platform behavior: pricing, scheduling rules, notifications, and compliance/insurance settings.
          </p>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Top Bar */}
          <Navbar
            brand={<Brand />}
            items={navItems}
            actions={actionItems}
            onSignOut={signOut}
            title="Admin"
            />

      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div className={cn(
        "lg:hidden fixed z-50 top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto transition-transform duration-300",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">
            Admin
          </div>
          <Button
            variant="outline"
            size="icon"
            className="w-11 h-11 rounded-2xl"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <Sidebar isMobile />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:col-span-3">
            <Sidebar />
          </div>

          {/* Main content */}
          <main className="lg:col-span-9 space-y-6">
            {/* Page header */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 dark:text-white border border-primary/25 w-fit">
                      <Sliders className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Config Hub
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Admin Configuration
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Manage global policies that control pricing, scheduling, notifications, and compliance/insurance behavior.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <DollarSign className="w-3.5 h-3.5 text-primary mr-1" />
                        Pricing
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Calendar className="w-3.5 h-3.5 text-primary mr-1" />
                        Scheduling
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Bell className="w-3.5 h-3.5 text-primary mr-1" />
                        Notifications
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Shield className="w-3.5 h-3.5 text-primary mr-1" />
                        Compliance
                      </Badge>
                    </div>
                  </div>

                  <div className="xl:w-[520px]">
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Quick Checks
                        </div>
                        <Badge className="bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30">
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Region
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                            {MOCK_CONFIG.region}
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Default Channel
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                            {MOCK_CONFIG.defaultChannel}
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Pricing Mode
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                            {MOCK_CONFIG.pricingMode}
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            Scheduling
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                            {MOCK_CONFIG.scheduling}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Prototype: values shown are placeholders. Real app pulls from Admin policy config.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Config cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {configCards.map((card) => (
                <Link
                  key={card.href}
                  to={card.href}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 hover-lift"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <card.icon className="w-6 h-6 text-primary font-bold" />
                    </div>
                    <Badge 
                      variant="outline" 
                      className="chip-gray group-hover:border-primary/40 group-hover:bg-primary/10 transition"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-primary mr-1" />
                      Open
                    </Badge>
                  </div>
                  
                  <h2 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">
                    {card.title}
                  </h2>
                  
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.description}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.chips.map((chip) => (
                      <Badge key={chip.label} variant="outline" className="chip-gray">
                        <chip.icon className="w-3.5 h-3.5 text-primary mr-1" />
                        {chip.label}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </section>

            {/* Guardrails */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                      Guardrails
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      Recommended defaults aligned to PRD.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="chip-gray">
                    <Check className="w-3.5 h-3.5 text-primary mr-1" />
                    PRD
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MOCK_CONFIG.guardrails.map((guardrail) => (
                    <div
                      key={guardrail.title}
                      className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <guardrail.icon className="w-4 h-4 text-primary" />
                        {guardrail.title}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-2">
                        {guardrail.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Admin • Config Hub
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