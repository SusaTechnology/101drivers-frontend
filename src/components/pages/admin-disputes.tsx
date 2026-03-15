// app/pages/admin/disputes/index.tsx
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
  LogOut,
  Sun,
  Moon,
  Search,
  Filter,
  Download,
  Plus,
  RotateCcw,
  Info,
  MapPin,
  Users,
  Truck,
  CreditCard,
  Gavel,
  BarChart3,
  DollarSign,
  Calendar,
  Clock,
  Settings,
  Sliders,
  Scale,
  Flag,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  ExternalLink as OpenInNew,
  
  ChevronLeft,
  ChevronRight,
  Home,
  Store,
  User,
  UserCircle,
  Building2,
  Phone,
  Mail,
  MessageSquare,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Verified,
  Flag as FlagIcon,
  Car,
  Fuel,
  Gauge,
  Navigation,
  Compass,
  MapPin as MapPinIcon,
  CalendarDays,
  Timer,
  Hourglass,
  TrendingUp,
  TrendingDown,
  Activity,
  Fingerprint,
  Key,
  FileText,
  FileSearch,
  FileWarning,
  FileX,
  FileCheck,
  Receipt,
  Receipt as ReceiptLong,
  Clock as Schedule,
  ReceiptText,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus as PlusIcon,
  Minus,
  Check,
  X as XIcon,
  ToggleLeft,
  ToggleRight,
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
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { useAdminActions } from '@/hooks/useAdminActions'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { Navbar } from '../shared/layout/testNavbar'

