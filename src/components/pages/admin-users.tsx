// @ts-nocheck
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
  RotateCcw,
  Download,
  Mail,
  MessageCircle as Sms,
  History,
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
  FileText,
  Upload,
  IdCard,
  TriangleAlert as Warning,
  Clock as Schedule,
  Verified,
  CheckCheck,
  Save,
  Send,
  User,
  UserCheck,
  UserX,
  UserPlus,
  UserCog,
  Phone,
  Mail as MailIcon,
  CalendarDays,
  Timer,
  Award,
  Star,
  TrendingUp,
  TrendingDown,
  Activity,
  Fingerprint,
  Key,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Store,
  PersonStanding,
  ArrowRight,
  Link as LinkIcon,
  PauseCircle,
  CheckCircle as CheckCircleIcon,
  Verified as VerifiedIcon,
  UserCheck as HowToReg,
  ShieldCheck as AdminPanelSettings,
  RotateCcw as RestartAlt,
  CheckSquare as Rule,
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
import { Checkbox } from '@/components/ui/checkbox'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { navItems } from '@/lib/items/navItems'
import { useAdminActions } from '@/hooks/useAdminActions'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'

// ---------- Types ----------
interface UserBase {
  id: string
  user: {
    id: string
    fullName: string
    email: string
    phone?: string | null
  }
}

interface Customer extends UserBase {
  customerType: 'BUSINESS' | 'PRIVATE'
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  businessName?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  businessWebsite?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  postpaidEnabled: boolean
  suspendedAt?: string | null
  suspensionReason?: string | null
  approvedAt?: string | null
  approvedBy?: any | null
  defaultPickup?: any | null
  pricingConfig?: any | null
  _count?: any
}

interface Driver extends UserBase {
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED'
  phone?: string | null
  profilePhotoUrl?: string | null
  approvedAt?: string | null
  approvedBy?: any | null
  location?: any | null
  preferences?: any | null
  alerts?: any | null
  districts?: any[]
  assignments?: any[]
  _count?: any
}

interface PendingCustomer {
  id: string
  customerType: 'BUSINESS' | 'PRIVATE'
  approvalStatus: 'PENDING'
  businessName?: string | null
  businessAddress?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  user: {
    fullName: string
    email: string
    phone?: string | null
  }
  createdAt: string
}

interface PendingDriver {
  id: string
  status: 'PENDING'
  user: {
    fullName: string
    email: string
    phone?: string | null
  }
  createdAt: string
  profilePhotoUrl?: string | null
}

// ---------- Form Schemas ----------
const approveCustomerSchema = z.object({
  note: z.string().optional(),
  postpaidEnabled: z.boolean().default(false),
})

const approveDriverSchema = z.object({
  note: z.string().optional(),
})

const rejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

const suspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

const unsuspendSchema = z.object({
  note: z.string().min(1, 'Note is required'),
})

type ApproveCustomerForm = z.infer<typeof approveCustomerSchema>
type ApproveDriverForm = z.infer<typeof approveDriverSchema>
type RejectForm = z.infer<typeof rejectSchema>
type SuspendForm = z.infer<typeof suspendSchema>
type UnsuspendForm = z.infer<typeof unsuspendSchema>

// ---------- Helper Components ----------
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
    primary: 'bg-primary/10 border-primary/25 text-primary-foreground',
    slate: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
    amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
    rose: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
  }

  const StatusIcon = Icon || CheckCircle

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

const TypeBadge = ({ 
  type, 
  icon: Icon, 
  color = 'slate' 
}: { 
  type: string; 
  icon?: any; 
  color?: string 
}) => {
  const colors: Record<string, string> = {
    primary: 'bg-primary/10 border-primary/25 text-primary-foreground',
    slate: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border",
        colors[color] || colors.slate
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {type}
    </Badge>
  )
}

