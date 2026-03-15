// app/pages/admin-reports/ops-summary.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Search,
  Filter,
  Download,
  FileText,
  SlidersHorizontal as Tune,
  Info,
  MapPin,
  Truck,
  CreditCard,
  Shield,
  Gavel,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  ExternalLink as OpenInNew,
  Sparkles,
  Activity,
  PieChart,
  LineChart,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  CalendarDays,
  Timer,
  Hourglass,
  DollarSign,
  Percent,
  Receipt,
  Tag,
  Hash,
  Building2,
  Phone,
  Mail,
  Home,
  Map,
  Globe,
  Layers,
  Target,
  Award,
  Zap,
  Flame,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  RefreshCw,
  Settings,
  Sliders,
  Scale,
  Flag,
  Ban,
  CheckCheck,
  FileSearch,
  FileText as FileTextIcon,
  MessageSquare,
  StickyNote as Note,
  History,
  Paperclip as AttachFile,
  Clock as Schedule,
  AlertTriangle as Warning,
  Users as Groups,
  CalendarX as EventBusy,
  BadgeCheck as FactCheck,
  BarChart3 as Insights,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

// Filter form schema
const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  region: z.string().optional(),
  serviceType: z.string().optional(),
  search: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data
const MOCK_OPS_SUMMARY = {
  kpis: [
    {
      title: 'Completed',
      value: '412',
      subtitle: 'Deliveries completed',
      icon: CheckCircle,
      color: 'emerald',
    },
    {
      title: 'Active',
      value: '27',
      subtitle: 'In progress / scheduled',
      icon: Truck,
      color: 'primary',
    },
    {
      title: 'On-time rate',
      value: '93%',
      subtitle: 'Prototype metric',
      icon: Clock,
      color: 'primary',
    },
    {
      title: 'Open disputes',
      value: '21',
      subtitle: 'Require review',
      icon: Gavel,
      color: 'amber',
    },
  ],

  driverSupply: {
    activeDrivers: 138,
    availableToday: 54,
    capacityUtilization: 68,
  },

  complianceHealth: [
    { label: 'VIN last-4 captured', value: 97 },
    { label: 'Photos complete', value: 92 },
    { label: 'Odometer start/end', value: 88 },
  ],

  paymentsPosture: {
    authorized: 48.2,
    captured: 124.7,
    failedRate: 1.8,
  },

  exceptions: [
    {
      type: 'Compliance',
      item: 'Missing drop-off photos',
      itemId: 'DLV-10488',
      severity: 'Medium',
      severityColor: 'amber',
      nextAction: 'Request upload from driver',
      link: '/admin-delivery/DLV-10488',
    },
    {
      type: 'Payments',
      item: 'Capture failed',
      itemId: 'DLV-10472',
      severity: 'High',
      severityColor: 'rose',
      nextAction: 'Retry / contact customer',
      link: '/admin-payments',
    },
    {
      type: 'Disputes',
      item: 'Escalated damage claim',
      itemId: 'DSP-00941',
      severity: 'High',
      severityColor: 'rose',
      nextAction: 'Review evidence + decide outcome',
      link: '/admin-dispute/DSP-00941',
    },
  ],

  cancellations: {
    rate: 3.1,
    topReason: 'Scheduling conflict',
    reassignments: 14,
  },

  regions: [
    { value: 'all', label: 'All California' },
    { value: 'SoCal', label: 'SoCal' },
    { value: 'Bay Area', label: 'Bay Area' },
    { value: 'Central', label: 'Central' },
    { value: 'NorCal', label: 'NorCal' },
  ],

  serviceTypes: [
    { value: 'all', label: 'All' },
    { value: 'Home Delivery', label: 'Home Delivery' },
    { value: 'Between Locations', label: 'Between Locations' },
    { value: 'Pickup & Return', label: 'Pickup & Return (Service)' },
  ],
}

