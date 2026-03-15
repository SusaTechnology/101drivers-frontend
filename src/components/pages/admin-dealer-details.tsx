// app/pages/admin/dealer-details.tsx
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
  Store,
  Clock,
  Building2,
  Check,
  X,
  Edit,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Shield,
  Lock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Menu,
  User,
  Briefcase,
  Link as LinkIcon,
  Verified,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Save,
  Send,
  Ban,
  Settings,
  FileText,
  Receipt,
  Truck,
  Home,
  Users,
  CreditCard,
  Gavel,
  BarChart3,
  DollarSign,
  Clock as ClockIcon,
  CalendarDays,
  Bell,
  Shield as ShieldIcon,
  ArrowRight,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Brand } from '@/lib/items/brand'
import { navItems } from '@/lib/items/navItems'
import { getAdminActionItems } from '@/lib/items/adminActionItems'
import { Navbar } from '../shared/layout/testNavbar'

// Form schemas
const dealerProfileSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  businessEmail: z.string().email('Valid email is required'),
  businessPhone: z.string().min(1, 'Business phone is required'),
  website: z.string().url('Valid URL is required').optional().or(z.literal('')),
  businessAddress: z.string().min(1, 'Business address is required'),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
})

const contactSchema = z.object({
  fullName: z.string().min(1, 'Contact name is required'),
  role: z.string().optional(),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Contact phone is required'),
})

const internalNotesSchema = z.object({
  notes: z.string().optional(),
})

type DealerProfileFormData = z.infer<typeof dealerProfileSchema>
type ContactFormData = z.infer<typeof contactSchema>
type InternalNotesFormData = z.infer<typeof internalNotesSchema>

// Mock data - would come from API in production
const MOCK_DEALER = {
  id: 'dealer_1',
  businessName: 'Cali Motors Group',
  businessEmail: 'ops@calimotors.example',
  businessPhone: '(408) 555-0110',
  website: 'https://calimotors.example',
  businessAddress: '2550 Mission College Blvd, Santa Clara, CA',
  placeId: 'ChIJ1Q8a8LZfwokRz8pX9LZ8LZ8',
  directoryMatch: {
    name: 'Cali Motors Group • San Jose, CA',
    confidence: 'High',
    source: 'Directory search',
    phone: '(408) 555-0110',
    website: 'calimotors.example',
  },
  status: 'PENDING',
  createdAt: 'Feb 05, 2026 • 14:08',
  kpis: {
    deliveries: 12,
    completed: 7,
    disputes: 0,
  },
  contact: {
    fullName: 'Alex Morgan',
    role: 'Operations Manager',
    email: 'alex.morgan@calimotors.example',
    phone: '(408) 555-0126',
  },
  internalNotes: 'Directory match looks correct. Needs confirmation of business email domain.',
  recentDeliveries: [
    {
      id: 'DLV-2041',
      vehicle: 'Sedan • 2021',
      status: 'Listed',
      statusColor: 'slate',
      route: 'San Jose, CA → Sacramento, CA',
      created: 'Feb 10, 2026',
      estimate: 230,
    },
    {
      id: 'DLV-2018',
      vehicle: 'SUV • 2020',
      status: 'Active',
      statusColor: 'indigo',
      route: 'Fremont, CA → Fresno, CA',
      created: 'Feb 07, 2026',
      estimate: 410,
    },
    {
      id: 'DLV-1989',
      vehicle: 'Truck • 2019',
      status: 'Completed',
      statusColor: 'emerald',
      route: 'Oakland, CA → San Diego, CA',
      created: 'Jan 30, 2026',
      estimate: 690,
    },
  ],
}



