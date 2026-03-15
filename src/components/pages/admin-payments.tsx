// app/pages/admin-payments.tsx
import React, { useState, useEffect } from 'react'
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
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Search,
  Filter,
  Bookmark,
  RotateCcw,
  Calendar,
  Eye,
  ExternalLink as OpenInNew,
  Lock,
  Undo,
  FileWarning as Warning,
  SlidersHorizontal as Tune,
  Gavel,
  Ban as Block,
  BadgeDollarSign as Paid,
  Bolt,
  CheckCircle2 as TaskAlt,
  ArrowRight as ArrowForward,
  CreditCard,
  DollarSign,
  Receipt,
  RefreshCw,
  Shield,
  AlertTriangle,
  Clock,
  CheckCheck,
  XCircle,
  Hourglass,
  TrendingUp,
  TrendingDown,
  Users,
  Truck,
  Building2,
  User,
  Mail,
  Phone,
  CalendarDays,
  FileText,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { navItems } from '@/lib/items/navItems'
import { useAdminActions } from '@/hooks/useAdminActions'

// Filter form schema
const filterSchema = z.object({
  search: z.string().optional(),
  eventType: z.string().optional(),
  status: z.string().optional(),
  dateRange: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data
const MOCK_PAYMENTS = {
  kpis: [
    {
      label: 'Today captured',
      value: '$12,840',
      subtitle: '20 captures • prototype',
      icon: TrendingUp,
      color: 'emerald',
    },
    {
      label: 'Refunds today',
      value: '$1,120',
      subtitle: '6 refunds • prototype',
      icon: TrendingDown,
      color: 'amber',
    },
    {
      label: 'Pending auth',
      value: '$3,450',
      subtitle: 'Holds not captured',
      icon: Clock,
      color: 'blue',
    },
    {
      label: 'Chargebacks',
      value: '2',
      subtitle: 'Open cases',
      icon: AlertTriangle,
      color: 'rose',
    },
  ],

  events: [
    {
      id: '1',
      timestamp: 'Feb 11, 2026 18:22',
      delivery: {
        id: 'DEL-90211',
        route: 'San Jose → Los Angeles',
      },
      event: {
        type: 'Capture',
        icon: Paid,
        color: 'slate',
      },
      amount: 230.00,
      status: {
        label: 'Succeeded',
        color: 'emerald',
        icon: CheckCircle,
      },
      customer: 'olivia@example.com',
      driver: 'D-00192',
      providerId: 'CAP-7A21',
      actions: ['view'],
    },
    {
      id: '2',
      timestamp: 'Feb 11, 2026 18:10',
      delivery: {
        id: 'DEL-90208',
        route: 'Oakland → Sacramento',
      },
      event: {
        type: 'Authorization',
        icon: Lock,
        color: 'slate',
      },
      amount: 145.00,
      status: {
        label: 'Pending',
        color: 'amber',
        icon: Hourglass,
      },
      customer: 'maria@example.com',
      driver: 'D-00407',
      providerId: 'AUTH-91CF',
      actions: ['capture', 'void'],
    },
    {
      id: '3',
      timestamp: 'Feb 10, 2026 16:44',
      delivery: {
        id: 'DEL-90177',
        route: 'San Diego → Irvine',
      },
      event: {
        type: 'Refund',
        icon: Undo,
        color: 'slate',
      },
      amount: 75.00,
      status: {
        label: 'Succeeded',
        color: 'emerald',
        icon: CheckCircle,
      },
      customer: 'jason@example.com',
      driver: 'D-00211',
      providerId: 'REF-2C90',
      actions: ['dispute', 'view'],
    },
    {
      id: '4',
      timestamp: 'Feb 09, 2026 11:05',
      delivery: {
        id: 'DEL-90120',
        route: 'Fresno → Bakersfield',
      },
      event: {
        type: 'Chargeback',
        icon: Warning,
        color: 'slate',
      },
      amount: 210.00,
      status: {
        label: 'Disputed',
        color: 'rose',
        icon: AlertCircle,
      },
      customer: 'ben@example.com',
      driver: 'D-00088',
      providerId: 'CB-0A12',
      actions: ['review'],
    },
    {
      id: '5',
      timestamp: 'Feb 09, 2026 09:18',
      delivery: {
        id: 'DEL-90112',
        route: 'Riverside → Long Beach',
      },
      event: {
        type: 'Adjustment',
        icon: Tune,
        color: 'slate',
      },
      amount: -20.00,
      status: {
        label: 'Succeeded',
        color: 'emerald',
        icon: CheckCircle,
      },
      customer: 'kate@example.com',
      driver: 'D-00305',
      providerId: 'ADJ-33D1',
      actions: ['view'],
    },
  ],

  totalEvents: 24,
  showingEvents: 5,
}



export default function AdminPaymentsPage() {
  const { actionItems, signOut } = useAdminActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [captureModalOpen, setCaptureModalOpen] = useState(false)
  const [voidModalOpen, setVoidModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: '',
      eventType: 'All',
      status: 'All',
      dateRange: 'Last 7 days',
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

  const handleExportCSV = () => {
    toast.success('Export started', {
      description: 'Your payment report is being generated as CSV.',
    })
  }

  const handleReconcile = () => {
    toast.info('Reconciliation started', {
      description: 'Matching payments with delivery records...',
    })
  }

  const handleSavedViews = () => {
    toast.info('Saved views', {
      description: 'Manage your saved filter views.',
    })
  }

  const handleReset = () => {
    filterForm.reset({
      search: '',
      eventType: 'All',
      status: 'All',
      dateRange: 'Last 7 days',
    })
    toast.info('Filters reset')
  }

  const handleApplyFilters = (data: FilterFormData) => {
    toast.success('Filters applied', {
      description: 'Showing filtered payment events.',
    })
    console.log('Filters:', data)
  }

  const handleCapture = (payment: any) => {
    setSelectedPayment(payment)
    setCaptureModalOpen(true)
  }

  const handleConfirmCapture = () => {
    toast.success('Payment captured', {
      description: `Payment of $${selectedPayment?.amount.toFixed(2)} has been captured.`,
    })
    setCaptureModalOpen(false)
  }

  const handleVoid = (payment: any) => {
    setSelectedPayment(payment)
    setVoidModalOpen(true)
  }

  const handleConfirmVoid = () => {
    toast.warning('Authorization voided', {
      description: `Authorization of $${selectedPayment?.amount.toFixed(2)} has been voided.`,
    })
    setVoidModalOpen(false)
  }

  const handleDispute = (payment: any) => {
    toast.info('Dispute opened', {
      description: `Dispute case created for payment ${payment.providerId}.`,
    })
    navigate({ to: '/admin-dispute-details' })
  }

  const handleReviewChargeback = (payment: any) => {
    navigate({ to: '/admin-dispute/CB-0A12' })
  }

  // Status badge component
  const StatusBadge = ({ 
    status, 
    color = 'slate', 
    icon: Icon,
    className 
  }: { 
    status: string; 
    color?: string; 
    icon?: any;
    className?: string;
  }) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
      amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
      rose: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200',
      slate: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200',
      blue: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-900 dark:text-blue-200',
      indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
    }

    const StatusIcon = Icon || CheckCircle

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border",
          colors[color] || colors.slate,
          className
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    )
  }

  // Event badge component
  const EventBadge = ({ 
    event, 
    icon: Icon, 
    color = 'slate' 
  }: { 
    event: string; 
    icon?: any; 
    color?: string 
  }) => {
    return (
      <Badge 
        variant="outline" 
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
        {event}
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
        {/* Header */}
        <section className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                <Paid className="w-4 h-4 text-primary mr-1" />
                Payments
              </Badge>
              <Badge variant="outline" className="pill bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200">
                <Bolt className="w-3.5 h-3.5 text-indigo-500 mr-1" />
                Events + Audit (PRD)
              </Badge>
              <Badge variant="outline" className="pill bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200">
                <Info className="w-3.5 h-3.5 text-amber-500 mr-1" />
                Prototype data
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Payments & Refunds
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Monitor payment events (auth, capture, refunds), resolve discrepancies, and apply admin adjustments. 
              Email-first notifications; SMS optional by policy.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <Download className="w-4 h-4 text-primary" />
              Export CSV
            </Button>
            <Button
              onClick={handleReconcile}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              <TaskAlt className="w-4 h-4" />
              Reconcile
            </Button>
          </div>
        </section>

        {/* KPIs */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          {MOCK_PAYMENTS.kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <CardContent className="p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {kpi.label}
                </div>
                <div className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
                  {kpi.value}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  {kpi.subtitle}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Filters */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">Search & Filters</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Find by payment ID, delivery ID, customer, driver, or status.
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleSavedViews}
                    variant="outline"
                    size="sm"
                    className="btn-soft"
                  >
                    <Bookmark className="w-4 h-4 text-primary mr-2" />
                    Saved views
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                    className="btn-ghost"
                  >
                    <RotateCcw className="w-4 h-4 text-primary mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-7">
              <form onSubmit={filterForm.handleSubmit(handleApplyFilters)}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Search
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        {...filterForm.register('search')}
                        className="w-full h-12 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                        placeholder="Payment ID, Delivery ID, customer email, driver ID…"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Event type
                    </Label>
                    <Select
                      onValueChange={(value) => filterForm.setValue('eventType', value)}
                      defaultValue="All"
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Authorization">Authorization</SelectItem>
                        <SelectItem value="Capture">Capture</SelectItem>
                        <SelectItem value="Refund">Refund</SelectItem>
                        <SelectItem value="Chargeback">Chargeback</SelectItem>
                        <SelectItem value="Adjustment">Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Status
                    </Label>
                    <Select
                      onValueChange={(value) => filterForm.setValue('status', value)}
                      defaultValue="All"
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Succeeded">Succeeded</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Failed">Failed</SelectItem>
                        <SelectItem value="Disputed">Disputed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Date range
                    </Label>
                    <Select
                      onValueChange={(value) => filterForm.setValue('dateRange', value)}
                      defaultValue="Last 7 days"
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Today">Today</SelectItem>
                        <SelectItem value="Last 7 days">Last 7 days</SelectItem>
                        <SelectItem value="Last 30 days">Last 30 days</SelectItem>
                        <SelectItem value="Custom…">Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="pill bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Filter className="w-3.5 h-3.5 text-primary mr-1" />
                    All events
                  </Badge>
                  <Badge variant="outline" className="pill bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-primary mr-1" />
                    Last 7 days
                  </Badge>
                  <Badge variant="outline" className="pill bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200">
                    <Eye className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    Showing: {MOCK_PAYMENTS.showingEvents}
                  </Badge>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="submit" className="btn-primary px-6 py-2.5">
                    Apply Filters
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Table */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">Payment Events</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Each row is an immutable event record with audit metadata (PRD).
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge status="Succeeded" color="emerald" icon={CheckCircle} />
                  <StatusBadge status="Pending" color="amber" icon={Hourglass} />
                  <StatusBadge status="Failed" color="rose" icon={AlertCircle} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-800">
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Time
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Delivery
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Event
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Amount
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Status
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Customer
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Driver
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Provider ID
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_PAYMENTS.events.map((event) => (
                      <TableRow 
                        key={event.id} 
                        className="border-slate-100 dark:border-slate-800 hover:bg-primary/5"
                      >
                        <TableCell className="py-4 text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                          {event.timestamp}
                        </TableCell>

                        <TableCell className="py-4">
                          <Link 
                            to={`/admin-delivery/${event.delivery.id}`}
                            className="font-extrabold text-slate-900 dark:text-white hover:text-primary transition-colors"
                          >
                            {event.delivery.id}
                          </Link>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {event.delivery.route}
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <EventBadge 
                            event={event.event.type} 
                            icon={event.event.icon} 
                          />
                        </TableCell>

                        <TableCell className={cn(
                          "py-4 text-sm font-black font-mono",
                          event.amount < 0 
                            ? "text-rose-600 dark:text-rose-400" 
                            : "text-slate-900 dark:text-white"
                        )}>
                          {event.amount < 0 ? '-' : ''}${Math.abs(event.amount).toFixed(2)}
                        </TableCell>

                        <TableCell className="py-4">
                          <StatusBadge 
                            status={event.status.label} 
                            color={event.status.color}
                            icon={event.status.icon}
                          />
                        </TableCell>

                        <TableCell className="py-4 text-sm font-extrabold text-slate-900 dark:text-white">
                          {event.customer}
                        </TableCell>

                        <TableCell className="py-4 text-sm font-extrabold text-slate-900 dark:text-white">
                          {event.driver}
                        </TableCell>

                        <TableCell className="py-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                          {event.providerId}
                        </TableCell>

                        <TableCell className="py-4 text-right">
                          <div className="inline-flex gap-2">
                            {event.actions.includes('capture') && (
                              <Button
                                onClick={() => handleCapture(event)}
                                size="sm"
                                className="btn-primary py-2 px-3"
                              >
                                <Paid className="w-4 h-4 mr-2" />
                                Capture
                              </Button>
                            )}
                            {event.actions.includes('void') && (
                              <Button
                                onClick={() => handleVoid(event)}
                                variant="outline"
                                size="sm"
                                className="btn-ghost py-2 px-3"
                              >
                                <Block className="w-4 h-4 text-primary mr-2" />
                                Void
                              </Button>
                            )}
                            {event.actions.includes('dispute') && (
                              <Button
                                onClick={() => handleDispute(event)}
                                variant="outline"
                                size="sm"
                                className="btn-ghost py-2 px-3"
                              >
                                <Gavel className="w-4 h-4 text-primary mr-2" />
                                Dispute
                              </Button>
                            )}
                            {event.actions.includes('review') && (
                              <Button
                                onClick={() => handleReviewChargeback(event)}
                                size="sm"
                                className="btn-primary py-2 px-3"
                              >
                                <ArrowForward className="w-4 h-4 mr-2" />
                                Review
                              </Button>
                            )}
                            {event.actions.includes('view') && (
                              <Link
                                to={`/admin-delivery/${event.delivery.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                              >
                                <OpenInNew className="w-4 h-4 text-primary" />
                                View
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="px-6 sm:px-7 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Showing <span className="font-black text-slate-900 dark:text-white">{MOCK_PAYMENTS.showingEvents}</span> of{' '}
                  <span className="font-black text-slate-900 dark:text-white">{MOCK_PAYMENTS.totalEvents}</span> events
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="btn-ghost px-4 py-2.5">
                    <ChevronLeft className="w-4 h-4 text-primary mr-1" />
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" className="btn-ghost px-4 py-2.5">
                    Next
                    <ChevronRight className="w-4 h-4 text-primary ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* PRD note */}
        <section className="mt-6">
          <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              PRD Coverage
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              Payment authorization/capture, refunds, disputes/chargebacks, and immutable event/audit log. 
              Prototype UI only — real integrations will connect to provider webhooks and internal delivery events.
            </AlertDescription>
          </Alert>
        </section>
      </main>

      {/* Capture Modal */}
      <Dialog open={captureModalOpen} onOpenChange={setCaptureModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Capture Payment</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
              Capture the authorized payment for this delivery.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    Delivery
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {selectedPayment.delivery.id}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    Amount
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                    ${selectedPayment.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    Provider ID
                  </span>
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                    {selectedPayment.providerId}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Capturing this payment will charge the customer's payment method. This action cannot be undone.
              </p>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setCaptureModalOpen(false)}
              className="px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCapture}
              className="lime-btn px-6 py-3 rounded-2xl hover:shadow-lg hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
            >
              <Paid className="w-4 h-4" />
              Confirm Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Modal */}
      <Dialog open={voidModalOpen} onOpenChange={setVoidModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Void Authorization</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
              Void the pending authorization for this delivery.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    Delivery
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {selectedPayment.delivery.id}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    Amount
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                    ${selectedPayment.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    Provider ID
                  </span>
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                    {selectedPayment.providerId}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Voiding this authorization will release the hold on the customer's funds. This action cannot be undone.
              </p>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setVoidModalOpen(false)}
              className="px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmVoid}
              variant="destructive"
              className="px-6 py-3 rounded-2xl bg-rose-600 text-white hover:opacity-90 transition inline-flex items-center justify-center gap-2"
            >
              <Block className="w-4 h-4" />
              Confirm Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                Admin Console • Payments
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