// Sidebar navigation items
const sidebarItems = [
  { href: '/admin-report-deliveries', label: 'Deliveries', icon: Truck },
  { href: '/admin-report-payments', label: 'Payments', icon: CreditCard },
  { href: '/admin-report-compliance', label: 'Compliance', icon: FactCheck },
  { href: '/admin-report-disputes', label: 'Disputes', icon: Gavel },
  { href: '/admin-insurance-reporting', label: 'Insurance & Risk', icon: Shield },
  { href: '/admin-report-ops-summary', label: 'Ops Summary', icon: Insights, active: true },
]

export default function AdminOpsSummaryPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      fromDate: '',
      toDate: '',
      region: 'all',
      serviceType: 'all',
      search: '',
    },
  })

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  // Mobile menu handling
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/admin-signin' })
  }

  const handleApplyFilters = (data: FilterFormData) => {
    toast.success('Filters applied', {
      description: 'Ops summary filtered.',
    })
    console.log('Filters:', data)
  }

  const handleResetFilters = () => {
    filterForm.reset({
      fromDate: '',
      toDate: '',
      region: 'all',
      serviceType: 'all',
      search: '',
    })
    toast.info('Filters reset')
  }

  const handleExportCSV = () => {
    toast.success('Export started', {
      description: 'CSV export will be downloaded.',
    })
  }

  const handleExportPDF = () => {
    toast.success('Export started', {
      description: 'PDF report will be generated.',
    })
  }

  // Severity badge component
  const SeverityBadge = ({ severity, color }: { severity: string; color: string }) => {
    const colors: Record<string, string> = {
      amber: 'chip-amber',
      rose: 'chip-rose',
      emerald: 'chip-emerald',
      gray: 'chip-gray',
    }

    const icons: Record<string, any> = {
      Medium: AlertCircle,
      High: AlertTriangle,
      Low: Info,
    }

    const Icon = icons[severity] || AlertCircle

    return (
      <Badge variant="outline" className={colors[color] || 'chip-gray'}>
        <Icon className="w-3.5 h-3.5 mr-1" />
        {severity}
      </Badge>
    )
  }

  // Sidebar component (shared)
  const Sidebar = ({ isMobile = false }) => (
    <aside className={cn(
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 lg:p-5 h-fit",
      isMobile && "h-full overflow-y-auto pb-20"
    )}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
          Reports
        </div>
        <Link
          to="/admin-reports"
          className="text-xs font-extrabold text-primary hover:opacity-90 transition"
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
              item.active
                ? "bg-primary/15 text-slate-950 dark:text-white border border-primary/25"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
            onClick={() => isMobile && setMobileMenuOpen(false)}
          >
            <item.icon className="w-5 h-5 text-primary" />
            {item.label}
          </Link>
        ))}

        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <Link
            to="/admin-reports"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-200"
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
            Ops Summary consolidates deliveries, driver supply, cancellations, payments posture, compliance, and disputes at a glance.
          </p>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden w-11 h-11 rounded-2xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <Link to="/admin-reports" className="flex items-center gap-3" aria-label="101 Drivers Admin">
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
                  Ops Summary
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                California Only
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

            <Link
              to="/admin-reports"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-extrabold text-slate-700 dark:text-slate-200"
            >
              <ChevronLeft className="w-4 h-4 text-primary" />
              Back to Reports
            </Link>

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

      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div className={cn(
        "lg:hidden fixed z-50 top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">
            Reports
          </div>
          <Button
            variant="outline"
            size="icon"
            className="w-11 h-11 rounded-2xl"
            onClick={() => setMobileMenuOpen(false)}
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
            {/* Header + Filters */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 dark:text-white border border-primary/25 w-fit">
                      <Insights className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Ops Summary
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Operations at a glance
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Consolidated view of delivery throughput, supply, cancellations, payments posture, compliance, and disputes.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <Truck className="w-3.5 h-3.5 text-primary mr-1" />
                        Throughput
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Users className="w-3.5 h-3.5 text-primary mr-1" />
                        Supply
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <EventBusy className="w-3.5 h-3.5 text-primary mr-1" />
                        Cancellations
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <CreditCard className="w-3.5 h-3.5 text-primary mr-1" />
                        Payments
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <FactCheck className="w-3.5 h-3.5 text-primary mr-1" />
                        Compliance
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Gavel className="w-3.5 h-3.5 text-primary mr-1" />
                        Disputes
                      </Badge>
                    </div>
                  </div>

                  <div className="xl:w-[560px]">
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Filters
                        </div>
                        <Button
                          onClick={handleResetFilters}
                          variant="link"
                          className="text-xs font-extrabold text-primary hover:opacity-90 transition p-0 h-auto"
                        >
                          Reset
                        </Button>
                      </div>

                      <form onSubmit={filterForm.handleSubmit(handleApplyFilters)}>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              From
                            </Label>
                            <Input
                              type="date"
                              {...filterForm.register('fromDate')}
                              className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              To
                            </Label>
                            <Input
                              type="date"
                              {...filterForm.register('toDate')}
                              className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Region
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('region', value)}
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All California" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_OPS_SUMMARY.regions.map((region) => (
                                  <SelectItem key={region.value} value={region.value}>
                                    {region.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Service Type
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('serviceType', value)}
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_OPS_SUMMARY.serviceTypes.map((service) => (
                                  <SelectItem key={service.value} value={service.value}>
                                    {service.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Search
                            </Label>
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input
                                {...filterForm.register('search')}
                                className="h-12 w-full pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/40 text-sm"
                                placeholder="Dealer, driver, delivery ID..."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                          <Button
                            type="submit"
                            className="flex-1 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-lg hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                          >
                            <Tune className="w-4 h-4" />
                            Apply
                          </Button>
                          <Button
                            type="button"
                            onClick={handleExportCSV}
                            variant="outline"
                            className="flex-1 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4 text-primary" />
                            Export CSV
                          </Button>
                          <Button
                            type="button"
                            onClick={handleExportPDF}
                            variant="outline"
                            className="flex-1 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-2"
                          >
                            <FileText className="w-4 h-4 text-primary" />
                            Export PDF
                          </Button>
                        </div>
                      </form>

                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Prototype: sample metrics. In production, this aggregates the same data driving Deliveries, Payments, Compliance, and Disputes reports.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* KPI Row */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {MOCK_OPS_SUMMARY.kpis.map((kpi, index) => (
                <Card key={index} className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {kpi.title}
                      </div>
                      <kpi.icon className={cn(
                        "w-5 h-5",
                        kpi.color === 'emerald' ? 'text-emerald-500' : 
                        kpi.color === 'amber' ? 'text-amber-500' : 
                        'text-primary'
                      )} />
                    </div>
                    <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
                      {kpi.value}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {kpi.subtitle}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>

            {/* Mid: Supply + Compliance + Payments */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Driver supply */}
              <Card className="xl:col-span-5 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Driver supply</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Availability and readiness snapshot.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <Users className="w-3.5 h-3.5 text-primary mr-1" />
                      Supply
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Active drivers
                      </div>
                      <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                        {MOCK_OPS_SUMMARY.driverSupply.activeDrivers}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Approved & enabled
                      </p>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Available today
                      </div>
                      <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                        {MOCK_OPS_SUMMARY.driverSupply.availableToday}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Not booked / online
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Capacity utilization
                        </div>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                          {MOCK_OPS_SUMMARY.driverSupply.capacityUtilization}%
                        </span>
                      </div>
                      <div className="mt-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${MOCK_OPS_SUMMARY.driverSupply.capacityUtilization}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Booked hours vs. available hours (prototype)
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/admin-users"
                      className="flex-1 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition inline-flex items-center justify-center gap-2"
                    >
                      <Users className="w-4 h-4 text-primary" />
                      Manage Users
                    </Link>
                    <Link
                      to="/admin-scheduling-policy"
                      className="flex-1 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition inline-flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4 text-primary" />
                      Scheduling Policy
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Compliance */}
              <Card className="xl:col-span-4 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Compliance health</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Proof capture completeness.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <FactCheck className="w-3.5 h-3.5 text-primary mr-1" />
                      Compliance
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {MOCK_OPS_SUMMARY.complianceHealth.map((item) => (
                      <div key={item.label} className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {item.label}
                          </div>
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                            {item.value}%
                          </span>
                        </div>
                        <div className="mt-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 h-2.5 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                      <div className="flex items-start gap-3">
                        <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                          PRD: compliance proofs are part of the delivery record and may affect disputes and payment release.
                        </p>
                      </div>
                    </div>

                    <Link
                      to="/admin-reports-compliance"
                      className="w-full px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition inline-flex items-center justify-center gap-2"
                    >
                      <OpenInNew className="w-4 h-4 text-primary" />
                      Open Compliance Report
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Payments posture */}
              <Card className="xl:col-span-3 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-1">
                    <div>
                      <CardTitle className="text-2xl font-black">Payments posture</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Auth / capture / payout signals.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <CreditCard className="w-3.5 h-3.5 text-primary mr-1" />
                      Payments
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Authorized
                      </div>
                      <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                        ${MOCK_OPS_SUMMARY.paymentsPosture.authorized}k
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Pending completion
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Captured
                      </div>
                      <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                        ${MOCK_OPS_SUMMARY.paymentsPosture.captured}k
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Completed deliveries
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Failed payments
                        </div>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                          {MOCK_OPS_SUMMARY.paymentsPosture.failedRate}%
                        </span>
                      </div>
                      <div className="mt-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${MOCK_OPS_SUMMARY.paymentsPosture.failedRate * 10}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Prototype
                      </p>
                    </div>

                    <Link
                      to="/admin-report-payments"
                      className="w-full px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition inline-flex items-center justify-center gap-2"
                    >
                      <OpenInNew className="w-4 h-4 text-primary" />
                      Open Payments Report
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Bottom: Exceptions / Watchlist */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Exceptions */}
              <Card className="xl:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Exceptions</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        High-signal issues needing attention.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <AlertTriangle className="w-3.5 h-3.5 text-primary mr-1" />
                      Watchlist
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-950">
                        <TableRow>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Type
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Item
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Severity
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Next action
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {MOCK_OPS_SUMMARY.exceptions.map((exception, index) => (
                          <TableRow key={index} className="hover:bg-primary/5 transition">
                            <TableCell className="px-5 py-4 font-extrabold text-slate-900 dark:text-white">
                              {exception.type}
                            </TableCell>
                            <TableCell className="px-5 py-4">
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {exception.item}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                {exception.itemId}
                              </div>
                            </TableCell>
                            <TableCell className="px-5 py-4">
                              <SeverityBadge severity={exception.severity} color={exception.severityColor} />
                            </TableCell>
                            <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                              {exception.nextAction}
                            </TableCell>
                            <TableCell className="px-5 py-4">
                              <Link
                                to={exception.link}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition text-xs font-extrabold text-slate-700 dark:text-slate-200"
                              >
                                <OpenInNew className="w-4 h-4 text-primary" />
                                View
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    PRD alignment: exceptions are derived from compliance checklist gaps, payment failures/holds, cancellations, and disputes.
                  </p>
                </CardContent>
              </Card>

              {/* Cancellations / Drop-off */}
              <Card className="xl:col-span-5 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Cancellations & drops</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Key loss points to monitor.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <EventBusy className="w-3.5 h-3.5 text-primary mr-1" />
                      Health
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Cancellation rate
                        </div>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                          {MOCK_OPS_SUMMARY.cancellations.rate}%
                        </span>
                      </div>
                      <div className="mt-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${MOCK_OPS_SUMMARY.cancellations.rate * 10}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Prototype
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Top cancel reason
                      </div>
                      <div className="mt-2 font-black text-slate-900 dark:text-white">
                        {MOCK_OPS_SUMMARY.cancellations.topReason}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Policy-driven windows
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Reassignments
                      </div>
                      <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                        {MOCK_OPS_SUMMARY.cancellations.reassignments}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Driver changes (prototype)
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link
                        to="/admin-deliveries"
                        className="flex-1 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition inline-flex items-center justify-center gap-2"
                      >
                        <OpenInNew className="w-4 h-4 text-primary" />
                        Deliveries
                      </Link>
                      <Link
                        to="/admin-disputes"
                        className="flex-1 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition inline-flex items-center justify-center gap-2"
                      >
                        <OpenInNew className="w-4 h-4 text-primary" />
                        Disputes
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
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
                Admin • Ops Summary • California-only operations
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