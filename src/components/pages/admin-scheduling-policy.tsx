// app/pages/admin/scheduling-policy.tsx
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
  Save,
  Rocket,
  Info,
  History,
  Edit,
  Verified,
  Calendar,
  Clock,
  Timer,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Mail,
  MessageCircle as Sms,
  Bell,
  Shield,
  Truck,
  CreditCard,
  Gavel,
  DollarSign,
  Percent,
  Receipt,
  Tag,
  Hash,
  Building2,
  Phone,
  MapPin,
  Home,
  CalendarDays,
  Hourglass,
  Settings,
  Sliders,
  Scale,
  Flag,
  Ban,
  CheckCheck,
  FileText,
  MessageSquare,
  StickyNote as Note,
  Paperclip as AttachFile,
  Clock as Schedule,
  AlertTriangle as Warning,
  CalendarCheck as EventAvailable,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  X as XIcon,
  Check,
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
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Navbar } from '../shared/layout/testNavbar'
import { Brand } from '@/lib/items/brand'
import { navItems } from '@/lib/items/navItems'
import { useAdminActions } from '@/hooks/useAdminActions'

// Form schemas
const bookingWindowsSchema = z.object({
  minLeadTime: z.number().min(0, 'Minimum lead time must be 0 or greater'),
  maxAdvanceBooking: z.number().min(1, 'Maximum advance booking must be at least 1'),
  sameDayScheduling: z.enum(['Disabled', 'Allowed (with lead time)', 'Allowed (no lead time)']),
  operatingDays: z.array(z.string()).optional(),
})

const driverMatchingSchema = z.object({
  offerMode: z.enum(['Broadcast to eligible drivers', 'Sequential offers (round-robin)', 'Manual assignment only']),
  acceptanceWindow: z.number().min(1, 'Acceptance window must be at least 1'),
  autoReassignment: z.boolean(),
  maxAttempts: z.number().min(1, 'Max attempts must be at least 1'),
  cooldown: z.number().min(0, 'Cooldown must be 0 or greater'),
  fallback: z.enum(['Escalate to Admin manual dispatch', 'Keep in broadcast pool', 'Auto-cancel (not recommended)']),
})

const cancellationPolicySchema = z.object({
  customerCutoff: z.number().min(0, 'Cutoff must be 0 or greater'),
  driverCutoff: z.number().min(0, 'Cutoff must be 0 or greater'),
  reasons: z.object({
    vehicleUnavailable: z.boolean(),
    weather: z.boolean(),
    buyerRequest: z.boolean(),
    other: z.boolean(),
  }),
})

const slaTimersSchema = z.object({
  pickupLateThreshold: z.number().min(0, 'Threshold must be 0 or greater'),
  completionLateThreshold: z.number().min(0, 'Threshold must be 0 or greater'),
})

type BookingWindowsFormData = z.infer<typeof bookingWindowsSchema>
type DriverMatchingFormData = z.infer<typeof driverMatchingSchema>
type CancellationPolicyFormData = z.infer<typeof cancellationPolicySchema>
type SLATimersFormData = z.infer<typeof slaTimersSchema>

// Mock data
const MOCK_SCHEDULING_POLICY = {
  bookingWindows: {
    minLeadTime: 12,
    maxAdvanceBooking: 30,
    sameDayScheduling: 'Allowed (with lead time)',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },

  driverMatching: {
    offerMode: 'Broadcast to eligible drivers',
    acceptanceWindow: 20,
    autoReassignment: true,
    maxAttempts: 5,
    cooldown: 5,
    fallback: 'Escalate to Admin manual dispatch',
  },

  cancellationPolicy: {
    customerCutoff: 6,
    driverCutoff: 4,
    reasons: {
      vehicleUnavailable: true,
      weather: true,
      buyerRequest: false,
      other: true,
    },
  },

  slaTimers: {
    pickupLateThreshold: 30,
    completionLateThreshold: 60,
  },

  audit: [
    {
      action: 'Published v1.3',
      timestamp: 'Feb 05, 2026 • 09:15 AM',
      user: 'Admin',
      icon: History,
    },
    {
      action: 'Updated acceptance window',
      timestamp: 'Jan 30, 2026 • 06:02 PM',
      user: 'Admin',
      icon: Edit,
    },
  ],

  policySummary: [
    {
      label: 'Bookings',
      value: '12h → 30d',
      description: 'Min lead time 12 hours; max 30 days ahead.',
    },
    {
      label: 'Offers',
      value: 'Broadcast',
      description: 'Eligible drivers get offer; 20-minute acceptance.',
    },
    {
      label: 'Reassign',
      value: 'Enabled',
      description: 'Max 5 attempts with 5-min cooldown.',
    },
  ],
}

