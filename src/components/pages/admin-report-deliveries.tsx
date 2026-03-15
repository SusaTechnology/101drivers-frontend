// app/pages/admin-reports/deliveries.tsx
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
  ExternalLink,
  Sparkles,
  Activity,
  PieChart,
  LineChart,
  Bolt,
  History as Sell,
  CalendarCheck as EventAvailable,
  MapPin as NearMe,
  CheckCircle2 as TaskAlt,
  Ruler as Distance,
  MessageSquare as RequestQuote,
  History as Timeline,
  Verified,
  CalendarX as EventBusy,
  Store,
  AlertTriangle as Warning,
  Home,
  Building2,
  User,
  Phone,
  Mail,
  DollarSign,
  Receipt,
  Percent,
  Tag,
  Hash,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'

// Filter form schema
const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  dealer: z.string().optional(),
  serviceType: z.string().optional(),
  status: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data
const MOCK_DELIVERIES_REPORT = {
  kpis: [
    {
      title: 'Deliveries',
      value: '1,248',
      subtitle: 'Last 30 days',
      icon: Truck,
      trend: { value: '+6.2%', color: 'green' },
      trendLabel: 'vs previous',
    },
    {
      title: 'Completion Rate',
      value: '91.8%',
      subtitle: 'Completed / Total',
      icon: Verified,
      sparkline: true,
    },
    {
      title: 'Avg Miles',
      value: '118',
      subtitle: 'Per delivery (est.)',
      icon: Distance,
      note: 'CA-only distance estimates (prototype).',
    },
    {
      title: 'Cancellation Rate',
      value: '3.1%',
      subtitle: 'Cancelled / Total',
      icon: EventBusy,
      note: 'Includes dealer cancellations + driver no-show scenarios (PRD).',
    },
  ],

  funnel: [
    {
      stage: 'Quoted',
      icon: Bolt,
      description: 'Instant estimate generated',
      count: 1920,
      percentage: 100,
    },
    {
      stage: 'Listed',
      icon: Sell,
      description: 'Posted to marketplace',
      count: 1520,
      percentage: 79.2,
    },
    {
      stage: 'Booked',
      icon: EventAvailable,
      description: 'Driver assignment accepted',
      count: 1340,
      percentage: 69.8,
    },
    {
      stage: 'Active',
      icon: NearMe,
      description: 'Start tracking → enroute',
      count: 1286,
      percentage: 67.0,
    },
    {
      stage: 'Completed',
      icon: TaskAlt,
      description: 'Drop-off proof + closeout',
      count: 1248,
      percentage: 65.0,
    },
  ],

  breakdowns: {
    serviceTypes: [
      { name: 'Home Delivery', percentage: 52, count: 0 },
      { name: 'Between Locations', percentage: 33, count: 0 },
      { name: 'Pickup & Return', percentage: 15, count: 0 },
    ],
    topDealers: [
      { name: 'Sunset Motors', count: 412 },
      { name: 'Pacific Auto Group', count: 338 },
      { name: 'Bayline Imports', count: 271 },
    ],
    cancellations: {
      total: 39,
      reasons: [
        { label: 'Dealer cancelled', count: 18 },
        { label: 'Driver no-show', count: 9 },
        { label: 'Customer cancelled', count: 7 },
        { label: 'Other', count: 5 },
      ],
    },
  },

  deliveries: [
    {
      id: 'DLV-10482',
      route: 'San Diego → Irvine',
      dealer: 'Sunset Motors',
      driver: 'J. Carter',
      service: 'Home Delivery',
      serviceColor: 'gray',
      status: 'Completed',
      statusColor: 'green',
      miles: 98,
      total: 210.00,
      updated: 'Today 08:12',
    },
    {
      id: 'DLV-10437',
      route: 'Los Angeles → Bakersfield',
      dealer: 'Pacific Auto Group',
      driver: 'M. Nguyen',
      service: 'Between Locations',
      serviceColor: 'gray',
      status: 'Active',
      statusColor: 'amber',
      miles: 113,
      total: 245.00,
      updated: 'Today 07:20',
    },
    {
      id: 'DLV-10391',
      route: 'San Jose → Sacramento',
      dealer: 'Bayline Imports',
      driver: 'R. Diaz',
      service: 'Pickup & Return',
      serviceColor: 'gray',
      status: 'Cancelled',
      statusColor: 'rose',
      miles: 0,
      total: 0.00,
      updated: 'Yesterday 16:05',
    },
  ],

  dealers: [
    { value: 'all', label: 'All dealers' },
    { value: 'Sunset Motors', label: 'Sunset Motors' },
    { value: 'Pacific Auto Group', label: 'Pacific Auto Group' },
    { value: 'Bayline Imports', label: 'Bayline Imports' },
  ],

  serviceTypes: [
    { value: 'all', label: 'All' },
    { value: 'Home Delivery', label: 'Home Delivery' },
    { value: 'Between Locations', label: 'Between Locations' },
    { value: 'Pickup & Return', label: 'Pickup & Return' },
  ],

  statuses: [
    { value: 'all', label: 'All' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Quoted', label: 'Quoted' },
    { value: 'Listed', label: 'Listed' },
    { value: 'Booked', label: 'Booked' },
    { value: 'Active', label: 'Active' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
    { value: 'Disputed', label: 'Disputed' },
    { value: 'Expired', label: 'Expired' },
  ],
}

// Sidebar navigation items
const sidebarItems = [
  { href: '/admin-report-deliveries', label: 'Deliveries', icon: Truck, active: true },
  { href: '/admin-report-payments', label: 'Payments', icon: CreditCard },
  { href: '/admin-report-compliance', label: 'Compliance', icon: Verified },
  { href: '/admin-report-disputes', label: 'Disputes', icon: Gavel },
  { href: '/admin-insurance-reporting', label: 'Insurance & Risk', icon: Shield },
  { href: '/admin-report-ops-summary', label: 'Ops Summary', icon: BarChart3 },
]

export default function AdminDeliveriesReportPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      fromDate: '',
      toDate: '',
      dealer: '',
      serviceType: '',
      status: '',
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
      description: 'Deliveries report filtered.',
    })
    console.log('Filters:', data)
  }

  const handleResetFilters = () => {
    filterForm.reset({
      fromDate: '',
      toDate: '',
      dealer: '',
      serviceType: '',
      status: '',
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

  // Filtered deliveries based on search
  const [searchQuery, setSearchQuery] = useState('')
  const filteredDeliveries = useMemo(() => {
    if (!searchQuery) return MOCK_DELIVERIES_REPORT.deliveries

    const query = searchQuery.toLowerCase()
    return MOCK_DELIVERIES_REPORT.deliveries.filter(item =>
      item.id.toLowerCase().includes(query) ||
      item.dealer.toLowerCase().includes(query) ||
      item.driver.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // Status badge component
  const StatusBadge = ({ status, color }: { status: string; color: string }) => {
    const colors: Record<string, string> = {
      green: 'chip-green',
      amber: 'chip-amber',
      rose: 'chip-rose',
      gray: 'chip-gray',
    }

    const icons: Record<string, any> = {
      Completed: CheckCircle,
      Active: TrendingUp,
      Cancelled: XCircle,
    }

    const Icon = icons[status] || AlertCircle

    return (
      <Badge variant="outline" className={colors[color] || 'chip-gray'}>
        <Icon className="w-3.5 h-3.5 mr-1" />
        {status}
      </Badge>
    )
  }

  // Service badge component
  const ServiceBadge = ({ service, color = 'gray' }: { service: string; color?: string }) => (
    <Badge variant="outline" className="chip-gray">
      {service}
    </Badge>
  )

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
            Prototype analytics. In production, charts and tables are generated from delivery + payment events and audit logs.
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
                  Deliveries Report
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
                      <Truck className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Deliveries Report
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Delivery performance
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Monitor the end-to-end delivery funnel (Quote → Listed → Booked → Active → Completed), cancellations, mileage and pricing outcomes.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <Timeline className="w-3.5 h-3.5 text-primary mr-1" />
                        Funnel metrics
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Distance className="w-3.5 h-3.5 text-primary mr-1" />
                        Miles & regions
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <RequestQuote className="w-3.5 h-3.5 text-primary mr-1" />
                        Price breakdown
                      </Badge>
                    </div>
                  </div>

                  <div className="xl:w-[520px]">
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

                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Dealer
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('dealer', value)}
                              defaultValue=""
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All dealers" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_DELIVERIES_REPORT.dealers.map((dealer) => (
                                  <SelectItem key={dealer.value} value={dealer.value}>
                                    {dealer.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Service
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('serviceType', value)}
                              defaultValue=""
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_DELIVERIES_REPORT.serviceTypes.map((service) => (
                                  <SelectItem key={service.value} value={service.value}>
                                    {service.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Status
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('status', value)}
                              defaultValue=""
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_DELIVERIES_REPORT.statuses.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                        Exports are placeholders. Production exports include filter snapshot + audit metadata.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* KPI row */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {MOCK_DELIVERIES_REPORT.kpis.map((kpi, index) => (
                <Card key={index} className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          {kpi.title}
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                          {kpi.value}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                          {kpi.subtitle}
                        </div>
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center">
                        <kpi.icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>

                    {kpi.trend && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-extrabold">
                        <Badge variant="outline" className={kpi.trend.color === 'green' ? 'chip-green' : 'chip-amber'}>
                          {kpi.trend.value === '+6.2%' ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                          {kpi.trend.value}
                        </Badge>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">{kpi.trendLabel}</span>
                      </div>
                    )}

                    {kpi.sparkline && (
                      <svg className="w-full h-8 mt-3" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <path
                          d="M0 22 C 10 16, 18 18, 28 12 S 48 18, 58 10 S 78 8, 100 6"
                          fill="none"
                          stroke="rgba(163,230,53,0.95)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}

                    {kpi.note && (
                      <div className="mt-4 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        {kpi.note}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>

            {/* Funnel + Breakdown */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Funnel */}
              <Card className="xl:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Delivery funnel</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        From quote to completion (prototype counts).
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <Activity className="w-3.5 h-3.5 text-primary mr-1" />
                      Last 30 days
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {MOCK_DELIVERIES_REPORT.funnel.map((stage, index) => (
                      <React.Fragment key={stage.stage}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
                              <stage.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {stage.stage}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                {stage.description}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black text-slate-900 dark:text-white">
                              {stage.count.toLocaleString()}
                            </div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {stage.percentage}%
                            </div>
                          </div>
                        </div>
                        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${stage.percentage}%` }}
                          />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                        Funnel stages align with PRD lifecycle statuses. In production, counts are derived from status history + event timestamps.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Breakdown */}
              <Card className="xl:col-span-5 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Breakdowns</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Where volume and outcomes come from.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <Filter className="w-3.5 h-3.5 text-primary mr-1" />
                      Filtered
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* By service type */}
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          By service type
                        </div>
                        <Badge variant="outline" className="chip-gray">
                          <Tune className="w-3.5 h-3.5 text-primary mr-1" />
                          Mix
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-3">
                        {MOCK_DELIVERIES_REPORT.breakdowns.serviceTypes.map((item) => (
                          <div key={item.name}>
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {item.name}
                              </div>
                              <div className="text-sm font-black text-slate-900 dark:text-white">
                                {item.percentage}%
                              </div>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top dealers */}
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          Top dealers
                        </div>
                        <Badge variant="outline" className="chip-gray">
                          <Store className="w-3.5 h-3.5 text-primary mr-1" />
                          Volume
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-3">
                        {MOCK_DELIVERIES_REPORT.breakdowns.topDealers.map((dealer) => (
                          <div key={dealer.name} className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                              {dealer.name}
                            </div>
                            <Badge variant="outline" className="chip-indigo">
                              {dealer.count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cancellations */}
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          Cancellations
                        </div>
                        <Badge variant="outline" className="chip-rose">
                          <Warning className="w-3.5 h-3.5 mr-1" />
                          {MOCK_DELIVERIES_REPORT.breakdowns.cancellations.total}
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        {MOCK_DELIVERIES_REPORT.breakdowns.cancellations.reasons.map((reason) => (
                          <div key={reason.label} className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400 font-semibold">
                              {reason.label}
                            </span>
                            <span className="font-black text-slate-900 dark:text-white">
                              {reason.count}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        PRD requires tracking cancellation reasons and operational outcomes (reassignments/fees).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Drill-down Table */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black">Delivery list (drill-down)</CardTitle>
                    <CardDescription className="text-sm mt-2">
                      Search and open a delivery to view full details and proofs.
                    </CardDescription>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 w-full sm:w-[320px] pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950/40 text-sm"
                        placeholder="Search by delivery ID, dealer, driver..."
                      />
                    </div>

                    <Link
                      to="/admin-deliveries"
                      className="px-5 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition inline-flex items-center justify-center gap-2"
                    >
                      <OpenInNew className="w-4 h-4 text-primary" />
                      Open Admin Deliveries
                    </Link>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950">
                      <TableRow>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Delivery
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Dealer
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Driver
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Service
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Status
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Miles
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Total
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Updated
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredDeliveries.map((delivery) => (
                        <TableRow key={delivery.id} className="hover:bg-primary/5 transition">
                          <TableCell className="px-5 py-4">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {delivery.id}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {delivery.route}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {delivery.dealer}
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {delivery.driver}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <ServiceBadge service={delivery.service} />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <StatusBadge status={delivery.status} color={delivery.statusColor} />
                          </TableCell>
                          <TableCell className="px-5 py-4 font-black text-slate-900 dark:text-white">
                            {delivery.miles}
                          </TableCell>
                          <TableCell className="px-5 py-4 font-black text-slate-900 dark:text-white">
                            ${delivery.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                            {delivery.updated}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <Link
                              to={`/admin-delivery/${delivery.id}`}
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

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tip: Open <span className="font-bold">Admin Deliveries</span> for operational actions (reassignment, status changes, dispute escalation).
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                    >
                      Next
                    </Button>
                  </div>
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
                Admin • Deliveries Report • California-only operations
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