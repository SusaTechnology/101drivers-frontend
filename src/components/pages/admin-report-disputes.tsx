// app/pages/admin-reports/disputes.tsx
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
  Gavel,
  Shield,
  CreditCard,
  Truck,
  Verified,
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
  Scale,
  Flag,
  Ban,
  CheckCheck,
  Hourglass,
  Timer,
  Car,
  Receipt,
  Tag,
  Hash,
  User,
  Building2,
  Phone,
  Mail,
  DollarSign,
  Percent,
  FileSearch,
  FileText as FileTextIcon,
  MessageSquare,
  StickyNote as Note,
  History,
  Paperclip as AttachFile,
  Clock as Schedule,
  AlertTriangle as Warning,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
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
  status: z.string().optional(),
  outcome: z.string().optional(),
  search: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data
const MOCK_DISPUTES_REPORT = {
  overview: {
    totalDisputes: 64,
    openDisputes: 21,
    avgResolution: 4.6,
  },

  aging: [
    { range: '0–2 days', count: 11, percentage: 52 },
    { range: '3–7 days', count: 7, percentage: 34 },
    { range: '8–14 days', count: 2, percentage: 10 },
    { range: '15+ days', count: 1, percentage: 5, note: 'Escalate long-running cases per policy.' },
  ],

  insights: {
    commonReason: {
      label: 'Damage claim',
      description: 'Photos + checklist review',
    },
    topOutcome: {
      label: 'Credit',
      description: 'Applied to next invoice',
    },
  },

  statusOptions: [
    { value: 'all', label: 'All' },
    { value: 'Open', label: 'Open' },
    { value: 'Under Review', label: 'Under Review' },
    { value: 'Awaiting Info', label: 'Awaiting Info' },
    { value: 'Escalated', label: 'Escalated' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'Rejected', label: 'Rejected' },
  ],

  outcomeOptions: [
    { value: 'all', label: 'All' },
    { value: 'Refund', label: 'Refund' },
    { value: 'Credit', label: 'Credit' },
    { value: 'Chargeback', label: 'Chargeback' },
    { value: 'No Action', label: 'No Action' },
    { value: 'Policy Exception', label: 'Policy Exception' },
  ],

  disputesList: [
    {
      id: 'DSP-00941',
      filedBy: 'Dealer',
      delivery: {
        id: 'DLV-10477',
        route: 'Los Angeles → San Diego',
      },
      dealer: 'Sunset Motors',
      driver: 'A. Ramirez',
      reason: 'Damage claim',
      reasonIcon: Car,
      status: 'Under Review',
      statusColor: 'amber',
      age: '2d',
    },
    {
      id: 'DSP-00912',
      filedBy: 'Customer',
      delivery: {
        id: 'DLV-10431',
        route: 'Sacramento → Oakland',
      },
      dealer: 'Pacific Auto Group',
      driver: 'K. Nguyen',
      reason: 'Delay',
      reasonIcon: Schedule,
      status: 'Awaiting Info',
      statusColor: 'indigo',
      age: '5d',
    },
    {
      id: 'DSP-00866',
      filedBy: 'Dealer',
      delivery: {
        id: 'DLV-10305',
        route: 'Fresno → San Jose',
      },
      dealer: 'Bayline Imports',
      driver: 'J. Patel',
      reason: 'Pricing mismatch',
      reasonIcon: Receipt,
      status: 'Resolved',
      statusColor: 'emerald',
      age: '9d',
    },
  ],
}

// Sidebar navigation items
const sidebarItems = [
  { href: '/admin-report-deliveries', label: 'Deliveries', icon: Truck },
  { href: '/admin-reports-payments', label: 'Payments', icon: CreditCard },
  { href: '/admin-report-compliance', label: 'Compliance', icon: Verified },
  { href: '/admin-report-disputes', label: 'Disputes', icon: Gavel, active: true },
  { href: '/admin-insurance-reporting', label: 'Insurance & Risk', icon: Shield },
  { href: '/admin-report-ops-summary', label: 'Ops Summary', icon: BarChart3 },
]

