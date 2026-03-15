// app/pages/admin/users/$userId.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Check,
  Edit,
  Ban as Block,
  RotateCcw as LockReset,
  History,
  Shield,
  Verified,
  AlertCircle,
  Info,
  User,
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
  AlertTriangle,
  Eye,
  ExternalLink as OpenInNew,
  FileText,
  Upload,
  IdCard,
  TriangleAlert as Warning,
  Clock as Schedule,
  FileText as Assignment,
  Verified as VerifiedIcon,
  CircleAlert as ErrorIcon,
  CheckCheck,
  Save,
  Send,
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
  ShieldCheck,
  ShieldAlert,
  ShieldX,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

// Form schema for user details
const userDetailsSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  role: z.enum(['ADMIN', 'DEALER', 'DRIVER', 'CUSTOMER']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED']),
})

type UserDetailsFormData = z.infer<typeof userDetailsSchema>

// Mock user data
const MOCK_USER = {
  id: 'user-123',
  initials: 'JP',
  fullName: 'Jordan Parker',
  email: 'jordan.parker@example.com',
  phone: '(415) 555-0191',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  secondaryStatus: 'PENDING_APPROVAL',
  createdAt: 'Feb 01, 2026 • 10:22',
  
  kpis: [
    { label: 'Deliveries', value: '28', subtitle: 'as driver' },
    { label: 'Disputes', value: '1', subtitle: 'opened' },
    { label: 'Last activity', value: 'Feb 11', subtitle: '2 days ago' },
  ],

  onboarding: {
    type: 'Driver application',
    submitted: 'Feb 08, 2026 • 16:40',
    status: 'Review',
    statusColor: 'slate',
    documents: [
      { label: 'ID uploaded', status: 'complete', icon: IdCard },
      { label: 'Insurance pending', status: 'pending', icon: Warning },
    ],
  },

  insurance: {
    status: 'Pending certificate',
    description: 'Requires verification before assignments',
    statusBadge: { label: 'Pending', color: 'amber' },
    documents: [
      { label: 'Upload received', icon: Upload },
      { label: 'Review needed', icon: Eye },
    ],
  },

  activity: [
    {
      time: 'Feb 11, 2026 • 09:12',
      event: 'Signed in',
      description: 'Successful authentication',
      context: 'Admin Console',
      actor: 'Jordan Parker',
      ref: 'AUTH-1782',
    },
    {
      time: 'Feb 10, 2026 • 18:44',
      event: 'Document uploaded',
      description: 'Insurance certificate',
      context: 'Driver onboarding',
      actor: 'Jordan Parker',
      ref: 'DOC-5520',
    },
    {
      time: 'Feb 08, 2026 • 16:40',
      event: 'Application submitted',
      description: 'Driver onboarding request',
      context: 'Onboarding',
      actor: 'Jordan Parker',
      ref: 'APP-3021',
    },
  ],
}

// Navigation items
const navItems = [
  { href: '/admin-dashboard', label: 'Dashboard' },
  { href: '/admin-users', label: 'Users', active: true },
  { href: '/admin-deliveries', label: 'Deliveries' },
  { href: '/admin-pricing', label: 'Pricing' },
  { href: '/admin-scheduling-policy', label: 'Scheduling' },
  { href: '/admin-disputes', label: 'Disputes' },
  { href: '/admin-payments', label: 'Payments' },
  { href: '/admin-insurance-reporting', label: 'Insurance' },
]