// Filter form schema
const filterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  raisedBy: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data
const MOCK_DISPUTES = {
  kpis: [
    { label: 'Open', value: '12', description: 'Awaiting review / action' },
    { label: 'In Review', value: '7', description: 'Evidence collection + mediation' },
    { label: 'Resolved', value: '41', description: 'Closed this month (prototype)' },
  ],

  disputes: [
    {
      id: 'DSP-100238',
      icon: Gavel,
      iconColor: 'rose',
      raisedBy: 'Customer',
      date: 'Feb 10, 2026',
      summary: 'Claim: scratch on rear bumper at drop-off (photos attached).',
      delivery: {
        id: 'DEL-90211',
        route: 'San Jose → Los Angeles',
        driver: 'D-00192',
        dealer: 'Tesla SJ',
      },
      type: { label: 'Damage', icon: Car, color: 'slate' },
      status: { label: 'Open', color: 'rose', icon: AlertCircle },
    },
    {
      id: 'DSP-100217',
      icon: Schedule,
      iconColor: 'amber',
      raisedBy: 'Dealer',
      date: 'Feb 08, 2026',
      summary: 'Delay beyond pickup window; reassignment requested.',
      delivery: {
        id: 'DEL-90172',
        route: 'Sacramento → Oakland',
        driver: 'Unassigned',
        dealer: 'AutoHub',
      },
      type: { label: 'Delay', icon: Timer, color: 'slate' },
      status: { label: 'In Review', color: 'amber', icon: Hourglass },
    },
    {
      id: 'DSP-100201',
      icon: CreditCard,
      iconColor: 'indigo',
      raisedBy: 'Customer',
      date: 'Feb 05, 2026',
      summary: 'Charge mismatch between estimate and captured amount.',
      delivery: {
        id: 'DEL-90098',
        route: 'Fresno → San Diego',
        driver: 'D-00077',
        dealer: 'CarMax',
      },
      type: { label: 'Payment', icon: ReceiptLong, color: 'slate' },
      status: { label: 'Awaiting', color: 'slate', icon: MessageSquare },
    },
  ],

  statusOptions: [
    { value: 'any', label: 'Any' },
    { value: 'open', label: 'Open' },
    { value: 'in-review', label: 'In Review' },
    { value: 'awaiting-driver', label: 'Awaiting Driver' },
    { value: 'awaiting-customer', label: 'Awaiting Customer' },
    { value: 'awaiting-dealer', label: 'Awaiting Dealer' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ],

  priorityOptions: [
    { value: 'any', label: 'Any' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ],

  typeOptions: [
    { value: 'any', label: 'Any' },
    { value: 'damage', label: 'Damage claim' },
    { value: 'no-show', label: 'No-show' },
    { value: 'delay', label: 'Delay / SLA breach' },
    { value: 'payment', label: 'Payment dispute' },
    { value: 'policy', label: 'Policy violation' },
    { value: 'other', label: 'Other' },
  ],

  raisedByOptions: [
    { value: 'any', label: 'Any' },
    { value: 'customer', label: 'Customer' },
    { value: 'dealer', label: 'Dealer' },
    { value: 'driver', label: 'Driver' },
    { value: 'admin', label: 'Admin' },
  ],
}



export default function AdminDisputesPage() {
  const { actionItems, signOut } = useAdminActions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: '',
      status: 'any',
      priority: 'any',
      type: 'any',
      raisedBy: 'any',
      fromDate: '',
      toDate: '',
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
      description: 'Disputes list filtered.',
    })
    console.log('Filters:', data)
  }

  const handleResetFilters = () => {
    filterForm.reset({
      search: '',
      status: 'any',
      priority: 'any',
      type: 'any',
      raisedBy: 'any',
      fromDate: '',
      toDate: '',
    })
    toast.info('Filters reset')
  }

  const handleExport = () => {
    toast.success('Export started', {
      description: 'Disputes report will be downloaded.',
    })
  }

  const handleCreateDispute = () => {
    toast.info('Create new dispute', {
      description: 'Opening dispute creation form.',
    })
    // navigate({ to: '/admin/disputes/new' })
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
      rose: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200',
      amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
      slate: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200',
      indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
    }

    const StatusIcon = Icon || AlertCircle

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border",
          colors[color] || colors.slate,
          className
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    )
  }

  // Type badge component
  const TypeBadge = ({ 
    type, 
    icon: Icon, 
    color = 'slate' 
  }: { 
    type: string; 
    icon?: any; 
    color?: string 
  }) => {
    return (
      <Badge 
        variant="outline" 
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
        {type}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
          <Navbar
            brand={<Brand />}
            items={navItems}
            actions={actionItems}
            onSignOut={signOut}
            title="Admin"
            />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Top */}
        <section className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="chip bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200">
                <Gavel className="w-4 h-4 text-rose-500 mr-1" />
                Disputes
              </Badge>
              <Badge variant="outline" className="badge bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                <Verified className="w-3.5 h-3.5 text-primary mr-1" />
                Admin workflow (PRD)
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Dispute Management
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Review and resolve issues tied to deliveries (damage claims, no-show, payment disputes, policy breaches). All actions are auditable.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleExport}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <Download className="w-4 h-4 text-primary" />
              Export
            </Button>
            <Button
              onClick={handleCreateDispute}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              Create Dispute
            </Button>
          </div>
        </section>

        {/* KPIs */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {MOCK_DISPUTES.kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <CardContent className="p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  {kpi.label}
                </div>
                <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                  {kpi.value}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  {kpi.description}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Filters + Table */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Filters */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Filters</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Search disputes by delivery, parties, or status.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="chip bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                    <Sliders className="w-3.5 h-3.5 text-primary mr-1" />
                    Advanced
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <form onSubmit={filterForm.handleSubmit(handleApplyFilters)}>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Search
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          {...filterForm.register('search')}
                          className="w-full h-11 pl-11 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                          placeholder="Dispute ID, Delivery ID, VIN, email..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Status
                        </Label>
                        <Select
                          onValueChange={(value) => filterForm.setValue('status', value)}
                          defaultValue="any"
                        >
                          <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_DISPUTES.statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Priority
                        </Label>
                        <Select
                          onValueChange={(value) => filterForm.setValue('priority', value)}
                          defaultValue="any"
                        >
                          <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_DISPUTES.priorityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Type
                        </Label>
                        <Select
                          onValueChange={(value) => filterForm.setValue('type', value)}
                          defaultValue="any"
                        >
                          <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_DISPUTES.typeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Raised by
                        </Label>
                        <Select
                          onValueChange={(value) => filterForm.setValue('raisedBy', value)}
                          defaultValue="any"
                        >
                          <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_DISPUTES.raisedByOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          From
                        </Label>
                        <Input
                          type="date"
                          {...filterForm.register('fromDate')}
                          className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          To
                        </Label>
                        <Input
                          type="date"
                          {...filterForm.register('toDate')}
                          className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        type="submit"
                        className="flex-1 rounded-2xl py-3 text-sm bg-primary text-slate-950 hover:shadow-lg hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
                      >
                        Apply
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={handleResetFilters}
                        variant="outline"
                        className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-extrabold rounded-2xl py-3 text-sm border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
                      >
                        Reset
                        <RotateCcw className="w-4 h-4 text-primary" />
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="mt-2 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    PRD: Disputes can reference delivery proofs (photos, VIN last-4, odometer, tracking events) and payment events.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">Quick actions</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Common admin actions during resolution.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 gap-3">
                  <Link
                    // to="/admin/delivery/example"
                    className="inline-flex items-center justify-between gap-2 px-4 py-3 rounded-2xl font-extrabold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                  >
                    Open linked Delivery
                    <OpenInNew className="w-4 h-4 text-primary" />
                  </Link>
                  <Button
                    onClick={() => toast.info('Escalated to Admin Review')}
                    className="w-full inline-flex items-center justify-between gap-2 px-4 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                  >
                    Escalate to Admin Review
                    <AlertCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => toast.info('Evidence request sent')}
                    variant="outline"
                    className="w-full inline-flex items-center justify-between gap-2 px-4 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                  >
                    Request Evidence (Email)
                    <Mail className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* List */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Disputes</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Click a dispute to view timeline, evidence, and resolution actions.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="pill bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 mr-1" />
                      12 Open
                    </Badge>
                    <Badge variant="outline" className="pill bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <Schedule className="w-3.5 h-3.5 text-primary mr-1" />
                      7 In Review
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Dispute
                    </div>
                    <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Linked delivery
                    </div>
                    <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Type
                    </div>
                    <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Status
                    </div>
                    <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">
                      Actions
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {MOCK_DISPUTES.disputes.map((dispute, index) => (
                      <div key={dispute.id} className="grid grid-cols-12 gap-3 px-6 py-4 hover:bg-primary/5 transition">
                        {/* Dispute column */}
                        <div className="col-span-3">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0",
                              dispute.iconColor === 'rose' && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/30",
                              dispute.iconColor === 'amber' && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/30",
                              dispute.iconColor === 'indigo' && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-900/30"
                            )}>
                              <dispute.icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-900 dark:text-white">
                                {dispute.id}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Raised by {dispute.raisedBy} • {dispute.date}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 truncate">
                                {dispute.summary}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Delivery column */}
                        <div className="col-span-3">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                            <Link
                            //   to={`/admin/delivery/${dispute.delivery.id}`}
                              className="hover:text-primary transition-colors"
                            >
                              {dispute.delivery.id}
                            </Link>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {dispute.delivery.route}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                            Driver: {dispute.delivery.driver} • Dealer: {dispute.delivery.dealer}
                          </div>
                        </div>

                        {/* Type column */}
                        <div className="col-span-2">
                          <TypeBadge 
                            type={dispute.type.label} 
                            icon={dispute.type.icon} 
                          />
                        </div>

                        {/* Status column */}
                        <div className="col-span-2">
                          <StatusBadge 
                            status={dispute.status.label} 
                            color={dispute.status.color}
                            icon={dispute.status.icon}
                          />
                        </div>

                        {/* Actions column */}
                        <div className="col-span-2 flex justify-end gap-2">
                          <Link
                            // to={`/admin/dispute/${dispute.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                          >
                            View
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pagination */}
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Showing 1–3 of 60 disputes (prototype)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5">
                      <ChevronLeft className="w-4 h-4 text-primary mr-1" />
                      Prev
                    </Button>
                    <Button size="sm" className="px-4 py-2 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90">
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>

                {/* PRD note */}
                <div className="mt-5 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    PRD coverage: dispute records link to deliveries, parties, evidence, payment events, and auditable admin actions.
                    Next page (recommended): <span className="font-black">admin-dispute-details.html</span> (timeline + evidence + resolution).
                  </p>
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
                Admin Console • Disputes
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