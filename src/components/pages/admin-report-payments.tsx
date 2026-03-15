// app/pages/admin-reports/payments.tsx
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
  CreditCard,
  Shield,
  Gavel,
  Truck,
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
  DollarSign,
  Percent,
  Receipt,
  Tag,
  Hash,
  Building2,
  Phone,
  Mail,
  Home,
  Lock,
  BadgeDollarSign as Paid,
  ArrowLeftRight as CurrencyExchange,
  Wallet as AccountBalanceWallet,
  Receipt as ReceiptLong,
  BarChart3 as Insights,
  CheckCircle2 as TaskAlt,
  Clock as Schedule,
  Hourglass as HourglassTop,
  ArrowUp,
  ArrowDown,
  Banknote,
  Wallet,
  CreditCard as CreditCardIcon,
  Landmark,
  PiggyBank,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AlertOctagon,
  Ban,
  CheckCheck,
  FileSearch,
  FileText as FileTextIcon,
  MessageSquare,
  StickyNote as Note,
  History,
  Paperclip as AttachFile,
  RefreshCw,
  Settings,
  Sliders,
  Scale,
  Flag,
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
import { Progress } from '@/components/ui/progress'

// Filter form schema
const filterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  paymentStatus: z.string().optional(),
  method: z.string().optional(),
  dealer: z.string().optional(),
  search: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data
const MOCK_PAYMENTS_REPORT = {
  kpis: [
    {
      title: 'Gross Volume',
      value: '286.4k',
      subtitle: 'Captured (last 30 days)',
      icon: Paid,
      trend: { value: '+4.7%', color: 'green' },
      trendLabel: 'vs previous',
    },
    {
      title: 'Authorized (Hold)',
      value: '41.2k',
      subtitle: 'Open authorizations',
      icon: Lock,
      sparkline: true,
    },
    {
      title: 'Refunds',
      value: '8.9k',
      subtitle: 'Refunded (last 30 days)',
      icon: CurrencyExchange,
      chip: { label: '3.1% rate', color: 'amber' },
      chipLabel: 'of captured',
    },
    {
      title: 'Driver Payouts',
      value: '173.6k',
      subtitle: 'Scheduled/paid',
      icon: AccountBalanceWallet,
      note: 'Includes payout batches + adjustments (prototype).',
    },
  ],

  netRevenue: {
    captured: 286400,
    refunded: 8900,
    processorFees: 6120,
    platformFees: 45330,
    net: 316710,
  },

  payoutBatches: [
    {
      id: 'P-2207',
      drivers: 27,
      deliveries: 144,
      status: 'Paid',
      statusColor: 'green',
      total: 41820,
    },
    {
      id: 'P-2208',
      drivers: 31,
      deliveries: 162,
      status: 'Scheduled',
      statusColor: 'amber',
      total: 46115,
    },
    {
      id: 'P-2209',
      drivers: 14,
      deliveries: 68,
      status: 'Draft',
      statusColor: 'gray',
      total: 18730,
    },
  ],

  transactions: [
    {
      id: 'PAY-88921',
      processor: '•• 4242 (masked)',
      delivery: 'DLV-10482',
      dealer: 'Sunset Motors',
      status: 'Captured',
      statusColor: 'green',
      method: 'Card',
      amount: 210.00,
      fees: 5.43,
      updated: 'Today 08:14',
    },
    {
      id: 'PAY-88810',
      processor: 'Hold placed (auth)',
      delivery: 'DLV-10437',
      dealer: 'Pacific Auto Group',
      status: 'Authorized',
      statusColor: 'amber',
      method: 'Card',
      amount: 245.00,
      fees: 0.00,
      updated: 'Today 07:21',
    },
    {
      id: 'PAY-88602',
      processor: 'Refund issued',
      delivery: 'DLV-10312',
      dealer: 'Bayline Imports',
      status: 'Refunded',
      statusColor: 'rose',
      method: 'ACH',
      amount: 180.00,
      fees: 1.20,
      updated: 'Yesterday 15:44',
    },
  ],

  statusOptions: [
    { value: 'all', label: 'All' },
    { value: 'Authorized', label: 'Authorized' },
    { value: 'Captured', label: 'Captured' },
    { value: 'Partially Refunded', label: 'Partially Refunded' },
    { value: 'Refunded', label: 'Refunded' },
    { value: 'Failed', label: 'Failed' },
    { value: 'Disputed', label: 'Disputed / Chargeback' },
  ],

  methodOptions: [
    { value: 'all', label: 'All' },
    { value: 'Card', label: 'Card' },
    { value: 'ACH', label: 'ACH' },
    { value: 'Wallet', label: 'Wallet' },
    { value: 'Manual', label: 'Manual' },
  ],

  dealerOptions: [
    { value: 'all', label: 'All dealers' },
    { value: 'Sunset Motors', label: 'Sunset Motors' },
    { value: 'Pacific Auto Group', label: 'Pacific Auto Group' },
    { value: 'Bayline Imports', label: 'Bayline Imports' },
  ],
}

