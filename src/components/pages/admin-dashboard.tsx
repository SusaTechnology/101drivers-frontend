// app/pages/admin-dashboard.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Menu,
  X,
  Truck,
  Store,
  Gavel,
  CreditCard,
  DollarSign,
  Calendar,
  Settings,
  BarChart3,
  Shield,
  Bell,
  Search,
  MapPin,
  LogOut,
  Sun,
  Moon,
  ArrowRight,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  TrendingUp,
  Users,
  FileText,
  Briefcase,
  User,
  Home,
  Sliders,
  Filter,
  Eye,
  AlertTriangle,
  Verified,
  MailCheck,
 MessageCircle as Sms,
  Ban,
  Percent,
  Route,
  Download,
  FileText as Summarize,
  Network as Hub,
  BarChart3 as Analytics,
  Bell as Notifications,
  ShieldCheck as AdminPanelSettings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Navbar } from '../shared/layout/testNavbar'
import { ThemeToggle } from '@/lib/theme/themeToggle'
import { navItems } from '@/lib/items/navItems'
import { getAdminActionItems } from '@/lib/items/adminActionItems'
import { Brand } from '@/lib/items/brand'
import { useMobileMenu } from '@/hooks/useMobileMenu'
import { MobileMenuDrawer } from '../shared/layout/MobileMenuDrawer'
import { useAdminActions } from '@/hooks/useAdminActions'
import { cn } from '@/lib/utils'

// Mock data for dashboard
const MOCK_DASHBOARD = {
  kpis: [
    {
      title: 'Active',
      value: '18',
      subtitle: 'Deliveries in progress',
      icon: Truck,
      color: 'primary',
      chips: [
        { icon: Clock, label: 'SLA watch' },
        { icon: Mail, label: 'Email-first' },
      ]
    },
    {
      title: 'Pending',
      value: '6',
      subtitle: 'Dealer approvals',
      icon: Store,
      color: 'primary',
      link: { href: '/admin-users', label: 'Review approvals' }
    },
    {
      title: 'Disputes',
      value: '2',
      subtitle: 'Open cases',
      icon: Gavel,
      color: 'amber',
      link: { href: '/admin-disputes', label: 'Go to disputes' }
    },
    {
      title: 'Payments',
      value: '$9,420',
      subtitle: 'Captured (last 7 days)',
      icon: CreditCard,
      color: 'primary',
      link: { href: '/admin-payments', label: 'View payment events' }
    }
  ],
  
  activeDeliveries: [
    {
      id: 'DLV-10392',
      type: 'Dealer',
      status: 'Active',
      statusColor: 'primary',
      driver: 'A. Johnson',
      route: 'San Jose → Los Angeles',
    },
    {
      id: 'DLV-10401',
      type: 'Individual',
      status: 'Booked',
      statusColor: 'slate',
      driver: 'K. Perez',
      route: 'San Diego → Irvine',
    },
    {
      id: 'DLV-10408',
      type: 'Dealer',
      status: 'Disputed',
      statusColor: 'amber',
      driver: 'Unassigned',
      route: 'Fresno → Sacramento',
    }
  ],

  alerts: [
    {
      type: 'warning',
      icon: Info,
      title: 'Evidence missing',
      description: 'DLV-10392 missing pickup photo set. Open delivery details to request re-upload.',
      link: '/admin-delivery/DLV-10392',
      color: 'amber'
    },
    {
      type: 'info',
      icon: Verified,
      title: 'Dealer approvals pending',
      description: '6 dealer accounts require review (approve/reject/suspend with reason).',
      link: '/admin-users',
      color: 'primary'
    }
  ],

  pricing: {
    categories: [
      { name: 'Category A (Sedan)', rate: '$1.35/mi' },
      { name: 'Category B (SUV)', rate: '$1.55/mi' },
      { name: 'Category C (Truck)', rate: '$1.75/mi' },
    ],
    insurance: '$0.20/mi'
  },

  scheduling: {
    dealer: {
      title: 'Next-day default',
      windows: 'Windows: 9am–12pm, 12pm–3pm, 3pm–6pm'
    },
    individual: {
      title: 'Same-day allowed',
      windows: 'Cutoff: 2:00pm • Max same-day: 120 miles'
    }
  },

  quickTools: [
    { href: '/admin-reports', icon: BarChart3, title: 'Reports hub', subtitle: 'Exports & KPIs' },
    { href: '/admin-config', icon: Settings, title: 'Config hub', subtitle: 'Policies & rules' },
    { href: '/admin-notification-policy', icon: Bell, title: 'Notification policy', subtitle: 'Email-first' },
    { href: '/admin-insurance-reporting', icon: FileText, title: 'Insurance report', subtitle: 'Miles & exports' },
  ]
}

