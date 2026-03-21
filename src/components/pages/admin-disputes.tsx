// app/pages/admin/disputes/index.tsx
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
  FilePen,
  FilePlus,
  FileMinus,
  Scale as ScaleIcon,
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAdminActions } from '@/hooks/useAdminActions'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { Navbar } from '../shared/layout/testNavbar'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'

// ---------- Types (same as before) ----------
interface DisputeNote {
  id: string
  note: string
  createdAt: string
  createdByUserId: string
}

interface DeliverySummary {
  id: string
  status: string
  serviceType: string
  customerId: string
  quoteId: string | null
  pickupAddress: string
  dropoffAddress: string
  createdAt: string
  updatedAt: string
}

interface DisputeCase {
  id: string
  deliveryId: string
  reason: string
  legalHold: boolean
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED'
  openedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  delivery: DeliverySummary
  notes: DisputeNote[]
  _count: {
    notes: number
  }
}

// Filter form schema (unchanged)
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

// Status badge color mapping
const statusColorMap: Record<string, string> = {
  OPEN: 'rose',
  UNDER_REVIEW: 'amber',
  RESOLVED: 'emerald',
  CLOSED: 'slate',
}

const statusIconMap: Record<string, any> = {
  OPEN: AlertCircle,
  UNDER_REVIEW: Hourglass,
  RESOLVED: CheckCircle,
  CLOSED: XCircle,
}