// Sidebar navigation items
const sidebarItems = [
  { href: '/admin-reports-deliveries', label: 'Deliveries', icon: Truck },
  { href: '/admin-reports-payments', label: 'Payments', icon: CreditCard, active: true },
  { href: '/admin-reports-compliance', label: 'Compliance', icon: Shield },
  { href: '/admin-reports-disputes', label: 'Disputes', icon: Gavel },
  { href: '/admin-insurance-reporting', label: 'Insurance & Risk', icon: Shield },
  { href: '/admin-reports-ops-summary', label: 'Ops Summary', icon: BarChart3 },
]

export default function AdminPaymentsReportPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      fromDate: '',
      toDate: '',
      paymentStatus: 'all',
      method: 'all',
      dealer: 'all',
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
      description: 'Payments report filtered.',
    })
    console.log('Filters:', data)
  }

  const handleResetFilters = () => {
    filterForm.reset({
      fromDate: '',
      toDate: '',
      paymentStatus: 'all',
      method: 'all',
      dealer: 'all',
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

  // Filtered transactions based on search
  const searchQuery = filterForm.watch('search')
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return MOCK_PAYMENTS_REPORT.transactions

    const query = searchQuery.toLowerCase()
    return MOCK_PAYMENTS_REPORT.transactions.filter(item =>
      item.id.toLowerCase().includes(query) ||
      item.delivery.toLowerCase().includes(query) ||
      item.dealer.toLowerCase().includes(query)
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
      Captured: CheckCircle,
      Authorized: Lock,
      Refunded: CurrencyExchange,
      Scheduled: Schedule,
      Paid: TaskAlt,
      Draft: HourglassTop,
    }

    const Icon = icons[status] || AlertCircle

    return (
      <Badge variant="outline" className={colors[color] || 'chip-gray'}>
        <Icon className="w-3.5 h-3.5 mr-1" />
        {status}
      </Badge>
    )
  }

  // Method badge component
  const MethodBadge = ({ method }: { method: string }) => (
    <Badge variant="outline" className="chip-gray">
      {method === 'Card' && <CreditCardIcon className="w-3.5 h-3.5 text-primary mr-1" />}
      {method === 'ACH' && <Landmark className="w-3.5 h-3.5 text-primary mr-1" />}
      {method === 'Wallet' && <Wallet className="w-3.5 h-3.5 text-primary mr-1" />}
      {method === 'Manual' && <Settings className="w-3.5 h-3.5 text-primary mr-1" />}
      {method}
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
            PRD: payments include auth/hold, capture, refunds, fees, payouts, and payment event history.
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
                  Payments Report
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
                      <CreditCard className="w-3.5 h-3.5 text-primary font-bold" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Payments Report
                      </span>
                    </div>

                    <CardTitle className="text-3xl sm:text-4xl font-black mt-5">
                      Money flow & settlements
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                      Track authorization/hold, capture, refunds, fees, and driver payouts. Includes payment-event history and reconciliation-ready exports.
                    </CardDescription>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge variant="outline" className="chip-gray">
                        <Lock className="w-3.5 h-3.5 text-primary mr-1" />
                        Auth / Hold
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <Paid className="w-3.5 h-3.5 text-primary mr-1" />
                        Capture
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <CurrencyExchange className="w-3.5 h-3.5 text-primary mr-1" />
                        Refunds & Adjustments
                      </Badge>
                      <Badge variant="outline" className="chip-gray">
                        <AccountBalanceWallet className="w-3.5 h-3.5 text-primary mr-1" />
                        Driver payouts
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
                              Payment Status
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('paymentStatus', value)}
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_PAYMENTS_REPORT.statusOptions.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Method
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('method', value)}
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_PAYMENTS_REPORT.methodOptions.map((method) => (
                                  <SelectItem key={method.value} value={method.value}>
                                    {method.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="sm:col-span-2 space-y-2">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              Dealer
                            </Label>
                            <Select
                              onValueChange={(value) => filterForm.setValue('dealer', value)}
                              defaultValue="all"
                            >
                              <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/40">
                                <SelectValue placeholder="All dealers" />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_PAYMENTS_REPORT.dealerOptions.map((dealer) => (
                                  <SelectItem key={dealer.value} value={dealer.value}>
                                    {dealer.label}
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
                                placeholder="Payment ID, Delivery ID, customer email..."
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
                        Exports are placeholders. Production exports include processor reference IDs and event timelines.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* KPI row */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {MOCK_PAYMENTS_REPORT.kpis.map((kpi, index) => (
                <Card key={index} className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          {kpi.title}
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                          ${kpi.value}
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
                          {kpi.trend.value === '+4.7%' ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                          {kpi.trend.value}
                        </Badge>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">{kpi.trendLabel}</span>
                      </div>
                    )}

                    {kpi.sparkline && (
                      <svg className="w-full h-8 mt-3" viewBox="0 0 100 30" preserveAspectRatio="none">
                        <path
                          d="M0 18 C 10 20, 18 14, 28 16 S 48 22, 58 16 S 78 10, 100 12"
                          fill="none"
                          stroke="rgba(163,230,53,0.95)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}

                    {kpi.chip && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-extrabold">
                        <Badge variant="outline" className={kpi.chip.color === 'amber' ? 'chip-amber' : 'chip-gray'}>
                          <Info className="w-3.5 h-3.5 mr-1" />
                          {kpi.chip.label}
                        </Badge>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">{kpi.chipLabel}</span>
                      </div>
                    )}

                    {kpi.note && (
                      <div className="mt-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {kpi.note}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>

            {/* Settlement + Fees */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Net revenue view */}
              <Card className="xl:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Net revenue view</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Captured less fees and refunds, plus adjustments.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="chip-gray">
                      <ReceiptLong className="w-3.5 h-3.5 text-primary mr-1" />
                      Finance-ready
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Captured
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                        ${MOCK_PAYMENTS_REPORT.netRevenue.captured.toLocaleString()}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-2">
                        All captured payments in range.
                      </p>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Refunded
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                        -${MOCK_PAYMENTS_REPORT.netRevenue.refunded.toLocaleString()}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-2">
                        Full + partial refunds.
                      </p>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Processor Fees
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                        -${MOCK_PAYMENTS_REPORT.netRevenue.processorFees.toLocaleString()}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-2">
                        Card/ACH fees (placeholder).
                      </p>
                    </div>
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Platform Fees
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                        ${MOCK_PAYMENTS_REPORT.netRevenue.platformFees.toLocaleString()}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-2">
                        Coordination & policy-based fees.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          Net (estimate)
                        </div>
                        <div className="text-3xl font-black text-primary mt-2">
                          ${MOCK_PAYMENTS_REPORT.netRevenue.net.toLocaleString()}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                          Captured - refunds - processor fees + platform fees (prototype).
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                        <Insights className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                        PRD: Admin must be able to see payment timeline events (auth → capture → payout → refund/chargeback) and export reconciliation data.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payout batches */}
              <Card className="xl:col-span-5 border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-black">Payout batches</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        Driver settlements grouped by batch.
                      </CardDescription>
                    </div>
                    <Link
                      to="/admin-payments"
                      className="text-xs font-extrabold text-primary hover:opacity-90 transition inline-flex items-center gap-1"
                    >
                      Open Admin Payments
                      <OpenInNew className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {MOCK_PAYMENTS_REPORT.payoutBatches.map((batch) => (
                      <div
                        key={batch.id}
                        className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover-lift"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              Batch #{batch.id}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                              {batch.drivers} drivers • {batch.deliveries} deliveries
                            </div>
                          </div>
                          <StatusBadge status={batch.status} color={batch.statusColor} />
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Total payout
                          </div>
                          <div className="text-lg font-black text-slate-900 dark:text-white">
                            ${batch.total.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    In production: batch drill-down shows included deliveries, fees, payout method, and payout event history.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Payments table */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black">Payment transactions</CardTitle>
                    <CardDescription className="text-sm mt-2">
                      Drill down to see processor references and full event timeline.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="chip-gray">
                      <Shield className="w-3.5 h-3.5 text-primary mr-1" />
                      PCI-safe view
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
                          Payment
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Delivery
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Dealer
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Status
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Method
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Amount
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Fees
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Updated
                        </TableHead>
                        <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-primary/5 transition">
                          <TableCell className="px-5 py-4">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              {transaction.id}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {transaction.processor}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {transaction.delivery}
                          </TableCell>
                          <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                            {transaction.dealer}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <StatusBadge status={transaction.status} color={transaction.statusColor} />
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <MethodBadge method={transaction.method} />
                          </TableCell>
                          <TableCell className="px-5 py-4 font-black text-slate-900 dark:text-white">
                            ${transaction.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="px-5 py-4 font-black text-slate-900 dark:text-white">
                            ${transaction.fees.toFixed(2)}
                          </TableCell>
                          <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                            {transaction.updated}
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <Link
                              to="/admin-payments"
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
                    Tip: Use <span className="font-bold">Admin Payments</span> for operational actions (retry, manual adjustment, refund, chargeback workflow).
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
                Admin • Payments Report • California-only operations
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