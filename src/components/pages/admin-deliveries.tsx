// app/pages/admin/deliveries.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Truck,
  Clock,
  CheckCircle,
  Gavel,
  Search,
  Filter,
  RotateCcw,
  Download,
  ArrowRight,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Mail,
  Camera,
  QrCode,
  Tag,
  Verified,
  AlertCircle,
  FileText,
  Receipt,
  Calendar,
  User,
  Building2,
  MapPin,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Shield,
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
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { navItems } from '@/lib/items/navItems'
import { useAdminActions } from '@/hooks/useAdminActions'

// Filter form schema
const filterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data for deliveries
const MOCK_DELIVERIES = {
  kpis: [
    {
      icon: Truck,
      label: 'Active',
      value: '14',
      description: 'Deliveries currently in progress.',
      color: 'primary',
    },
    {
      icon: Clock,
      label: 'Booked',
      value: '27',
      description: 'Scheduled / awaiting pickup.',
      color: 'primary',
    },
    {
      icon: CheckCircle,
      label: 'Completed',
      value: '122',
      description: 'Completed in the last 30 days.',
      color: 'primary',
    },
    {
      icon: Gavel,
      label: 'Disputes',
      value: '6',
      description: 'Open disputes awaiting resolution.',
      color: 'rose',
    },
  ],
  
  deliveries: [
    {
      id: 'DLV-10293',
      status: 'Booked',
      statusColor: 'slate',
      customer: 'Sarah Lee',
      dealer: 'Bay City Toyota',
      driver: 'A. Johnson',
      class: 'A',
      miles: '142',
      estimate: '$230',
      proofs: {
        status: 'Pending',
        color: 'amber',
        icon: Camera,
      },
    },
    {
      id: 'DLV-10211',
      status: 'Active',
      statusColor: 'primary',
      customer: 'West Coast Auto Mall',
      dealer: 'West Coast Auto Mall',
      driver: 'Kim Perez',
      class: 'B',
      miles: '58',
      estimate: '$140',
      proofs: {
        status: 'Pickup OK',
        color: 'primary',
        icon: Verified,
      },
    },
    {
      id: 'DLV-10102',
      status: 'Completed',
      statusColor: 'emerald',
      customer: 'Private Customer',
      dealer: '—',
      driver: 'A. Johnson',
      class: 'C',
      miles: '310',
      estimate: '$620',
      proofs: {
        status: 'Full',
        color: 'primary',
        icon: Verified,
      },
    },
    {
      id: 'DLV-10077',
      status: 'Disputed',
      statusColor: 'rose',
      customer: 'Dealer Customer',
      dealer: 'Sunset Motors',
      driver: '—',
      class: 'B',
      miles: '112',
      estimate: '$260',
      proofs: {
        status: 'Review',
        color: 'amber',
        icon: AlertCircle,
      },
    },
  ],
}

// Status options for filter
const STATUS_OPTIONS = [
  'All',
  'Draft',
  'Quoted',
  'Listed',
  'Booked',
  'Active',
  'Completed',
  'Cancelled',
  'Expired',
  'Disputed',
]