export default function AdminDisputesPage() {
  const { actionItems, signOut } = useAdminActions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const actorUser = getUser()
  const actorUserId = actorUser?.id

  // Dialog states
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionDialogType, setActionDialogType] = useState<
    'open' | 'addNote' | 'resolve' | 'close' | 'legalHold' | null
  >(null)
  const [selectedDispute, setSelectedDispute] = useState<DisputeCase | null>(null)

  // Forms for each action (same as before)
  const openForm = useForm<{ note: string }>({
    defaultValues: { note: '' },
  })
  const noteForm = useForm<{ note: string }>({
    defaultValues: { note: '' },
  })
  const resolveForm = useForm<{ resolutionNote: string }>({
    defaultValues: { resolutionNote: '' },
  })
  const closeForm = useForm<{ closingNote: string }>({
    defaultValues: { closingNote: '' },
  })
  const legalHoldForm = useForm<{ closingNote: string }>({
    defaultValues: { closingNote: '' },
  })

  // Fetch disputes
  const {
    data: disputes,
    isLoading,
    refetch,
  } = useDataQuery<DisputeCase[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/disputeCases/admin`,
    noFilter: true,
  })

  // Mutations (same as before)
  const openMutation = useCreate<any, { deliveryId: string; reason: string; actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/disputeCases/admin/open`,
    {
      onSuccess: () => {
        toast.success('Dispute opened')
        refetch()
        setActionDialogOpen(false)
      },
      onError: (error) => toast.error('Failed to open dispute', { description: error.message }),
    }
  )

  const addNoteMutation = useCreate<any, { note: string; actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/disputeCases/:id/admin-note`,
    {
      onSuccess: () => {
        toast.success('Note added')
        refetch()
        setActionDialogOpen(false)
      },
      onError: (error) => toast.error('Failed to add note', { description: error.message }),
    }
  )

  const changeStatusMutation = useCreate<any, { status: string; note?: string; actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/disputeCases/:id/admin-status`,
    {
      onSuccess: () => {
        toast.success('Status updated')
        refetch()
        setActionDialogOpen(false)
      },
      onError: (error) => toast.error('Failed to update status', { description: error.message }),
    }
  )

  const resolveMutation = useCreate<any, { resolutionNote: string; actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/disputeCases/:id/admin-resolve`,
    {
      onSuccess: () => {
        toast.success('Dispute resolved')
        refetch()
        setActionDialogOpen(false)
      },
      onError: (error) => toast.error('Failed to resolve', { description: error.message }),
    }
  )

  const closeMutation = useCreate<any, { closingNote: string; actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/disputeCases/:id/admin-close`,
    {
      onSuccess: () => {
        toast.success('Dispute closed')
        refetch()
        setActionDialogOpen(false)
      },
      onError: (error) => toast.error('Failed to close', { description: error.message }),
    }
  )

  const legalHoldMutation = useCreate<any, { closingNote: string; actorUserId: string,legalHold: boolean, }>(
    `${import.meta.env.VITE_API_URL}/api/disputeCases/:id/admin-legal-hold`,
    {
      onSuccess: () => {
        toast.success('Legal hold toggled')
        refetch()
        setActionDialogOpen(false)
      },
      onError: (error) => toast.error('Failed to update legal hold', { description: error.message }),
    }
  )

  // Filter form
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

  // Client-side filtering
  const filteredDisputes = useMemo(() => {
    if (!disputes) return []
    const { search, status } = filterForm.getValues()
    return disputes.filter((dispute) => {
      if (search) {
        const term = search.toLowerCase()
        const matches =
          dispute.id.toLowerCase().includes(term) ||
          dispute.deliveryId.toLowerCase().includes(term) ||
          dispute.reason.toLowerCase().includes(term) ||
          dispute.delivery.pickupAddress.toLowerCase().includes(term) ||
          dispute.delivery.dropoffAddress.toLowerCase().includes(term)
        if (!matches) return false
      }
      if (status && status !== 'any' && dispute.status !== status) return false
      return true
    })
  }, [disputes, filterForm.watch()])

  // Compute KPIs
  const kpis = useMemo(() => {
    if (!disputes) return []
    const open = disputes.filter(d => d.status === 'OPEN').length
    const inReview = disputes.filter(d => d.status === 'UNDER_REVIEW').length
    const resolved = disputes.filter(d => d.status === 'RESOLVED').length
    const closed = disputes.filter(d => d.status === 'CLOSED').length
    return [
      { label: 'Open', value: open, description: 'Awaiting review / action' },
      { label: 'In Review', value: inReview, description: 'Evidence collection + mediation' },
      { label: 'Resolved', value: resolved, description: 'Resolved this month' },
      { label: 'Closed', value: closed, description: 'Closed cases' },
    ]
  }, [disputes])

  // Handlers
  const handleApplyFilters = (data: FilterFormData) => {
    toast.success('Filters applied')
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
    toast.success('Export started', { description: 'Disputes report will be downloaded.' })
  }

  const handleCreateDispute = () => {
    toast.info('Create new dispute', { description: 'Opening dispute creation form.' })
    // navigate({ to: '/admin/disputes/new' })
  }

  // Open detail dialog
  const openDetailDialog = (dispute: DisputeCase) => {
    setSelectedDispute(dispute)
    setDetailDialogOpen(true)
  }

  // Open action dialog from within detail dialog
  const openActionDialog = (type: typeof actionDialogType) => {
    setActionDialogType(type)
    setActionDialogOpen(true)
    // Reset the appropriate form
    switch (type) {
      case 'open':
        openForm.reset({ note: '' })
        break
      case 'addNote':
        noteForm.reset({ note: '' })
        break
      case 'resolve':
        resolveForm.reset({ resolutionNote: '' })
        break
      case 'close':
        closeForm.reset({ closingNote: '' })
        break
      case 'legalHold':
        legalHoldForm.reset({ closingNote: '' })
        break
    }
  }

  // Submission handlers (same as before)
  const onSubmitOpen = (data: { note: string }) => {
    if (!selectedDispute || !actorUserId) return
    openMutation.mutate({
      deliveryId: selectedDispute.deliveryId,
      reason: data.note,
      actorUserId,
    })
  }

  const onSubmitAddNote = (data: { note: string }) => {
    if (!selectedDispute || !actorUserId) return
    addNoteMutation.mutate({
      pathParams: { id: selectedDispute.id },
      note: data.note,
      actorUserId,
    })
  }

  const onSubmitResolve = (data: { resolutionNote: string }) => {
    if (!selectedDispute || !actorUserId) return
    resolveMutation.mutate({
      pathParams: { id: selectedDispute.id },
      resolutionNote: data.resolutionNote,
      actorUserId,
    })
  }

  const onSubmitClose = (data: { closingNote: string }) => {
    if (!selectedDispute || !actorUserId) return
    closeMutation.mutate({
      pathParams: { id: selectedDispute.id },
      closingNote: data.closingNote,
      actorUserId,
    })
  }

  const onSubmitLegalHold = (data: { closingNote: string }) => {
    if (!selectedDispute || !actorUserId) return
    legalHoldMutation.mutate({
      pathParams: { id: selectedDispute.id },
      closingNote: data.closingNote,
      actorUserId,
      legalHold: true,
    })
  }

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted) return null

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
        {/* Top section - unchanged */}
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
        <section className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          {kpis.map((kpi) => (
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
          {/* Filters (unchanged) */}
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
                          placeholder="Dispute ID, Delivery ID, reason..."
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
                            <SelectItem value="any">Any</SelectItem>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                            <SelectItem value="RESOLVED">Resolved</SelectItem>
                            <SelectItem value="CLOSED">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Priority
                        </Label>
                        <Select disabled>
                          <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Type
                        </Label>
                        <Select disabled>
                          <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Raised by
                        </Label>
                        <Select disabled>
                          <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm">
                            <SelectValue placeholder="Any" />
                          </SelectTrigger>
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

            {/* Quick actions (unchanged) */}
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
                      {kpis.find(k => k.label === 'Open')?.value || 0} Open
                    </Badge>
                    <Badge variant="outline" className="pill bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <Schedule className="w-3.5 h-3.5 text-primary mr-1" />
                      {kpis.find(k => k.label === 'In Review')?.value || 0} In Review
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                {isLoading ? (
                  <div className="text-center py-8">Loading disputes...</div>
                ) : filteredDisputes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No disputes found</div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                      <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Dispute
                      </div>
                      <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Linked delivery
                      </div>
                      <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Type / Reason
                      </div>
                      <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Status
                      </div>
                      <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right">
                        Actions
                      </div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredDisputes.map((dispute) => (
                        <div key={dispute.id} className="grid grid-cols-12 gap-3 px-6 py-4 hover:bg-primary/5 transition">
                          {/* Dispute column */}
                          <div className="col-span-3">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0",
                                dispute.legalHold ? "bg-indigo-500/10 text-indigo-600 border-indigo-200/60" : "bg-rose-500/10 text-rose-600 border-rose-200/60"
                              )}>
                                {dispute.legalHold ? <ScaleIcon className="w-5 h-5" /> : <Gavel className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-black text-slate-900 dark:text-white">
                                  {dispute.id.slice(-8).toUpperCase()}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  Opened {new Date(dispute.openedAt || dispute.createdAt).toLocaleDateString()}
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 truncate">
                                  {dispute.reason}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Delivery column */}
                          <div className="col-span-3">
                            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                              <Link
                                to={`/admin/delivery/${dispute.deliveryId}`}
                                className="hover:text-primary transition-colors"
                              >
                                {dispute.deliveryId.slice(-8).toUpperCase()}
                              </Link>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {dispute.delivery.pickupAddress} → {dispute.delivery.dropoffAddress}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                              Status: {dispute.delivery.status}
                            </div>
                          </div>

                          {/* Type / Reason column */}
                          <div className="col-span-2">
                            <Badge variant="outline" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                              <Car className="w-3.5 h-3.5 text-primary" />
                              {dispute.reason.length > 20 ? dispute.reason.slice(0, 20) + '…' : dispute.reason}
                            </Badge>
                          </div>

                          {/* Status column */}
                          <div className="col-span-2">
                            <StatusBadge
                              status={dispute.status}
                              color={statusColorMap[dispute.status] || 'slate'}
                              icon={statusIconMap[dispute.status] || AlertCircle}
                            />
                            {dispute.legalHold && (
                              <Badge variant="outline" className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-200">
                                <ScaleIcon className="w-3 h-3" />
                                Legal Hold
                              </Badge>
                            )}
                          </div>

                          {/* Actions column - only View button */}
                          <div className="col-span-2 flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openDetailDialog(dispute)}>
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pagination placeholder */}
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Showing {filteredDisputes.length} of {disputes?.length || 0} disputes
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

      {/* ---------- Detail Dialog (Beautiful Redesign) ---------- */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <span>Dispute {selectedDispute?.id.slice(-8).toUpperCase()}</span>
              {selectedDispute && (
                <>
                  <StatusBadge
                    status={selectedDispute.status}
                    color={statusColorMap[selectedDispute.status] || 'slate'}
                    icon={statusIconMap[selectedDispute.status] || AlertCircle}
                  />
                  {selectedDispute.legalHold && (
                    <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-200">
                      <ScaleIcon className="w-3.5 h-3.5 mr-1" />
                      Legal Hold
                    </Badge>
                  )}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Detailed information and actions for this dispute.
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <>
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="notes">Notes ({selectedDispute._count.notes})</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Dispute Information</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Reason</Label>
                          <p className="text-sm font-medium mt-1">{selectedDispute.reason}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Opened At</Label>
                          <p className="text-sm mt-1">{selectedDispute.openedAt ? new Date(selectedDispute.openedAt).toLocaleString() : '—'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Resolved At</Label>
                          <p className="text-sm mt-1">{selectedDispute.resolvedAt ? new Date(selectedDispute.resolvedAt).toLocaleString() : '—'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Closed At</Label>
                          <p className="text-sm mt-1">{selectedDispute.closedAt ? new Date(selectedDispute.closedAt).toLocaleString() : '—'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Created At</Label>
                          <p className="text-sm mt-1">{new Date(selectedDispute.createdAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Last Updated</Label>
                          <p className="text-sm mt-1">{new Date(selectedDispute.updatedAt).toLocaleString()}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Linked Delivery</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        {/* <div>
                          <Label className="text-xs text-slate-500">Delivery ID</Label>
                          <p className="text-sm font-mono mt-1">{selectedDispute.deliveryId}</p>
                        </div> */}
                        <div>
                          <Label className="text-xs text-slate-500">Status</Label>
                          <p className="text-sm mt-1">{selectedDispute.delivery.status}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Service Type</Label>
                          <p className="text-sm mt-1">{selectedDispute.delivery.serviceType}</p>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Pickup Address</Label>
                          <p className="text-sm mt-1">{selectedDispute.delivery.pickupAddress}</p>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">Dropoff Address</Label>
                          <p className="text-sm mt-1">{selectedDispute.delivery.dropoffAddress}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Notes Tab */}
                  <TabsContent value="notes" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Internal Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64 pr-4">
                          {selectedDispute.notes.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">No notes yet</p>
                          ) : (
                            <div className="space-y-3">
                              {selectedDispute.notes.map((note) => (
                                <div key={note.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                  <p className="text-sm">{note.note}</p>
                                  <p className="text-xs text-slate-500 mt-2">
                                    {new Date(note?.createdAt)?.toLocaleString()} • by {note?.createdByUserId?.slice(-6)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-end gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                {selectedDispute.status !== 'OPEN' && (
                  <Button variant="outline" onClick={() => openActionDialog('open')}>
                    <FilePlus className="w-4 h-4 mr-2" /> Open
                  </Button>
                )}
                <Button variant="outline" onClick={() => openActionDialog('addNote')}>
                  <FilePen className="w-4 h-4 mr-2" /> Add Note
                </Button>
                {selectedDispute.status === 'OPEN' && (
                  <>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openActionDialog('resolve')}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Resolve
                    </Button>
                    <Button variant="destructive" onClick={() => openActionDialog('close')}>
                      <XCircle className="w-4 h-4 mr-2" /> Close
                    </Button>
                  </>
                )}
                <Button
                  variant={selectedDispute.legalHold ? "default" : "outline"}
                  className={selectedDispute.legalHold ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}
                  onClick={() => openActionDialog('legalHold')}
                >
                  <ScaleIcon className="w-4 h-4 mr-2" />
                  {selectedDispute.legalHold ? 'Remove Legal Hold' : 'Apply Legal Hold'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Action Dialogs (unchanged, but now controlled by actionDialogOpen) ---------- */}

      {/* Open Dialog */}
      <Dialog open={actionDialogOpen && actionDialogType === 'open'} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Dispute</DialogTitle>
            <DialogDescription>
              Provide a reason for opening this dispute.
            </DialogDescription>
          </DialogHeader>
          <Form {...openForm}>
            <form onSubmit={openForm.handleSubmit(onSubmitOpen)} className="space-y-4">
              <FormField
                control={openForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={openMutation.isPending}>Open</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={actionDialogOpen && actionDialogType === 'addNote'} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add an internal note to this dispute.
            </DialogDescription>
          </DialogHeader>
          <Form {...noteForm}>
            <form onSubmit={noteForm.handleSubmit(onSubmitAddNote)} className="space-y-4">
              <FormField
                control={noteForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addNoteMutation.isPending}>Add Note</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={actionDialogOpen && actionDialogType === 'resolve'} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Provide a resolution note.
            </DialogDescription>
          </DialogHeader>
          <Form {...resolveForm}>
            <form onSubmit={resolveForm.handleSubmit(onSubmitResolve)} className="space-y-4">
              <FormField
                control={resolveForm.control}
                name="resolutionNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution Note</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={resolveMutation.isPending}>Resolve</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={actionDialogOpen && actionDialogType === 'close'} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Dispute</DialogTitle>
            <DialogDescription>
              Provide a closing note.
            </DialogDescription>
          </DialogHeader>
          <Form {...closeForm}>
            <form onSubmit={closeForm.handleSubmit(onSubmitClose)} className="space-y-4">
              <FormField
                control={closeForm.control}
                name="closingNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Closing Note</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={closeMutation.isPending}>Close</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Legal Hold Dialog */}
      <Dialog open={actionDialogOpen && actionDialogType === 'legalHold'} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDispute?.legalHold ? 'Remove Legal Hold' : 'Apply Legal Hold'}</DialogTitle>
            <DialogDescription>
              {selectedDispute?.legalHold
                ? 'Provide a note about removing legal hold.'
                : 'Provide a note about applying legal hold.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...legalHoldForm}>
            <form onSubmit={legalHoldForm.handleSubmit(onSubmitLegalHold)} className="space-y-4">
              <FormField
                control={legalHoldForm.control}
                name="closingNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={legalHoldMutation.isPending}>
                  {selectedDispute?.legalHold ? 'Remove Hold' : 'Apply Hold'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper StatusBadge component (same as before)
const StatusBadge = ({ status, color, icon: Icon, className }: any) => {
  const colors: Record<string, string> = {
    rose: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200',
    amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
    slate: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
  }
  return (
    <Badge variant="outline" className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border", colors[color] || colors.slate, className)}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </Badge>
  )
}