export default function AdminDisputesReportPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      fromDate: '',
      toDate: '',
      status: 'all',
      outcome: 'all',
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
      description: 'Disputes report filtered.',
    })
    console.log('Filters:', data)
  }

  const handleResetFilters = () => {
    filterForm.reset({
      fromDate: '',
      toDate: '',
      status: 'all',
      outcome: 'all',
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

  // Filtered disputes based on search
  const searchQuery = filterForm.watch('search')
  const filteredDisputes = useMemo(() => {
    if (!searchQuery) return MOCK_DISPUTES_REPORT.disputesList

    const query = searchQuery.toLowerCase()
    return MOCK_DISPUTES_REPORT.disputesList.filter(item =>
      item.id.toLowerCase().includes(query) ||
      item.delivery.id.toLowerCase().includes(query) ||
      item.dealer.toLowerCase().includes(query) ||
      item.driver.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // Status badge component
  const StatusBadge = ({ status, color }: { status: string; color: string }) => {
    const colors: Record<string, string> = {
      amber: 'chip-amber',
      indigo: 'chip-indigo',
      emerald: 'chip-emerald',
      rose: 'chip-rose',
      gray: 'chip-gray',
    }

    const icons: Record<string, any> = {
      'Under Review': Search,
      'Awaiting Info': Hourglass,
      'Resolved': CheckCircle,
      'Open': AlertCircle,
      'Escalated': AlertTriangle,
      'Rejected': XCircle,
    }

    const Icon = icons[status] || AlertCircle

    return (
      <Badge variant="outline" className={colors[color] || 'chip-gray'}>
        <Icon className="w-3.5 h-3.5 mr-1" />
        {status}
      </Badge>
    )
  }

  // Reason badge component
  const ReasonBadge = ({ reason, icon: Icon }: { reason: string; icon: any }) => (
    <Badge variant="outline" className="chip-gray">
      <Icon className="w-3.5 h-3.5 text-primary mr-1" />
      {reason}
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
            PRD: Disputes include capture of reason, evidence review, internal notes, status history, and resolution actions.
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
                  Disputes Report
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
                      <Gavel className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Disputes Report
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Claims, investigations, and resolutions
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Track dispute volume, status, and resolution performance across dealers and drivers. Review evidence links and escalation needs.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <Clock className="w-3.5 h-3.5 text-primary mr-1" />
                        Aging
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <History className="w-3.5 h-3.5 text-primary mr-1" />
                        Status history
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <AttachFile className="w-3.5 h-3.5 text-primary mr-1" />
                        Evidence
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Note className="w-3.5 h-3.5 text-primary mr-1" />
                        Internal notes
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
                              Status
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('status', value)}
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_DISPUTES_REPORT.statusOptions.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Outcome
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('outcome', value)}
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_DISPUTES_REPORT.outcomeOptions.map((outcome) => (
                                  <SelectItem key={outcome.value} value={outcome.value}>
                                    {outcome.label}
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
                                placeholder="Dispute ID, Delivery ID, Dealer, Driver..."
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
                        Prototype: these are sample metrics. In production, disputes sync with delivery timeline + evidence gallery.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* KPI + Aging */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Dispute overview */}
              <Card className="xl:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Dispute overview</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Volume, open count, and resolution pace.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <BarChart3 className="w-3.5 h-3.5 text-primary mr-1" />
                      KPI
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover-lift">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Total disputes
                        </div>
                        <Gavel className="w-5 h-5 text-primary" />
                      </div>
                      <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
                        {MOCK_DISPUTES_REPORT.overview.totalDisputes}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Selected date range
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover-lift">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Open
                        </div>
                        <AlertCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
                        {MOCK_DISPUTES_REPORT.overview.openDisputes}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Need review / action
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover-lift">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                          Avg resolution
                        </div>
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
                        {MOCK_DISPUTES_REPORT.overview.avgResolution}
                        <span className="text-base font-black text-slate-500">d</span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Prototype SLA
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                        PRD: disputes can impact payouts and customer satisfaction; resolution actions may include refunds/credits or policy decisions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Aging buckets */}
              <Card className="xl:col-span-5 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Aging buckets</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Open disputes by age.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <Hourglass className="w-3.5 h-3.5 text-primary mr-1" />
                      Aging
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {MOCK_DISPUTES_REPORT.aging.map((bucket) => (
                      <div key={bucket.range}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {bucket.range}
                          </div>
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            {bucket.count}
                          </div>
                        </div>
                        <div className="mt-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 h-2.5 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${bucket.percentage}%` }}
                          />
                        </div>
                        {bucket.note && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                            {bucket.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Most common reason
                      </div>
                      <div className="mt-2 font-black text-slate-900 dark:text-white">
                        {MOCK_DISPUTES_REPORT.insights.commonReason.label}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {MOCK_DISPUTES_REPORT.insights.commonReason.description}
                      </p>
                    </div>
                    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Top outcome
                      </div>
                      <div className="mt-2 font-black text-slate-900 dark:text-white">
                        {MOCK_DISPUTES_REPORT.insights.topOutcome.label}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {MOCK_DISPUTES_REPORT.insights.topOutcome.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Disputes Table */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black">Disputes list</CardTitle>
                    <CardDescription className="text-sm mt-2">
                      Click into details to review evidence and resolution actions.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="chip-gray">
                      <Filter className="w-3.5 h-3.5 text-primary mr-1" />
                      Filterable
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950">
                      <TableRow>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Dispute
                        </TableHead>
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
                          Reason
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Status
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Age
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredDisputes.map((dispute) => (
                        <TableRow key={dispute.id} className="hover:bg-primary/5 transition">
                          <TableCell className="px-5 py-4">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {dispute.id}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              Filed by {dispute.filedBy}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {dispute.delivery.id}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {dispute.delivery.route}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {dispute.dealer}
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {dispute.driver}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <ReasonBadge reason={dispute.reason} icon={dispute.reasonIcon} />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <StatusBadge status={dispute.status} color={dispute.statusColor} />
                          </TableCell>
                          <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                            {dispute.age}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <Link
                              to={`/admin-dispute/${dispute.id}`}
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
                    Next step for each item: open <span className="font-bold">Dispute Details</span> to review evidence, notes, actions, and status history.
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
                Admin • Disputes Report • California-only operations
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