export default function AdminUserDetailsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
//   const params = useParams({ from: '/admin/users/$userId' })

  const form = useForm<UserDetailsFormData>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: {
      fullName: MOCK_USER.fullName,
      email: MOCK_USER.email,
      phone: MOCK_USER.phone,
      role: MOCK_USER.role,
      status: MOCK_USER.status,
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

  const handleSaveChanges = (data: UserDetailsFormData) => {
    toast.success('User updated', {
      description: 'User details have been saved successfully.',
    })
    console.log('User data:', data)
  }

  const handleResetPassword = () => {
    toast.info('Password reset', {
      description: 'Password reset email has been sent to the user.',
    })
  }

  const handleSuspend = () => {
    toast.warning('User suspended', {
      description: 'User access has been suspended.',
    })
    form.setValue('status', 'SUSPENDED')
  }

  const handleEmailUser = () => {
    toast.success('Email sent', {
      description: 'Email has been sent to the user.',
    })
  }

  const handleAuditLog = () => {
    toast.info('Audit log', {
      description: 'Opening audit log view.',
    })
    // Navigate to audit log
  }

  const handleApprove = () => {
    toast.success('Application approved', {
      description: 'Driver application has been approved.',
    })
  }

  const handleRequestChanges = () => {
    toast.info('Changes requested', {
      description: 'Request for additional information sent.',
    })
  }

  const handleReject = () => {
    toast.error('Application rejected', {
      description: 'Driver application has been rejected.',
    })
  }

  const handleVerifyInsurance = () => {
    toast.success('Insurance verified', {
      description: 'Insurance certificate has been verified.',
    })
  }

  const handleMarkIncomplete = () => {
    toast.warning('Marked incomplete', {
      description: 'Insurance marked as incomplete.',
    })
  }

  const handleExport = () => {
    toast.success('Export started', {
      description: 'Activity log export will be downloaded.',
    })
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
      indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
      primary: 'bg-primary/10 border-primary/25 text-primary-foreground',
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

  // Pill badge component
  const PillBadge = ({ 
    children, 
    icon: Icon,
    color = 'slate'
  }: { 
    children: React.ReactNode; 
    icon?: any;
    color?: string;
  }) => {
    const colors: Record<string, string> = {
      slate: 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200',
      amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
      indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
      emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
    }

    return (
      <span className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border",
        colors[color] || colors.slate
      )}>
        {Icon && <Icon className="w-4 h-4" />}
        {children}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-7">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "text-sm font-semibold hover:text-primary transition-colors",
                    item.active
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
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

            <Button
              onClick={handleSignOut}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-11 h-11 rounded-2xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 z-50 md:hidden overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200">
                    <img
                      src="/assets/101drivers-logo.jpg"
                      alt="101 Drivers"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Admin</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 rounded-2xl"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "block px-4 py-3 rounded-2xl text-sm font-semibold transition-colors",
                      item.active
                        ? "bg-primary/15 text-slate-900 dark:text-white border border-primary/25"
                        : "text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <Separator className="my-6" />

              <Button
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Sign Out
                <LogOut className="w-4 h-4 text-primary" />
              </Button>
            </div>
          </>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/admin-users"
            className="inline-flex items-center gap-2 font-extrabold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-primary" />
            Back to Users
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-black text-slate-900 dark:text-white">User details</span>
        </div>

        {/* Title */}
        <section className="mt-6 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PillBadge icon={User} color="slate">
                User Profile
              </PillBadge>

              <PillBadge icon={VerifiedIcon} color="indigo">
                Admin-managed
              </PillBadge>

              <StatusBadge 
                status="Active" 
                color="emerald" 
                icon={CheckCircle} 
              />

              <StatusBadge 
                status="Pending review" 
                color="amber" 
                icon={Schedule} 
              />
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              {MOCK_USER.fullName}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              View identity, role, onboarding status, approvals, and activity. Take actions like approve dealer/driver, suspend access, or reset credentials.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleAuditLog}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <History className="w-4 h-4 text-primary" />
              Audit log
            </Button>
            <Button
              onClick={handleResetPassword}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition btn-soft"
            >
              <LockReset className="w-4 h-4 text-primary" />
              Reset password
            </Button>
            <Button
              onClick={handleSuspend}
              variant="destructive"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 text-white hover:opacity-90 transition"
            >
              <Block className="w-4 h-4" />
              Suspend
            </Button>
          </div>
        </section>

        {/* Summary */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Account summary */}
          <Card className="lg:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                    <AvatarFallback className="text-lg font-black">{MOCK_USER.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl font-black">Account summary</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Core identity + access
                    </CardDescription>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={form.handleSubmit(handleSaveChanges)}
                    size="sm"
                    className="btn-primary px-5 py-2.5"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save changes
                  </Button>
                  <Button
                    onClick={handleEmailUser}
                    variant="outline"
                    size="sm"
                    className="btn-ghost px-5 py-2.5"
                  >
                    <Mail className="w-4 h-4 text-primary mr-2" />
                    Email user
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-7">
              <form onSubmit={form.handleSubmit(handleSaveChanges)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="fullName" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Full name
                    </Label>
                    <Input
                      id="fullName"
                      {...form.register('fullName')}
                      className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Email
                    </Label>
                    <Input
                      id="email"
                      {...form.register('email')}
                      type="email"
                      className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                      Email-first notifications. SMS is optional if enabled by Admin policy.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="role" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Role
                    </Label>
                    <Select
                      onValueChange={(value) => form.setValue('role', value as any)}
                      defaultValue={MOCK_USER.role}
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="DEALER">DEALER</SelectItem>
                        <SelectItem value="DRIVER">DRIVER</SelectItem>
                        <SelectItem value="CUSTOMER">CUSTOMER</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Status
                    </Label>
                    <Select
                      onValueChange={(value) => form.setValue('status', value as any)}
                      defaultValue={MOCK_USER.status}
                    >
                      <SelectTrigger className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                        <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                        <SelectItem value="PENDING_APPROVAL">PENDING_APPROVAL</SelectItem>
                        <SelectItem value="REJECTED">REJECTED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="created" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Created
                    </Label>
                    <Input
                      id="created"
                      value={MOCK_USER.createdAt}
                      className="w-full h-12 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm font-mono"
                      disabled
                    />
                  </div>
                </div>
              </form>

              <Separator className="my-6" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MOCK_USER.kpis.map((kpi, index) => (
                  <div key={index} className="kpi bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      {kpi.label}
                    </div>
                    <div className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
                      {kpi.value}
                    </div>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      {kpi.subtitle}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Onboarding & approvals */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Onboarding & approvals</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Admin approval flow for Dealer/Driver per PRD
                    </CardDescription>
                  </div>
                  <StatusBadge 
                    status="Pending" 
                    color="amber" 
                    icon={Schedule}
                  />
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-5">
                <div className="card bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Request
                      </div>
                      <div className="mt-2 font-black text-slate-900 dark:text-white">
                        {MOCK_USER.onboarding.type}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Submitted: {MOCK_USER.onboarding.submitted}
                      </p>
                    </div>
                    <StatusBadge 
                      status={MOCK_USER.onboarding.status} 
                      color={MOCK_USER.onboarding.statusColor}
                      icon={Assignment}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {MOCK_USER.onboarding.documents.map((doc, index) => (
                      <PillBadge 
                        key={index} 
                        icon={doc.icon}
                        color={doc.status === 'pending' ? 'amber' : 'slate'}
                      >
                        {doc.label}
                      </PillBadge>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleApprove}
                      className="flex-1 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={handleRequestChanges}
                      variant="outline"
                      className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                    >
                      <Edit className="w-4 h-4 text-primary mr-2" />
                      Request changes
                    </Button>
                    <Button
                      onClick={handleReject}
                      variant="outline"
                      className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition btn-soft"
                    >
                      <XCircle className="w-4 h-4 text-primary mr-2" />
                      Reject
                    </Button>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
                    Notifications are email-first; SMS can be enabled by policy. Approval actions will notify the applicant and update role access.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Risk & compliance */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Risk & compliance</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Insurance docs, claims flags, and policy visibility
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => navigate({ to: '/admin/insurance' })}
                    variant="outline"
                    size="sm"
                    className="btn-ghost px-5 py-2.5"
                  >
                    <Shield className="w-4 h-4 text-primary mr-2" />
                    Open insurance
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 gap-4">
                  <div className="card bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          Insurance status
                        </div>
                        <div className="mt-2 font-black text-slate-900 dark:text-white">
                          {MOCK_USER.insurance.status}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {MOCK_USER.insurance.description}
                        </p>
                      </div>
                      <StatusBadge 
                        status={MOCK_USER.insurance.statusBadge.label} 
                        color={MOCK_USER.insurance.statusBadge.color}
                        icon={Schedule}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {MOCK_USER.insurance.documents.map((doc, index) => (
                        <PillBadge key={index} icon={doc.icon}>
                          {doc.label}
                        </PillBadge>
                      ))}
                    </div>

                    <div className="mt-5 flex gap-2">
                      <Button
                        onClick={handleVerifyInsurance}
                        className="flex-1 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                      >
                        <VerifiedIcon className="w-4 h-4 mr-2" />
                        Verify
                      </Button>
                      <Button
                        onClick={handleMarkIncomplete}
                        variant="outline"
                        className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                      >
                        <AlertCircle className="w-4 h-4 text-primary mr-2" />
                        Mark incomplete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Activity */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">Recent activity</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Events for audit + troubleshooting
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExport}
                  variant="outline"
                  size="sm"
                  className="btn-soft px-5 py-2.5"
                >
                  <Download className="w-4 h-4 text-primary mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-950">
                    <TableRow>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Time
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Event
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Context
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Actor
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">
                        Ref
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {MOCK_USER.activity.map((item, index) => (
                      <TableRow key={index} className="hover:bg-primary/5 transition">
                        <TableCell className="px-5 py-4 text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                          {item.time}
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <div className="font-black text-slate-900 dark:text-white">
                            {item.event}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {item.description}
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {item.context}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {item.actor}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-right text-sm font-mono text-slate-500">
                          {item.ref}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="px-6 sm:px-7 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Showing <span className="font-black text-slate-900 dark:text-white">{MOCK_USER.activity.length}</span> events
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
              Admin can manage users, approve/reject dealer/driver onboarding, suspend accounts, review insurance/compliance items, and view audit-style activity.
            </AlertDescription>
          </Alert>
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
                Admin Console • User Details
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