export default function AdminDashboardPage() {
    const { actionItems, signOut } = useAdminActions();
  
  const StatusBadge = ({ status, color }: { status: string; color: string }) => {
    const colors = {
      primary: 'bg-primary/10 border-primary/25 text-primary-foreground',
      amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-300',
      slate: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
    }

    const icons = {
      Active: Truck,
      Booked: Calendar,
      Disputed: Gavel,
    }

    const Icon = icons[status as keyof typeof icons] || Truck

    return (
      <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold", colors[color as keyof typeof colors])}>
        <Icon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    )
  }
 
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
          <Navbar
            brand={<Brand />}
            items={navItems}
            actions={actionItems}
            onSignOut={signOut}
            title="Admin"
            />


      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Top row */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
              <Verified className="w-3.5 h-3.5 text-primary font-bold" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                Admin Ops • CA MVP
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mt-4">
              Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg max-w-2xl leading-relaxed">
              Monitor deliveries, approvals, disputes, pricing, and policy. Use filters and deep links to resolve issues fast.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/admin-users"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Review Approvals
              <Verified className="w-4 h-4 text-primary" />
            </Link>
            <Link
              to="/admin-deliveries"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition"
            >
              Open Deliveries
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* KPI cards */}
        <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MOCK_DASHBOARD.kpis.map((kpi) => (
            <Card key={kpi.title} className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
              <CardContent className="p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      {kpi.title}
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                      {kpi.value}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
                      {kpi.subtitle}
                    </p>
                  </div>
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    kpi.color === 'amber' ? 'bg-amber-500/15' : 'bg-primary/15'
                  )}>
                    <kpi.icon className={cn(
                      "w-6 h-6 font-bold",
                      kpi.color === 'amber' ? 'text-amber-500' : 'text-primary'
                    )} />
                  </div>
                </div>
                
                {kpi.chips && (
                  <div className="mt-6 flex gap-2 flex-wrap">
                    {kpi.chips.map((chip) => (
                      <Badge key={chip.label} variant="outline" className="chip-gray">
                        <chip.icon className="w-3.5 h-3.5 text-primary mr-1" />
                        {chip.label}
                      </Badge>
                    ))}
                  </div>
                )}

                {kpi.link && (
                  <div className="mt-6">
                    <Link
                      to={kpi.link.href}
                      className={cn(
                        "inline-flex items-center gap-2 text-sm font-extrabold hover:opacity-90 transition",
                        kpi.color === 'amber' ? 'text-amber-600' : 'text-primary'
                      )}
                    >
                      {kpi.link.label}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Main grid */}
        <section className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active deliveries */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Active deliveries
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Quick view. Open details for evidence, status timeline, and actions.
                    </CardDescription>
                  </div>
                  <Link
                    to="/admin-deliveries"
                    className="inline-flex items-center gap-2 text-sm font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2 rounded-2xl hover:opacity-90 transition"
                  >
                    View all
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Status
                    </Label>
                    <Select defaultValue="all-active">
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue placeholder="All active" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-active">All active</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disputed">Disputed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Dealer / Individual
                    </Label>
                    <Select defaultValue="all">
                      <SelectTrigger className="h-12 rounded-2xl">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="dealer">Dealer</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Search
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        className="h-12 w-full pl-12 pr-4 rounded-2xl"
                        placeholder="Delivery ID, dealer, driver..."
                      />
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="mt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 dark:border-slate-800">
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 py-3">
                          ID
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 py-3">
                          Type
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 py-3">
                          Status
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 py-3">
                          Driver
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 py-3">
                          Pickup → Drop-off
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 py-3 text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_DASHBOARD.activeDeliveries.map((delivery) => (
                        <TableRow key={delivery.id} className="border-slate-100 dark:border-slate-800">
                          <TableCell className="py-4 font-extrabold text-slate-900 dark:text-white">
                            {delivery.id}
                          </TableCell>
                          <TableCell className="py-4 text-slate-600 dark:text-slate-400">
                            {delivery.type}
                          </TableCell>
                          <TableCell className="py-4">
                            <StatusBadge status={delivery.status} color={delivery.statusColor} />
                          </TableCell>
                          <TableCell className="py-4 text-slate-700 dark:text-slate-300 font-semibold">
                            {delivery.driver}
                          </TableCell>
                          <TableCell className="py-4 text-slate-600 dark:text-slate-400">
                            {delivery.route}
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            <Link
                              to={`/admin-delivery/${delivery.id}`}
                              className={cn(
                                "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-extrabold transition",
                                delivery.status === 'Disputed'
                                  ? "bg-amber-600 text-white hover:opacity-90"
                                  : delivery.status === 'Active'
                                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                                  : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                              )}
                            >
                              {delivery.status === 'Disputed' ? 'Review' : 'Open'}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <p className="mt-5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Prototype data. In production, this list is filterable by status, dealer/individual, assigned driver, scheduling policy, and date range.
                </p>
              </CardContent>
            </Card>

            {/* Alerts / attention */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
              <CardHeader className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Needs attention
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Missing evidence, SLA risks, approvals waiting, and policy mismatches.
                    </CardDescription>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-primary font-bold" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-7 pt-0">
                <div className="space-y-3">
                  {MOCK_DASHBOARD.alerts.map((alert, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start justify-between gap-4 p-4 rounded-2xl",
                        alert.color === 'amber'
                          ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30"
                          : "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <alert.icon className={cn(
                          "w-5 h-5 shrink-0 mt-0.5",
                          alert.color === 'amber' ? 'text-amber-500' : 'text-primary'
                        )} />
                        <div>
                          <p className={cn(
                            "text-sm font-extrabold",
                            alert.color === 'amber' ? 'text-amber-900 dark:text-amber-200' : 'text-slate-900 dark:text-white'
                          )}>
                            {alert.title}
                          </p>
                          <p className={cn(
                            "text-[11px] mt-1",
                            alert.color === 'amber' 
                              ? 'text-amber-900/80 dark:text-amber-200/80'
                              : 'text-slate-600 dark:text-slate-400'
                          )}>
                            {alert.description}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={alert.link}
                        className={cn(
                          "text-sm font-extrabold hover:opacity-90 transition inline-flex items-center gap-1 shrink-0",
                          alert.color === 'amber' ? 'text-amber-700' : 'text-primary'
                        )}
                      >
                        Open
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Pricing snapshot */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
              <CardHeader className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Pricing snapshot
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      A/B/C categories, per-mile, and insurance fee.
                    </CardDescription>
                  </div>
                  <Link
                    to="/admin-pricing"
                    className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
                  >
                    Edit
                    <Sliders className="w-4 h-4 text-primary" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-7 pt-0">
                <div className="space-y-4">
                  {MOCK_DASHBOARD.pricing.categories.map((category) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                        {category.name}
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {category.rate}
                      </span>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      Insurance fee
                    </span>
                    <span className="text-sm font-black text-primary">
                      {MOCK_DASHBOARD.pricing.insurance}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Prototype snapshot. Real values are maintained in Admin pricing config with audit history.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Scheduling policy */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
              <CardHeader className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Scheduling policy
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Same-day/next-day defaults, cutoffs, and time windows.
                    </CardDescription>
                  </div>
                  <Link
                    to="/admin-scheduling-policy"
                    className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
                  >
                    Edit
                    <Calendar className="w-4 h-4 text-primary" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-7 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Dealer
                    </p>
                    <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DASHBOARD.scheduling.dealer.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {MOCK_DASHBOARD.scheduling.dealer.windows}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Individual
                    </p>
                    <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      {MOCK_DASHBOARD.scheduling.individual.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {MOCK_DASHBOARD.scheduling.individual.windows}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Prototype policy summary. Production policy is enforceable by region/operating hours and impacts booking availability.
                </p>
              </CardContent>
            </Card>

            {/* Quick tools */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
              <CardHeader className="p-6 sm:p-7">
                <CardTitle className="text-xl font-black">
                  Quick tools
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  Shortcuts to PRD-required admin actions and reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-7 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MOCK_DASHBOARD.quickTools.map((tool) => (
                    <Link
                      key={tool.href}
                      to={tool.href}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                          <tool.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {tool.title}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {tool.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                    </Link>
                  ))}
                </div>

                <Alert className="mt-6 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm">
                    Prototype UI
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs">
                    In the production app, these tools are permission-gated and all actions are logged (who/when/what/why).
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Admin hubs callout */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">
                      Admin hubs
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Central access to all configuration policies and reporting exports (PRD-aligned).
                    </CardDescription>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <Hub className="w-6 h-6 text-primary font-bold" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-7 pt-0">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/admin-reports"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                  >
                    Open Reports
                    <BarChart3 className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/admin-config"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                  >
                    Open Config
                    <Settings className="w-4 h-4 text-primary" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Admin Console • California-only operations
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

// Label component for filter labels
const Label = ({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-[10px] font-black uppercase tracking-[0.3em] text-slate-400", className)} {...props}>
    {children}
  </label>
)