// ---------- Main Component ----------
export default function AdminUsersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('approvals')
  const [approvalsSubTab, setApprovalsSubTab] = useState('customers')
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { actionItems, signOut } = useAdminActions()

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | 'suspend' | 'unsuspend' | 'view'>('approve')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userType, setUserType] = useState<'customer' | 'driver'>('customer')

  const actorUser = getUser()
  const actorUserId = actorUser?.id
  // Queries
  const pendingCustomersQuery = useDataQuery<PendingCustomer[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers/admin/pending-approval`,
    noFilter: true,
  })

  const pendingDriversQuery = useDataQuery<PendingDriver[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/drivers/admin/pending-approval`,
    noFilter: true,
  })

  const allCustomersQuery = useDataQuery<Customer[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/customers`,
    noFilter: true,
  })

  const allDriversQuery = useDataQuery<Driver[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/drivers`,
    noFilter: true,
  })

  // Mutations
  const approveCustomerMutation = useCreate<any, ApproveCustomerForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/customers/:id/approve`,
    {
      onSuccess: () => {
        toast.success('Customer approved')
        pendingCustomersQuery.refetch()
        allCustomersQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Approval failed', { description: error.message }),
    }
  )

  const approveDriverMutation = useCreate<any, ApproveDriverForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/drivers/:id/approve`,
    {
      onSuccess: () => {
        toast.success('Driver approved')
        pendingDriversQuery.refetch()
        allDriversQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Approval failed', { description: error.message }),
    }
  )

  const rejectCustomerMutation = useCreate<any, RejectForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/customers/:id/reject`,
    {
      onSuccess: () => {
        toast.success('Customer rejected')
        pendingCustomersQuery.refetch()
        allCustomersQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Rejection failed', { description: error.message }),
    }
  )

  const rejectDriverMutation = useCreate<any, RejectForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/drivers/:id/reject`,
    {
      onSuccess: () => {
        toast.success('Driver rejected')
        pendingDriversQuery.refetch()
        allDriversQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Rejection failed', { description: error.message }),
    }
  )

  const suspendCustomerMutation = useCreate<any, SuspendForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/customers/:id/suspend`,
    {
      onSuccess: () => {
        toast.success('Customer suspended')
        allCustomersQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Suspension failed', { description: error.message }),
    }
  )

  const suspendDriverMutation = useCreate<any, SuspendForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/drivers/:id/suspend`,
    {
      onSuccess: () => {
        toast.success('Driver suspended')
        allDriversQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Suspension failed', { description: error.message }),
    }
  )

  const unsuspendCustomerMutation = useCreate<any, UnsuspendForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/customers/:id/unsuspend`,
    {
      onSuccess: () => {
        toast.success('Customer unsuspended')
        allCustomersQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Unsuspension failed', { description: error.message }),
    }
  )

  const unsuspendDriverMutation = useCreate<any, UnsuspendForm & { actorUserId: string }>(
    `${import.meta.env.VITE_API_URL}/api/drivers/:id/unsuspend`,
    {
      onSuccess: () => {
        toast.success('Driver unsuspended')
        allDriversQuery.refetch()
        setDialogOpen(false)
      },
      onError: (error) => toast.error('Unsuspension failed', { description: error.message }),
    }
  )

  // Form handlers
  const approveCustomerForm = useForm<ApproveCustomerForm>({
    resolver: zodResolver(approveCustomerSchema),
    defaultValues: { note: '', postpaidEnabled: false },
  })

  const approveDriverForm = useForm<ApproveDriverForm>({
    resolver: zodResolver(approveDriverSchema),
    defaultValues: { note: '' },
  })

  const rejectForm = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  })

  const suspendForm = useForm<SuspendForm>({
    resolver: zodResolver(suspendSchema),
    defaultValues: { reason: '' },
  })

  const unsuspendForm = useForm<UnsuspendForm>({
    resolver: zodResolver(unsuspendSchema),
    defaultValues: { note: '' },
  })

  // Open dialog with appropriate form
  const openDialog = (action: typeof dialogAction, user: any, type: 'customer' | 'driver') => {
    setDialogAction(action)
    setSelectedUser(user)
    setUserType(type)
    setDialogOpen(true)

    // Reset forms
    approveCustomerForm.reset()
    approveDriverForm.reset()
    rejectForm.reset()
    suspendForm.reset()
    unsuspendForm.reset()
  }

  // Handle form submission
  const onSubmitApproveCustomer = (data: ApproveCustomerForm) => {
    if (!selectedUser || !actorUserId) return
    approveCustomerMutation.mutate({
      pathParams: { id: selectedUser.id },
      ...data,
      actorUserId,
    })
  }

  const onSubmitApproveDriver = (data: ApproveDriverForm) => {
    if (!selectedUser || !actorUserId) return
    approveDriverMutation.mutate({
      pathParams: { id: selectedUser.id },
      ...data,
      actorUserId,
    })
  }

  const onSubmitReject = (data: RejectForm) => {
    if (!selectedUser || !actorUserId) return
    if (userType === 'customer') {
      rejectCustomerMutation.mutate({
        pathParams: { id: selectedUser.id },
        ...data,
        actorUserId,
      })
    } else {
      rejectDriverMutation.mutate({
        pathParams: { id: selectedUser.id },
        ...data,
        actorUserId,
      })
    }
  }

  const onSubmitSuspend = (data: SuspendForm) => {
    if (!selectedUser || !actorUserId) return
    if (userType === 'customer') {
      suspendCustomerMutation.mutate({
        pathParams: { id: selectedUser.id },
        ...data,
        actorUserId,
      })
    } else {
      suspendDriverMutation.mutate({
        pathParams: { id: selectedUser.id },
        ...data,
        actorUserId,
      })
    }
  }

  const onSubmitUnsuspend = (data: UnsuspendForm) => {
    if (!selectedUser || !actorUserId) return
    if (userType === 'customer') {
      unsuspendCustomerMutation.mutate({
        pathParams: { id: selectedUser.id },
        ...data,
        actorUserId,
      })
    } else {
      unsuspendDriverMutation.mutate({
        pathParams: { id: selectedUser.id },
        ...data,
        actorUserId,
      })
    }
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
        {/* Page header */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
              <HowToReg className="w-3.5 h-3.5 text-primary font-bold" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                Approvals & Directory
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mt-4">
              Users
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg max-w-3xl leading-relaxed">
              Approve dealers and drivers, manage statuses, and maintain the business directory references (PRD).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/admin-user-detail"
              params={{ userId: 'new' }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
            >
              <User className="w-4 h-4 text-primary" />
              View Profile
            </Link>
            <Link
              // to="/admin/directory"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition"
            >
              Open Directory
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Main Tabs */}
        <section className="mt-10">
          <Tabs defaultValue="approvals" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full !h-auto !p-4 gap-3 justify-start">
              <TabsTrigger 
                value="approvals" 
                className="flex-1 sm:flex-none px-5 py-5 rounded-2xl font-extrabold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950"
              >
                <HowToReg className="w-4 h-4 mr-2" />
                Pending Approvals
                <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-slate-950 text-[11px] font-black">
                  {(pendingCustomersQuery.data?.length || 0) + (pendingDriversQuery.data?.length || 0)}
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="dealers" 
                className="flex-1 sm:flex-none px-5 py-3 rounded-2xl font-extrabold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950"
              >
                <Store className="w-4 h-4 mr-2 text-primary" />
                Dealers
              </TabsTrigger>
              <TabsTrigger 
                value="drivers" 
                className="flex-1 sm:flex-none px-5 py-3 rounded-2xl font-extrabold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950"
              >
                <PersonStanding className="w-4 h-4 mr-2 text-primary" />
                Drivers
              </TabsTrigger>
              <TabsTrigger 
                value="customers" 
                className="flex-1 sm:flex-none px-5 py-3 rounded-2xl font-extrabold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950"
              >
                <User className="w-4 h-4 mr-2 text-primary" />
                Individuals
              </TabsTrigger>
            </TabsList>

            {/* ---------- Pending Approvals (with sub‑tabs) ---------- */}
            <TabsContent value="approvals" className="mt-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl font-black">Pending approvals</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Review submissions and approve/reject with reason.
                      </CardDescription>
                    </div>
                    <Link
                      // to="/admin/approval-audit"
                      className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
                    >
                      Approval Audit
                      <Rule className="w-4 h-4 text-primary" />
                    </Link>
                  </div>

                  {/* Sub‑tabs for Customers / Drivers */}
                  <Tabs value={approvalsSubTab} onValueChange={setApprovalsSubTab} className="mt-4">
                    <TabsList className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-full p-1">
                      <TabsTrigger value="customers" className="rounded-full px-5 py-2 text-xs font-extrabold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">
                        Customers
                        {pendingCustomersQuery.data && pendingCustomersQuery.data.length > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-slate-950 text-[10px] font-black">
                            {pendingCustomersQuery.data.length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="drivers" className="rounded-full px-5 py-2 text-xs font-extrabold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">
                        Drivers
                        {pendingDriversQuery.data && pendingDriversQuery.data.length > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-slate-950 text-[10px] font-black">
                            {pendingDriversQuery.data.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>

                <CardContent className="p-6 sm:p-7">
                  {/* Pending Customers Table */}
                  {approvalsSubTab === 'customers' && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-200 dark:border-slate-800">
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Type</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Business / Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Contact</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Submitted</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingCustomersQuery.isLoading ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                          ) : pendingCustomersQuery.data?.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No pending customers</TableCell></TableRow>
                          ) : (
                            pendingCustomersQuery.data?.map((item) => (
                              <TableRow key={item.id} className="hover:bg-primary/5 transition">
                                <TableCell className="py-4 pr-4">
                                  <TypeBadge 
                                    type={item.customerType === 'BUSINESS' ? 'Business' : 'Private'} 
                                    icon={item.customerType === 'BUSINESS' ? Store : User}
                                    color={item.customerType === 'BUSINESS' ? 'primary' : 'slate'}
                                  />
                                </TableCell>
                                <TableCell className="py-4 pr-4 font-extrabold">
                                  {item.businessName || item.user.fullName}
                                </TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                                  <div>{item.contactEmail || item.user.email}</div>
                                  <div className="text-xs">{item.contactPhone || item.user.phone}</div>
                                </TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="py-4 pr-0">
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => openDialog('view', item, 'customer')}>
                                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                                    </Button>
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDialog('approve', item, 'customer')}>
                                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => openDialog('reject', item, 'customer')}>
                                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pending Drivers Table */}
                  {approvalsSubTab === 'drivers' && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-200 dark:border-slate-800">
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Email</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Phone</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Submitted</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingDriversQuery.isLoading ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                          ) : pendingDriversQuery.data?.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No pending drivers</TableCell></TableRow>
                          ) : (
                            pendingDriversQuery.data?.map((item) => (
                              <TableRow key={item.id} className="hover:bg-primary/5 transition">
                                <TableCell className="py-4 pr-4 font-extrabold">{item.user.fullName}</TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">{item.user.email}</TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">{item.user.phone || '—'}</TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="py-4 pr-0">
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => openDialog('view', item, 'driver')}>
                                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                                    </Button>
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDialog('approve', item, 'driver')}>
                                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => openDialog('reject', item, 'driver')}>
                                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Alert className="mt-6 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                    <Info className="h-4 w-4 text-amber-500" />
                    <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
                      PRD Compliance
                    </AlertTitle>
                    <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
                      Dealer onboarding must select from a directory; Admin can verify/override directory link and approval status.
                      Every action requires a reason and is recorded in audit logs.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------- Dealers (Business Customers) ---------- */}
            <TabsContent value="dealers" className="mt-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-xl font-black">Dealers</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Directory-linked business accounts. Manage approvals, suspensions, and contact persons.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 sm:p-7">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 dark:border-slate-800">
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Business Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Contact</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Status</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Postpaid</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allCustomersQuery.isLoading ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : (
                          allCustomersQuery.data
                            ?.filter((c: Customer) => c.customerType === 'BUSINESS')
                            .map((customer) => (
                              <TableRow key={customer.id} className="hover:bg-primary/5 transition">
                                <TableCell className="py-4 pr-4 font-extrabold">
                                  {customer.businessName || customer.user.fullName}
                                </TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                                  <div>{customer.contactEmail || customer.user.email}</div>
                                  <div className="text-xs">{customer.contactPhone || customer.user.phone}</div>
                                </TableCell>
                                <TableCell className="py-4 pr-4">
                                  <StatusBadge 
                                    status={customer.approvalStatus} 
                                    color={
                                      customer.approvalStatus === 'APPROVED' ? 'emerald' :
                                      customer.approvalStatus === 'SUSPENDED' ? 'amber' :
                                      customer.approvalStatus === 'REJECTED' ? 'rose' : 'slate'
                                    }
                                    icon={
                                      customer.approvalStatus === 'APPROVED' ? CheckCircleIcon :
                                      customer.approvalStatus === 'SUSPENDED' ? PauseCircle :
                                      customer.approvalStatus === 'REJECTED' ? XCircle : Schedule
                                    }
                                  />
                                </TableCell>
                                <TableCell className="py-4 pr-4">
                                  {customer.postpaidEnabled ? 'Yes' : 'No'}
                                </TableCell>
                                <TableCell className="py-4 pr-0">
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => openDialog('view', customer, 'customer')}>
                                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                                    </Button>
                                    {customer.approvalStatus === 'APPROVED' && !customer.suspendedAt && (
                                      <Button size="sm" variant="destructive" onClick={() => openDialog('suspend', customer, 'customer')}>
                                        <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                                      </Button>
                                    )}
                                    {customer.suspendedAt && (
                                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDialog('unsuspend', customer, 'customer')}>
                                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Unsuspend
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------- Drivers ---------- */}
            <TabsContent value="drivers" className="mt-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-xl font-black">Drivers</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Approve drivers, verify documents, and manage availability.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 sm:p-7">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 dark:border-slate-800">
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Email</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Phone</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Status</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allDriversQuery.isLoading ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : (
                          allDriversQuery.data?.map((driver) => (
                            <TableRow key={driver.id} className="hover:bg-primary/5 transition">
                              <TableCell className="py-4 pr-4 font-extrabold">{driver.user.fullName}</TableCell>
                              <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">{driver.user.email}</TableCell>
                              <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">{driver.phone || driver.user.phone || '—'}</TableCell>
                              <TableCell className="py-4 pr-4">
                                <StatusBadge 
                                  status={driver.status} 
                                  color={
                                    driver.status === 'APPROVED' ? 'emerald' :
                                    driver.status === 'SUSPENDED' ? 'amber' :
                                    driver.status === 'REJECTED' ? 'rose' : 'slate'
                                  }
                                  icon={
                                    driver.status === 'APPROVED' ? CheckCircleIcon :
                                    driver.status === 'SUSPENDED' ? PauseCircle :
                                    driver.status === 'REJECTED' ? XCircle : Schedule
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-4 pr-0">
                                <div className="flex flex-wrap gap-2 justify-end">
                                  <Button size="sm" variant="outline" onClick={() => openDialog('view', driver, 'driver')}>
                                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                                  </Button>
                                  {driver.status === 'APPROVED' && !driver.suspendedAt && (
                                    <Button size="sm" variant="destructive" onClick={() => openDialog('suspend', driver, 'driver')}>
                                      <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                                    </Button>
                                  )}
                                  {driver.suspendedAt && (
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDialog('unsuspend', driver, 'driver')}>
                                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Unsuspend
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------- Individuals (Private Customers) ---------- */}
            <TabsContent value="customers" className="mt-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-xl font-black">Individuals</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Individual customers who request deliveries.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 sm:p-7">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 dark:border-slate-800">
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Email</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Phone</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Status</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allCustomersQuery.isLoading ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                        ) : (
                          allCustomersQuery.data
                            ?.filter((c: Customer) => c.customerType === 'PRIVATE')
                            .map((customer) => (
                              <TableRow key={customer.id} className="hover:bg-primary/5 transition">
                                <TableCell className="py-4 pr-4 font-extrabold">{customer.user.fullName}</TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">{customer.user.email}</TableCell>
                                <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">{customer.user.phone || '—'}</TableCell>
                                <TableCell className="py-4 pr-4">
                                  <StatusBadge 
                                    status={customer.approvalStatus} 
                                    color={
                                      customer.approvalStatus === 'APPROVED' ? 'emerald' :
                                      customer.approvalStatus === 'SUSPENDED' ? 'amber' :
                                      customer.approvalStatus === 'REJECTED' ? 'rose' : 'slate'
                                    }
                                    icon={
                                      customer.approvalStatus === 'APPROVED' ? CheckCircleIcon :
                                      customer.approvalStatus === 'SUSPENDED' ? PauseCircle :
                                      customer.approvalStatus === 'REJECTED' ? XCircle : Schedule
                                    }
                                  />
                                </TableCell>
                                <TableCell className="py-4 pr-0">
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => openDialog('view', customer, 'customer')}>
                                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                                    </Button>
                                    {customer.approvalStatus === 'APPROVED' && !customer.suspendedAt && (
                                      <Button size="sm" variant="destructive" onClick={() => openDialog('suspend', customer, 'customer')}>
                                        <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                                      </Button>
                                    )}
                                    {customer.suspendedAt && (
                                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDialog('unsuspend', customer, 'customer')}>
                                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Unsuspend
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        {/* PRD Notes */}
        <p className="mt-6 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Notes (PRD alignment): dealer approval workflow (pending/approved/rejected/suspended) + directory linking; 
          driver approvals with document checks; all admin actions are audit-logged;
          notifications are email-first with optional SMS if policy-enabled.
        </p>
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

      {/* ---------- Dialogs ---------- */}

      {/* View Details Dialog */}
      <Dialog open={dialogOpen && dialogAction === 'view'} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              {userType === 'customer' ? 'Customer information' : 'Driver information'}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {userType === 'customer' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-500">ID</Label>
                      <p className="font-mono text-sm">{selectedUser.id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Type</Label>
                      <p>{selectedUser.customerType}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Business Name</Label>
                      <p>{selectedUser.businessName || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Contact Name</Label>
                      <p>{selectedUser.contactName || selectedUser.user?.fullName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Email</Label>
                      <p>{selectedUser.contactEmail || selectedUser.user?.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Phone</Label>
                      <p>{selectedUser.contactPhone || selectedUser.user?.phone}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Business Address</Label>
                      <p>{selectedUser.businessAddress || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Website</Label>
                      <p>{selectedUser.businessWebsite || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Postpaid</Label>
                      <p>{selectedUser.postpaidEnabled ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Status</Label>
                      <p>{selectedUser.approvalStatus}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Approved At</Label>
                      <p>{selectedUser.approvedAt ? new Date(selectedUser.approvedAt).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Suspended At</Label>
                      <p>{selectedUser.suspendedAt ? new Date(selectedUser.suspendedAt).toLocaleString() : '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-500">Suspension Reason</Label>
                      <p>{selectedUser.suspensionReason || '—'}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-500">ID</Label>
                      <p className="font-mono text-sm">{selectedUser.id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Full Name</Label>
                      <p>{selectedUser.user?.fullName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Email</Label>
                      <p>{selectedUser.user?.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Phone</Label>
                      <p>{selectedUser.phone || selectedUser.user?.phone || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Status</Label>
                      <p>{selectedUser.status}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Approved At</Label>
                      <p>{selectedUser.approvedAt ? new Date(selectedUser.approvedAt).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Suspended At</Label>
                      <p>{selectedUser.suspendedAt ? new Date(selectedUser.suspendedAt).toLocaleString() : '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-500">Suspension Reason</Label>
                      <p>{selectedUser.suspensionReason || '—'}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Customer Dialog */}
      <Dialog open={dialogOpen && dialogAction === 'approve' && userType === 'customer'} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Customer</DialogTitle>
            <DialogDescription>
              Add an optional note and set postpaid preference.
            </DialogDescription>
          </DialogHeader>
          <Form {...approveCustomerForm}>
            <form onSubmit={approveCustomerForm.handleSubmit(onSubmitApproveCustomer)} className="space-y-4">
              <FormField
                control={approveCustomerForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={approveCustomerForm.control}
                name="postpaidEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Postpaid enabled</FormLabel>
                      <FormDescription>
                        Allow customer to pay after delivery.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={approveCustomerMutation.isPending}>Approve</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Approve Driver Dialog */}
      <Dialog open={dialogOpen && dialogAction === 'approve' && userType === 'driver'} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Driver</DialogTitle>
            <DialogDescription>
              Add an optional note.
            </DialogDescription>
          </DialogHeader>
          <Form {...approveDriverForm}>
            <form onSubmit={approveDriverForm.handleSubmit(onSubmitApproveDriver)} className="space-y-4">
              <FormField
                control={approveDriverForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={approveDriverMutation.isPending}>Approve</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog (shared) */}
      <Dialog open={dialogOpen && dialogAction === 'reject'} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {userType === 'customer' ? 'Customer' : 'Driver'}</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <Form {...rejectForm}>
            <form onSubmit={rejectForm.handleSubmit(onSubmitReject)} className="space-y-4">
              <FormField
                control={rejectForm.control}
                name="reason"
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={rejectCustomerMutation.isPending || rejectDriverMutation.isPending}>Reject</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={dialogOpen && dialogAction === 'suspend'} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {userType === 'customer' ? 'Customer' : 'Driver'}</DialogTitle>
            <DialogDescription>
              Please provide a reason for suspension.
            </DialogDescription>
          </DialogHeader>
          <Form {...suspendForm}>
            <form onSubmit={suspendForm.handleSubmit(onSubmitSuspend)} className="space-y-4">
              <FormField
                control={suspendForm.control}
                name="reason"
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={suspendCustomerMutation.isPending || suspendDriverMutation.isPending}>Suspend</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Unsuspend Dialog */}
      <Dialog open={dialogOpen && dialogAction === 'unsuspend'} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsuspend {userType === 'customer' ? 'Customer' : 'Driver'}</DialogTitle>
            <DialogDescription>
              Add a note about unsuspension.
            </DialogDescription>
          </DialogHeader>
          <Form {...unsuspendForm}>
            <form onSubmit={unsuspendForm.handleSubmit(onSubmitUnsuspend)} className="space-y-4">
              <FormField
                control={unsuspendForm.control}
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={unsuspendCustomerMutation.isPending || unsuspendDriverMutation.isPending}>Unsuspend</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}