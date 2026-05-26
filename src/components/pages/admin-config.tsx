// app/pages/admin/config-hub.tsx
import React from 'react'
import { Link } from '@tanstack/react-router'
import {
  Settings,
  ChevronRight,
  Users,
  Sliders,
  DollarSign,
  Calendar,
  Bell,
  Shield,
  MapPin,
  Check,
  ArrowRight,
  Info,
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
  Flag,
  Edit3,
  Power,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { navItems } from '@/lib/items/navItems'

// Config data
const MOCK_CONFIG = {
  region: "California-only",
  defaultChannel: "Email-first",
  pricingMode: "Rules enabled",
  scheduling: "Policy enabled",
}

// Config cards data
const configCards = [
  {
    href: "/admin-landing-page-settings",
    icon: Settings,
    title: "Landing Page Settings",
    description: "Configure visibility toggles, CTA text, and manage investor pitch deck for the public landing page.",
    chips: [
      { icon: Flag, label: "Toggles" },
      { icon: FileText, label: "Deck" },
      { icon: Users, label: "Leads" },
    ]
  },
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
    href: "/admin-service-districts",
    icon: MapPin,
    title: "Service Districts",
    description: "Draw and manage pickup/drop-off zones on the map. Define coverage areas with polygon boundaries.",
    chips: [
      { icon: MapPin, label: "Zones" },
      { icon: Edit3, label: "Draw" },
      { icon: Power, label: "Toggle" },
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

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8 space-y-6">
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
                    Configuration values are pulled from Admin policy settings.
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
      </main>

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
              © {new Date().getFullYear()} 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
