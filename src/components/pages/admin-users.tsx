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
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { navItems } from '@/lib/items/navItems'
import { useAdminActions } from '@/hooks/useAdminActions'

// Filter form schema
const filterSchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
})

type FilterFormData = z.infer<typeof filterSchema>

// Mock data
const MOCK_USERS = {
  pendingCount: 8,

  pendingApprovals: [
    {
      type: 'Dealer',
      typeIcon: Store,
      typeColor: 'primary',
      name: 'West Coast Auto Mall',
      email: 'ops@westcoastauto.com',
      directory: { status: 'Not Linked', color: 'amber', icon: Warning },
      submitted: '2 hours ago',
    },
    {
      type: 'Driver',
      typeIcon: PersonStanding,
      typeColor: 'slate',
      name: 'Kim Perez',
      email: 'kim.perez@email.com',
      directory: { status: 'License Uploaded', color: 'slate', icon: IdCard },
      submitted: 'Yesterday',
    },
    {
      type: 'Dealer',
      typeIcon: Store,
      typeColor: 'primary',
      name: 'Bay City Toyota',
      email: 'admin@baycitytoyota.com',
      directory: { status: 'Linked', color: 'primary', icon: LinkIcon },
      submitted: '3 days ago',
    },
  ],

  dealers: [
    {
      name: 'Bay City Toyota',
      directory: { status: 'Linked', color: 'primary', icon: LinkIcon },
      status: { label: 'Approved', color: 'primary', icon: CheckCircleIcon },
      contact: 'Maria (maria@baycitytoyota.com)',
    },
    {
      name: 'West Coast Auto Mall',
      directory: { status: 'Not Linked', color: 'amber', icon: Warning },
      status: { label: 'Pending', color: 'slate', icon: Schedule },
      contact: 'John (ops@westcoastauto.com)',
    },
    {
      name: 'Sunset Motors',
      directory: { status: 'Linked', color: 'primary', icon: LinkIcon },
      status: { label: 'Suspended', color: 'slate', icon: PauseCircle },
      contact: 'Support (support@sunsetmotors.com)',
    },
  ],

  drivers: [
    {
      name: 'Kim Perez',
      docs: { status: 'Uploaded', color: 'primary', icon: CheckCircleIcon },
      status: { label: 'Pending', color: 'slate', icon: Schedule },
      rating: null,
    },
    {
      name: 'A. Johnson',
      docs: { status: 'Verified', color: 'primary', icon: VerifiedIcon },
      status: { label: 'Approved', color: 'primary', icon: CheckCircleIcon },
      rating: '4.9',
    },
  ],

  customers: [
    {
      name: 'Sarah Lee',
      email: 'sarah.lee@email.com',
      status: { label: 'Active', color: 'primary', icon: CheckCircleIcon },
      deliveries: 3,
    },
  ],

  roleOptions: [
    { value: 'all', label: 'All' },
    { value: 'Dealer', label: 'Dealer' },
    { value: 'Driver', label: 'Driver' },
    { value: 'Individual', label: 'Individual' },
    { value: 'Admin', label: 'Admin' },
  ],

  statusOptions: [
    { value: 'all', label: 'All' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Suspended', label: 'Suspended' },
  ],
}


export default function AdminUsersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('approvals')
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
const { actionItems, signOut } = useAdminActions();
  const filterForm = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: '',
      role: 'all',
      status: 'all',
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
      description: 'User list filtered.',
    })
    console.log('Filters:', data)
  }

  const handleResetFilters = () => {
    filterForm.reset({
      search: '',
      role: 'all',
      status: 'all',
    })
    toast.info('Filters reset')
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

        {/* Tabs */}
        <section className="mt-10">
          <Tabs defaultValue="approvals" value={activeTab} onValueChange={setActiveTab} className="w-full">
<TabsList
  className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-3xl
    w-full
    !h-auto
    !p-4
    gap-3
    justify-start
  "
>

              <TabsTrigger 
                value="approvals" 
                className="flex-1 sm:flex-none px-5 py-5 rounded-2xl font-extrabold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-950"
              >
                <HowToReg className="w-4 h-4 mr-2" />
                Pending Approvals
                <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-slate-950 text-[11px] font-black">
                  {MOCK_USERS.pendingCount}
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

            {/* Filters */}
            <section className="mt-6">
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
                            className="h-12 w-full pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                            placeholder="Name, email, phone, dealer, license..."
                          />
                        </div>
                      </div>

                      <div className="md:col-span-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Role
                        </Label>
                        <Select
                          onValueChange={(value) => filterForm.setValue('role', value)}
                          defaultValue="all"
                        >
                          <SelectTrigger className="mt-2 h-12 w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_USERS.roleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Status
                        </Label>
                        <Select
                          onValueChange={(value) => filterForm.setValue('status', value)}
                          defaultValue="all"
                        >
                          <SelectTrigger className="mt-2 h-12 w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOCK_USERS.statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2 flex gap-2">
                        <Button type="submit" className="h-12 flex-1 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-extrabold hover:opacity-90 transition">
                          Apply
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center justify-center"
                          onClick={handleResetFilters}
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
                      <Sms className="w-3.5 h-3.5 text-primary mr-1" />
                      SMS optional (policy)
                    </Badge>
                    <Badge variant="outline" className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                      <History className="w-3.5 h-3.5 text-primary mr-1" />
                      Audit logs (PRD)
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Content: Approvals */}
            <TabsContent value="approvals" className="mt-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl font-black">Pending approvals</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Review submissions and approve/reject/suspend with reason. Dealers must map to Directory results (PRD).
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
                </CardHeader>

                <CardContent className="p-6 sm:p-7">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 dark:border-slate-800">
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Type
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Name
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Email
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Directory
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Submitted
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {MOCK_USERS.pendingApprovals.map((item, index) => (
                          <TableRow key={index} className="hover:bg-primary/5 transition">
                            <TableCell className="py-4 pr-4">
                              <TypeBadge 
                                type={item.type} 
                                icon={item.typeIcon} 
                                color={item.typeColor} 
                              />
                            </TableCell>
                            <TableCell className="py-4 pr-4 font-extrabold text-slate-900 dark:text-white">
                              {item.name}
                            </TableCell>
                            <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                              {item.email}
                            </TableCell>
                            <TableCell className="py-4 pr-4">
                              <StatusBadge 
                                status={item.directory.status} 
                                color={item.directory.color}
                                icon={item.directory.icon}
                              />
                            </TableCell>
                            <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                              {item.submitted}
                            </TableCell>
                            <TableCell className="py-4 pr-0">
                              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                                <Link
                                  to="/admin/users/$userId"
                                  params={{ userId: index.toString() }}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                                >
                                  Review
                                  <ArrowRight className="w-4 h-4 text-primary" />
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

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

            {/* Content: Dealers */}
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
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Dealer
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Directory Link
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Status
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Contact
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {MOCK_USERS.dealers.map((item, index) => (
                          <TableRow key={index} className="hover:bg-primary/5 transition">
                            <TableCell className="py-4 pr-4 font-extrabold text-slate-900 dark:text-white">
                              {item.name}
                            </TableCell>
                            <TableCell className="py-4 pr-4">
                              <StatusBadge 
                                status={item.directory.status} 
                                color={item.directory.color}
                                icon={item.directory.icon}
                              />
                            </TableCell>
                            <TableCell className="py-4 pr-4">
                              <StatusBadge 
                                status={item.status.label} 
                                color={item.status.color}
                                icon={item.status.icon}
                              />
                            </TableCell>
                            <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                              {item.contact}
                            </TableCell>
                            <TableCell className="py-4 pr-0 text-right">
                              <Link
                                to="/admin/users/$userId"
                                params={{ userId: `dealer-${index}` }}
                                className={cn(
                                  "inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold transition",
                                  item.status.label === 'Approved'
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                                    : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                                )}
                              >
                                {item.status.label === 'Approved' ? 'Open' : 'Review'}
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Content: Drivers */}
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
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Driver
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Docs
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Status
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Rating
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {MOCK_USERS.drivers.map((item, index) => (
                          <TableRow key={index} className="hover:bg-primary/5 transition">
                            <TableCell className="py-4 pr-4 font-extrabold text-slate-900 dark:text-white">
                              {item.name}
                            </TableCell>
                            <TableCell className="py-4 pr-4">
                              <StatusBadge 
                                status={item.docs.status} 
                                color={item.docs.color}
                                icon={item.docs.icon}
                              />
                            </TableCell>
                            <TableCell className="py-4 pr-4">
                              <StatusBadge 
                                status={item.status.label} 
                                color={item.status.color}
                                icon={item.status.icon}
                              />
                            </TableCell>
                            <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                              {item.rating || '—'}
                            </TableCell>
                            <TableCell className="py-4 pr-0 text-right">
                              <Link
                                to="/admin/users/$userId"
                                params={{ userId: `driver-${index}` }}
                                className={cn(
                                  "inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold transition",
                                  item.status.label === 'Approved'
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                                    : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-primary/5"
                                )}
                              >
                                {item.status.label === 'Approved' ? 'Open' : 'Review'}
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Content: Customers */}
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
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Name
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Email
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Status
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Deliveries
                          </TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {MOCK_USERS.customers.map((item, index) => (
                          <TableRow key={index} className="hover:bg-primary/5 transition">
                            <TableCell className="py-4 pr-4 font-extrabold text-slate-900 dark:text-white">
                              {item.name}
                            </TableCell>
                            <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                              {item.email}
                            </TableCell>
                            <TableCell className="py-4 pr-4">
                              <StatusBadge 
                                status={item.status.label} 
                                color={item.status.color}
                                icon={item.status.icon}
                              />
                            </TableCell>
                            <TableCell className="py-4 pr-4 text-slate-600 dark:text-slate-400">
                              {item.deliveries}
                            </TableCell>
                            <TableCell className="py-4 pr-0 text-right">
                              <Link
                                to="/admin/users/$userId"
                                params={{ userId: `customer-${index}` }}
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
    </div>
  )
}