// Navigation items


export default function AdminSchedulingPolicyPage() {
      const { actionItems, signOut } = useAdminActions();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [operatingDays, setOperatingDays] = useState<string[]>(MOCK_SCHEDULING_POLICY.bookingWindows.operatingDays)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  // Form hooks
  const bookingForm = useForm<BookingWindowsFormData>({
    resolver: zodResolver(bookingWindowsSchema),
    defaultValues: {
      minLeadTime: MOCK_SCHEDULING_POLICY.bookingWindows.minLeadTime,
      maxAdvanceBooking: MOCK_SCHEDULING_POLICY.bookingWindows.maxAdvanceBooking,
      sameDayScheduling: MOCK_SCHEDULING_POLICY.bookingWindows.sameDayScheduling as any,
      operatingDays: MOCK_SCHEDULING_POLICY.bookingWindows.operatingDays,
    },
  })

  const driverForm = useForm<DriverMatchingFormData>({
    resolver: zodResolver(driverMatchingSchema),
    defaultValues: {
      offerMode: MOCK_SCHEDULING_POLICY.driverMatching.offerMode as any,
      acceptanceWindow: MOCK_SCHEDULING_POLICY.driverMatching.acceptanceWindow,
      autoReassignment: MOCK_SCHEDULING_POLICY.driverMatching.autoReassignment,
      maxAttempts: MOCK_SCHEDULING_POLICY.driverMatching.maxAttempts,
      cooldown: MOCK_SCHEDULING_POLICY.driverMatching.cooldown,
      fallback: MOCK_SCHEDULING_POLICY.driverMatching.fallback as any,
    },
  })

  const cancellationForm = useForm<CancellationPolicyFormData>({
    resolver: zodResolver(cancellationPolicySchema),
    defaultValues: {
      customerCutoff: MOCK_SCHEDULING_POLICY.cancellationPolicy.customerCutoff,
      driverCutoff: MOCK_SCHEDULING_POLICY.cancellationPolicy.driverCutoff,
      reasons: MOCK_SCHEDULING_POLICY.cancellationPolicy.reasons,
    },
  })

  const slaForm = useForm<SLATimersFormData>({
    resolver: zodResolver(slaTimersSchema),
    defaultValues: {
      pickupLateThreshold: MOCK_SCHEDULING_POLICY.slaTimers.pickupLateThreshold,
      completionLateThreshold: MOCK_SCHEDULING_POLICY.slaTimers.completionLateThreshold,
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

  const handleSaveDraft = () => {
    toast.success('Draft saved', {
      description: 'Scheduling policy draft has been saved.',
    })
  }

  const handlePublishPolicy = () => {
    toast.success('Policy published', {
      description: 'Scheduling policy has been published and is now active.',
    })
  }

  const toggleOperatingDay = (day: string) => {
    setOperatingDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
        {/* Top */}
        <section className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="chip bg-primary/10 border-primary/25 text-slate-800 dark:text-slate-200">
                <EventAvailable className="w-4 h-4 text-primary mr-1" />
                Scheduling Policy
              </Badge>
              <Badge variant="outline" className="badge bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                <Verified className="w-3.5 h-3.5 text-primary mr-1" />
                Admin-only (Prototype)
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Scheduling & Dispatch Policy
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Configure operational rules that govern booking windows, driver matching, acceptance/cancellation, and SLA behavior (PRD-aligned).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSaveDraft}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              <Save className="w-4 h-4 text-primary" />
              Save Draft
            </Button>
            <Button
              onClick={handlePublishPolicy}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              <Rocket className="w-4 h-4" />
              Publish Policy
            </Button>
          </div>
        </section>

        {/* Content */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left */}
          <div className="lg:col-span-8 space-y-6">
            {/* Booking windows */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Booking windows</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      How far ahead customers can request and how soon dispatch can schedule.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="chip bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200">
                    <Info className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    Prototype form
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label htmlFor="minLeadTime" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Min lead time (hours)
                    </Label>
                    <Input
                      id="minLeadTime"
                      type="number"
                      {...bookingForm.register('minLeadTime', { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Prevents "too-soon" bookings.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label htmlFor="maxAdvanceBooking" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Max advance booking (days)
                    </Label>
                    <Input
                      id="maxAdvanceBooking"
                      type="number"
                      {...bookingForm.register('maxAdvanceBooking', { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      How far out customers can request.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label htmlFor="sameDayScheduling" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Same-day scheduling
                    </Label>
                    <Select
                      onValueChange={(value) => bookingForm.setValue('sameDayScheduling', value as any)}
                      defaultValue={MOCK_SCHEDULING_POLICY.bookingWindows.sameDayScheduling}
                    >
                      <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Disabled">Disabled</SelectItem>
                        <SelectItem value="Allowed (with lead time)">Allowed (with lead time)</SelectItem>
                        <SelectItem value="Allowed (no lead time)">Allowed (no lead time)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      If allowed, system still enforces minimum lead time.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Operating days
                    </Label>
                    <div className="grid grid-cols-7 gap-2">
                      {daysOfWeek.map((day) => (
                        <Button
                          key={day}
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-10 rounded-2xl font-black text-[11px] border border-slate-200 dark:border-slate-800",
                            operatingDays.includes(day)
                              ? "bg-primary/15 text-slate-900 dark:text-white"
                              : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                          )}
                          onClick={() => toggleOperatingDay(day)}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Prototype toggles; production will store as policy config.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    PRD: quote-first flow collects schedule after estimate; policy enforces which dates/times are selectable.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Driver matching */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">Driver matching & assignment</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    How deliveries are offered to drivers and how long they have to accept.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label htmlFor="offerMode" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Offer mode
                    </Label>
                    <Select
                      onValueChange={(value) => driverForm.setValue('offerMode', value as any)}
                      defaultValue={MOCK_SCHEDULING_POLICY.driverMatching.offerMode}
                    >
                      <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Broadcast to eligible drivers">Broadcast to eligible drivers</SelectItem>
                        <SelectItem value="Sequential offers (round-robin)">Sequential offers (round-robin)</SelectItem>
                        <SelectItem value="Manual assignment only">Manual assignment only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Eligibility includes driver approval + active status.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label htmlFor="acceptanceWindow" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Driver acceptance window (minutes)
                    </Label>
                    <Input
                      id="acceptanceWindow"
                      type="number"
                      {...driverForm.register('acceptanceWindow', { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      If expired, system reassigns per policy.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 md:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          Auto-reassignment
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          When a driver rejects, times out, or cancels after assignment.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="autoReassignment"
                          checked={driverForm.watch('autoReassignment')}
                          onCheckedChange={(checked) => driverForm.setValue('autoReassignment', checked)}
                        />
                        <Label htmlFor="autoReassignment" className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {driverForm.watch('autoReassignment') ? 'Enabled' : 'Disabled'}
                        </Label>
                      </div>
                    </div>

                    {driverForm.watch('autoReassignment') && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="maxAttempts" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Max attempts
                          </Label>
                          <Input
                            id="maxAttempts"
                            type="number"
                            {...driverForm.register('maxAttempts', { valueAsNumber: true })}
                            className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cooldown" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Cooldown (minutes)
                          </Label>
                          <Input
                            id="cooldown"
                            type="number"
                            {...driverForm.register('cooldown', { valueAsNumber: true })}
                            className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="fallback" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Fallback
                          </Label>
                          <Select
                            onValueChange={(value) => driverForm.setValue('fallback', value as any)}
                            defaultValue={MOCK_SCHEDULING_POLICY.driverMatching.fallback}
                          >
                            <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                              <SelectValue placeholder="Select fallback" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Escalate to Admin manual dispatch">Escalate to Admin manual dispatch</SelectItem>
                              <SelectItem value="Keep in broadcast pool">Keep in broadcast pool</SelectItem>
                              <SelectItem value="Auto-cancel (not recommended)">Auto-cancel (not recommended)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal font-medium">
                    Notifications: email-first. SMS is optional if enabled by admin policy. (PRD requirement)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Cancellation policy */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">Cancellation & no-show policy</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Define who can cancel and what happens after cancellation.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label htmlFor="customerCutoff" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Customer cancellation cutoff (hours)
                    </Label>
                    <Input
                      id="customerCutoff"
                      type="number"
                      {...cancellationForm.register('customerCutoff', { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      After cutoff, cancellation may trigger fee (payments rules).
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                    <Label htmlFor="driverCutoff" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Driver cancellation cutoff (hours)
                    </Label>
                    <Input
                      id="driverCutoff"
                      type="number"
                      {...cancellationForm.register('driverCutoff', { valueAsNumber: true })}
                      className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Late cancel triggers reassignment and possible driver action.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 md:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Allowed cancellation reasons
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">Vehicle unavailable</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Customer/Dealer can select.</div>
                        </div>
                        <Checkbox
                          id="reasonVehicle"
                          checked={cancellationForm.watch('reasons.vehicleUnavailable')}
                          onCheckedChange={(checked) => 
                            cancellationForm.setValue('reasons.vehicleUnavailable', checked as boolean)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">Weather / road closure</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Driver/Admin can select.</div>
                        </div>
                        <Checkbox
                          id="reasonWeather"
                          checked={cancellationForm.watch('reasons.weather')}
                          onCheckedChange={(checked) => 
                            cancellationForm.setValue('reasons.weather', checked as boolean)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">Buyer request change</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dealer can select.</div>
                        </div>
                        <Checkbox
                          id="reasonBuyer"
                          checked={cancellationForm.watch('reasons.buyerRequest')}
                          onCheckedChange={(checked) => 
                            cancellationForm.setValue('reasons.buyerRequest', checked as boolean)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">Other (requires notes)</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enforces explanation.</div>
                        </div>
                        <Checkbox
                          id="reasonOther"
                          checked={cancellationForm.watch('reasons.other')}
                          onCheckedChange={(checked) => 
                            cancellationForm.setValue('reasons.other', checked as boolean)
                          }
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                      PRD: disputes exist — cancellation events must be auditable and can lead to dispute workflow.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right */}
          <div className="lg:col-span-4 space-y-6">
            {/* Policy summary */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">Policy summary</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Quick interpretation of current settings.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-7">
                <div className="grid grid-cols-1 gap-4">
                  {MOCK_SCHEDULING_POLICY.policySummary.map((item, index) => (
                    <div key={index} className="kpi bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {item.label}
                      </div>
                      <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                        {item.value}
                      </div>
                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* SLA timers */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">SLA timers</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Controls when a delivery is flagged for attention.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <Label htmlFor="pickupLateThreshold" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                    Pickup "late" threshold (minutes)
                  </Label>
                  <Input
                    id="pickupLateThreshold"
                    type="number"
                    {...slaForm.register('pickupLateThreshold', { valueAsNumber: true })}
                    className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    When the pickup window is missed, notify stakeholders.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                  <Label htmlFor="completionLateThreshold" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                    Completion "late" threshold (minutes)
                  </Label>
                  <Input
                    id="completionLateThreshold"
                    type="number"
                    {...slaForm.register('completionLateThreshold', { valueAsNumber: true })}
                    className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 px-4 text-sm"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Used for escalation and dispute context.
                  </p>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                    PRD: delivery lifecycle includes proof capture and status events. SLA timers help drive escalation + dispute readiness.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Audit */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div>
                  <CardTitle className="text-xl font-black">Audit</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Policy change history (prototype).
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-3">
                {MOCK_SCHEDULING_POLICY.audit.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800"
                  >
                    <entry.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {entry.action}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {entry.timestamp} • by {entry.user}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* PRD note */}
        <section className="mt-6">
          <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              PRD Coverage
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              Booking windows, driver offer/acceptance, reassignment, cancellation reasons, SLA timers, and notification policy (email-first, SMS optional).
              Next suggested page: admin-disputes.html.
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
                Admin Console • Scheduling Policy
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