export default function AdminDealerDetailsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
//   const params = useParams({ from: '/admin/dealer/$dealerId' })

  // Form hooks
  const profileForm = useForm<DealerProfileFormData>({
    resolver: zodResolver(dealerProfileSchema),
    defaultValues: {
      businessName: MOCK_DEALER.businessName,
      businessEmail: MOCK_DEALER.businessEmail,
      businessPhone: MOCK_DEALER.businessPhone,
      website: MOCK_DEALER.website,
      businessAddress: MOCK_DEALER.businessAddress,
      approvalStatus: MOCK_DEALER.status as any,
    },
  })

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: MOCK_DEALER.contact,
  })

  const notesForm = useForm<InternalNotesFormData>({
    resolver: zodResolver(internalNotesSchema),
    defaultValues: {
      notes: MOCK_DEALER.internalNotes,
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

  const handleApprove = () => {
    toast.success('Dealer approved successfully', {
      description: 'Dealer can now access all features.',
    })
    profileForm.setValue('approvalStatus', 'APPROVED')
  }

  const handleReject = () => {
    toast.error('Dealer rejected', {
      description: 'The dealer has been rejected.',
    })
    profileForm.setValue('approvalStatus', 'REJECTED')
  }

  const handleRequestChanges = () => {
    toast.info('Change request sent', {
      description: 'The dealer will be notified to update their information.',
    })
  }

  const handleSaveProfile = (data: DealerProfileFormData) => {
    toast.success('Dealer profile updated')
    console.log('Profile saved:', data)
  }

  const handleSaveContact = (data: ContactFormData) => {
    toast.success('Contact information updated')
    console.log('Contact saved:', data)
  }

  const handleSaveNotes = (data: InternalNotesFormData) => {
    toast.success('Internal notes saved')
    console.log('Notes saved:', data)
  }

  // Status badge component
  const StatusBadge = ({ status, color }: { status: string; color?: string }) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
      APPROVED: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
      REJECTED: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200',
      SUSPENDED: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
      Listed: 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200',
      Active: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
      Completed: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
    }

    const icons: Record<string, any> = {
      PENDING: Clock,
      APPROVED: CheckCircle,
      REJECTED: XCircle,
      SUSPENDED: Ban,
      Listed: Receipt,
      Active: Truck,
      Completed: CheckCircle,
    }

    const Icon = icons[status] || AlertCircle


    return (
      <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest", colors[status] || colors[color || ''])}>
        <Icon className="w-3.5 h-3.5" />
        {status}
      </Badge>
    )
  }
   const actionItems = getAdminActionItems({
    onSignOut: handleSignOut,
    onMobileMenuOpen: () => setMobileMenuOpen(true),
  });
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <Navbar
              brand={<Brand />}
              items={navItems}
              actions={actionItems}
            />

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
          <span className="font-black text-slate-900 dark:text-white">Dealer details</span>
        </div>

        {/* Title */}
        <section className="mt-6 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 pill">
                <Store className="w-3.5 h-3.5 text-primary mr-1" />
                Dealer
              </Badge>

              <StatusBadge status={MOCK_DEALER.status} />

              <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                <Building2 className="w-3.5 h-3.5 text-primary mr-1" />
                Directory-linked
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              {MOCK_DEALER.businessName}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Review dealership details, directory match, contact person, and approval status.
              Approve/reject to grant dealer access per PRD.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleApprove}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
            >
              Approve dealer
              <Check className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleRequestChanges}
              variant="outline"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
            >
              Request changes
              <Edit className="w-4 h-4 text-primary" />
            </Button>
            <Button
              onClick={handleReject}
              variant="destructive"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 text-white hover:opacity-90 transition"
            >
              Reject
              <X className="w-4 h-4" />
            </Button>
          </div>
        </section>

        {/* Content */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Dealer profile */}
          <div className="lg:col-span-7">
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-14 h-14 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                      <AvatarFallback className="text-lg font-black">CM</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-xl font-black">Dealership profile</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Business identity + verification
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" size="sm" className="btn-soft">
                      Open in directory
                      <Globe className="w-4 h-4 text-primary ml-2" />
                    </Button>
                    <Button variant="outline" size="sm" className="btn-ghost">
                      Email dealer
                      <Mail className="w-4 h-4 text-primary ml-2" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <form onSubmit={profileForm.handleSubmit(handleSaveProfile)} className="space-y-6">
                  <div className="md:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                      Directory match
                    </Label>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Matched listing
                          </div>
                          <div className="mt-2 font-black text-slate-900 dark:text-white">
                            {MOCK_DEALER.directoryMatch.name}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Confidence: <span className="font-black text-slate-900 dark:text-white">High</span> • Source: Directory search
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                              <Phone className="w-3 h-3 text-primary mr-1" />
                              {MOCK_DEALER.directoryMatch.phone}
                            </Badge>
                            <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                              <Globe className="w-3 h-3 text-primary mr-1" />
                              {MOCK_DEALER.directoryMatch.website}
                            </Badge>
                          </div>
                        </div>

                        <Badge className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200">
                          <Verified className="w-3.5 h-3.5 text-emerald-500 mr-1" />
                          Matched
                        </Badge>
                      </div>

                      <div className="mt-5 flex flex-col sm:flex-row gap-2">
                        <Button type="button" className="btn-primary">
                          Confirm match
                          <CheckCircle className="w-4 h-4 ml-2" />
                        </Button>
                        <Button type="button" variant="outline" className="btn-ghost">
                          Change match
                          <Edit className="w-4 h-4 text-primary ml-2" />
                        </Button>
                        <Button type="button" variant="outline" className="btn-soft">
                          Mark as new dealer
                          <Plus className="w-4 h-4 text-primary ml-2" />
                        </Button>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
                        PRD: dealer onboarding is directory-based. Admin can confirm the correct listing before approval.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label htmlFor="businessName" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Business name
                      </Label>
                      <Input
                        id="businessName"
                        {...profileForm.register('businessName')}
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="businessEmail" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Business email
                      </Label>
                      <Input
                        id="businessEmail"
                        {...profileForm.register('businessEmail')}
                        type="email"
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="businessPhone" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Phone
                      </Label>
                      <Input
                        id="businessPhone"
                        {...profileForm.register('businessPhone')}
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="website" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Website
                      </Label>
                      <Input
                        id="website"
                        {...profileForm.register('website')}
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="businessAddress" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Business address
                      </Label>
                      <Input
                        id="businessAddress"
                        {...profileForm.register('businessAddress')}
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="createdAt" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Account created
                      </Label>
                      <Input
                        id="createdAt"
                        value={MOCK_DEALER.createdAt}
                        className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 font-mono"
                        disabled
                      />
                    </div>

                    <div>
                      <Label htmlFor="approvalStatus" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Approval status
                      </Label>
                      <Select
                        onValueChange={(value) => profileForm.setValue('approvalStatus', value as any)}
                        defaultValue={MOCK_DEALER.status}
                      >
                        <SelectTrigger className="h-12 rounded-2xl">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">PENDING</SelectItem>
                          <SelectItem value="APPROVED">APPROVED</SelectItem>
                          <SelectItem value="REJECTED">REJECTED</SelectItem>
                          <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Listed deliveries
                      </div>
                      <div className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
                        {MOCK_DEALER.kpis.deliveries}
                      </div>
                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        created by dealer
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Completed
                      </div>
                      <div className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
                        {MOCK_DEALER.kpis.completed}
                      </div>
                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        successful
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Disputes
                      </div>
                      <div className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
                        {MOCK_DEALER.kpis.disputes}
                      </div>
                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        open cases
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" className="btn-primary px-6 py-3 rounded-2xl">
                      <Save className="w-4 h-4 mr-2" />
                      Save profile
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right: Contact + settings */}
          <div className="lg:col-span-5 space-y-6">
            {/* Primary contact */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Primary contact</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Person who created onboarding request
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <User className="w-3.5 h-3.5 text-primary mr-1" />
                    Contact
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7">
                <form onSubmit={contactForm.handleSubmit(handleSaveContact)} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactName" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Full name
                      </Label>
                      <Input
                        id="contactName"
                        {...contactForm.register('fullName')}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Role / title
                      </Label>
                      <Input
                        id="role"
                        {...contactForm.register('role')}
                        className="h-12 rounded-2xl"
                        placeholder="e.g., Operations Manager"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Email
                      </Label>
                      <Input
                        id="contactEmail"
                        {...contactForm.register('email')}
                        type="email"
                        className="h-12 rounded-2xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactPhone" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Phone
                      </Label>
                      <Input
                        id="contactPhone"
                        {...contactForm.register('phone')}
                        className="h-12 rounded-2xl"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Notifications are email-first; SMS can be enabled by Admin policy. Contact person receives approval/changes updates.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="submit" className="btn-primary px-5 py-3 rounded-2xl">
                      <Save className="w-4 h-4 mr-2" />
                      Save contact
                    </Button>
                    <Button type="button" variant="outline" className="btn-ghost px-5 py-3 rounded-2xl">
                      <Mail className="w-4 h-4 text-primary mr-2" />
                      Email contact
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Dealer access */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black">Dealer access</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Permissions and post-approval controls
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="btn-soft">
                    <LinkIcon className="w-4 h-4 text-primary mr-2" />
                    View linked user
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Dealer status
                      </div>
                      <div className="mt-2 font-black text-slate-900 dark:text-white">
                        {MOCK_DEALER.status === 'PENDING' ? 'Pending approval' : MOCK_DEALER.status}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Dealer cannot list/accept deliveries until approved
                      </p>
                    </div>
                    <StatusBadge status={MOCK_DEALER.status} />
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleApprove} className="btn-primary px-5 py-3 rounded-2xl">
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button onClick={handleRequestChanges} variant="outline" className="btn-ghost px-5 py-3 rounded-2xl">
                      <Edit className="w-4 h-4 text-primary mr-2" />
                      Request changes
                    </Button>
                    <Button onClick={handleReject} variant="destructive" className="btn-danger px-5 py-3 rounded-2xl">
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
                    PRD: Dealer approval is admin-controlled. Once approved, dealer can create deliveries and manage their directory-linked profile.
                  </p>
                </div>

                {/* Internal notes */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                  <form onSubmit={notesForm.handleSubmit(handleSaveNotes)}>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Internal notes
                    </div>
                    <Textarea
                      {...notesForm.register('notes')}
                      className="mt-3 w-full min-h-[110px] rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 p-4 text-sm"
                      placeholder="Add internal notes for the admin team…"
                    />
                    <div className="mt-3 flex justify-end">
                      <Button type="submit" variant="outline" className="btn-ghost px-5 py-2.5">
                        <FileText className="w-4 h-4 text-primary mr-2" />
                        Save notes
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Dealer deliveries snapshot */}
        <section className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black">Recent dealer deliveries</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Most recent listings and status
                  </CardDescription>
                </div>
                <Link
                  to="/admin-deliveries"
                  className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
                >
                  View all
                  <ArrowRight className="w-4 h-4 text-primary" />
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-800">
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Delivery
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Status
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Pickup → Drop-off
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        Created
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                        Est.
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_DEALER.recentDeliveries.map((delivery) => (
                      <TableRow key={delivery.id} className="border-slate-100 dark:border-slate-800 hover:bg-primary/5">
                        <TableCell className="py-4">
                          <Link
                            to={`/admin/delivery/${delivery.id}`}
                            className="font-extrabold text-slate-900 dark:text-white hover:text-primary transition-colors"
                          >
                            {delivery.id}
                          </Link>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {delivery.vehicle}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <StatusBadge status={delivery.status} color={delivery.statusColor} />
                        </TableCell>
                        <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
                          {delivery.route}
                        </TableCell>
                        <TableCell className="py-4 text-sm font-mono text-slate-600 dark:text-slate-400">
                          {delivery.created}
                        </TableCell>
                        <TableCell className="py-4 text-right text-sm font-black text-slate-900 dark:text-white font-mono">
                          ${delivery.estimate}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="px-6 sm:px-7 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Showing <span className="font-black text-slate-900 dark:text-white">{MOCK_DEALER.recentDeliveries.length}</span> records
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
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              PRD Coverage
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              Dealer directory-based onboarding + Admin approval, contact person management, and ability to monitor dealer-created deliveries and statuses.
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
                Admin Console • Dealer Details
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