export default function AdminDeliveriesPage() {
  const { actionItems, signOut } = useAdminActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([])

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: '',
      status: 'All',
      startDate: '',
      endDate: '',
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
    toast.info('Filters applied', {
      description: `Search: ${data.search || 'None'} • Status: ${data.status}`,
    })
    console.log('Filters:', data)
  }

  const handleResetFilters = () => {
    filterForm.reset({
      search: '',
      status: 'All',
      startDate: '',
      endDate: '',
    })
    toast.info('Filters reset')
  }

  const handleExport = () => {
    toast.success('Export started', {
      description: 'Your CSV export will be ready shortly.',
    })
  }

  const handleSelectDelivery = (id: string) => {
    setSelectedDeliveries(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedDeliveries.length === MOCK_DELIVERIES.deliveries.length) {
      setSelectedDeliveries([])
    } else {
      setSelectedDeliveries(MOCK_DELIVERIES.deliveries.map(d => d.id))
    }
  }

  // Status badge component
  const StatusBadge = ({ 
    status, 
    color, 
    icon: Icon 
  }: { 
    status: string; 
    color: string; 
    icon?: any 
  }) => {
    const colors: Record<string, string> = {
      primary: 'bg-primary/10 border-primary/25 text-primary-foreground',
      slate: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
      emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
      amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
      rose: 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-200',
    }

    const icons: Record<string, any> = {
      Booked: Clock,
      Active: Truck,
      Completed: CheckCircle,
      Disputed: Gavel,
    }

    const StatusIcon = Icon || icons[status] || Tag

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border",
          colors[color] || colors.slate
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
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
        {/* Page header */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
              <FileText className="w-3.5 h-3.5 text-primary font-bold" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                Operations & Compliance
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mt-4">
              Deliveries
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg max-w-3xl leading-relaxed">
              Monitor delivery lifecycle (draft → completed), assignments, compliance proofs, disputes, and audit trail (PRD).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/admin-deliveries"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              Open Delivery
              <ArrowRight className="w-4 h-4 text-primary" />
            </Link>
            <Link
              to="/admin-reports"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition"
            >
              Ops Audit
              <FileSpreadsheet className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* KPI cards */}
        <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MOCK_DELIVERIES.kpis.map((kpi) => (
            <Card 
              key={kpi.label} 
              className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift"
            >
              <CardContent className="p-6">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                  kpi.color === 'rose' ? 'bg-rose-500/15' : 'bg-primary/15'
                )}>
                  <kpi.icon className={cn(
                    "w-6 h-6 font-bold",
                    kpi.color === 'rose' ? 'text-rose-500' : 'text-primary'
                  )} />
                </div>
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  {kpi.description}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Filters */}
        <section className="mt-8">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-6 sm:p-7">
              <form onSubmit={filterForm.handleSubmit(handleApplyFilters)}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Search
                    </Label>
                    <div className="relative mt-2">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        {...filterForm.register('search')}
                        className="h-12 w-full pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                        placeholder="Delivery #, VIN last-4, dealer, driver, city..."
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Status
                    </Label>
                    <Select
                      onValueChange={(value) => filterForm.setValue('status', value)}
                      defaultValue="All"
                    >
                      <SelectTrigger className="mt-2 h-12 w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Date range
                    </Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Input
                        {...filterForm.register('startDate')}
                        className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                        type="date"
                      />
                      <Input
                        {...filterForm.register('endDate')}
                        className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                        type="date"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 flex gap-2">
                    <Button 
                      type="submit"
                      className="h-12 flex-1 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition"
                    >
                      Apply
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center justify-center"
                      onClick={handleResetFilters}
                      title="Reset"
                    >
                      <RotateCcw className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                  <Mail className="w-3.5 h-3.5 text-primary mr-1" />
                  Email-first notifications
                </Badge>
                <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                  <Camera className="w-3.5 h-3.5 text-primary mr-1" />
                  Compliance proofs required
                </Badge>
                <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                  <QrCode className="w-3.5 h-3.5 text-primary mr-1" />
                  VIN last-4 verification
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Deliveries table */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-6 sm:p-7">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">All deliveries</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Track pricing class (A/B/C), assignment, proofs, and issues (PRD).
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                  >
                    <Download className="w-4 h-4 text-primary mr-1" />
                    Export
                  </Button>
                  <Link
                    to={selectedDeliveries.length === 1 ? `/admin/delivery/${selectedDeliveries[0]}` : '#'}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold transition",
                      selectedDeliveries.length === 1
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                        : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed pointer-events-none"
                    )}
                  >
                    Open selected
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-7 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={selectedDeliveries.length === MOCK_DELIVERIES.deliveries.length}
                        onChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      #
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Customer
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Dealer
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Driver
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Class
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Miles
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Estimate
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Proofs
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_DELIVERIES.deliveries.map((delivery) => (
                    <TableRow 
                      key={delivery.id} 
                      className="border-slate-100 dark:border-slate-800 hover:bg-primary/5"
                    >
                      <TableCell className="py-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          checked={selectedDeliveries.includes(delivery.id)}
                          onChange={() => handleSelectDelivery(delivery.id)}
                        />
                      </TableCell>
                      <TableCell className="py-4 font-black text-slate-900 dark:text-white">
                        <Link 
                          to={`/admin/delivery/${delivery.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {delivery.id}
                        </Link>
                      </TableCell>
                      <TableCell className="py-4">
                        <StatusBadge 
                          status={delivery.status} 
                          color={delivery.statusColor} 
                        />
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
                        {delivery.customer}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
                        {delivery.dealer}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
                        {delivery.driver}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                          <Tag className="w-3 h-3 text-primary mr-1" />
                          {delivery.class}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400 font-mono">
                        {delivery.miles}
                      </TableCell>
                      <TableCell className="py-4 text-sm font-black text-slate-900 dark:text-white font-mono">
                        {delivery.estimate}
                      </TableCell>
                      <TableCell className="py-4">
                        <StatusBadge 
                          status={delivery.proofs.status} 
                          color={delivery.proofs.color}
                          icon={delivery.proofs.icon}
                        />
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <Link
                          to={`/admin/delivery/${delivery.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                        >
                          Open
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Alert className="mt-6 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                  PRD Compliance
                </AlertTitle>
                <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                  Deliveries track lifecycle statuses, assignment/reassignment audit, compliance proofs (VIN last-4 + photos + odometer), 
                  notifications, disputes, and payment events. This is a static prototype page; real app will load rows from API.
                </AlertDescription>
              </Alert>

              {/* Pagination */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Showing <span className="font-black text-slate-900 dark:text-white">1-{MOCK_DELIVERIES.deliveries.length}</span> of{' '}
                  <span className="font-black text-slate-900 dark:text-white">169</span> deliveries
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