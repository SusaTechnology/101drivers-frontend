// app/pages/driver/issue-report.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Info,
  Verified,
  Truck as LocalShipping,
  MapPin as PinDrop,
  Flag,
  FileText as Report,
  FileCheck as FactCheck,
  ShieldCheck as HealthAndSafety,
  MoreHorizontal as MoreHoriz,
  Mail,
  MessageSquare as Sms,
  X as Close,
  ArrowRight as ArrowForward,
  Camera,
  Crop,
  Edit2 as EditNote,
  Paperclip as AttachFile,
  MapPin as MyLocation,
  LayoutDashboard as Dashboard,
  Inbox,
  Menu,
  Home,
  Car,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Image,
  FileText,
  Paperclip,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  MapPin,
  Navigation,
  Compass,
  Gauge,
  Fuel,
  Settings,
  Sliders,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// Mock delivery data
const MOCK_DELIVERY = {
  id: 'DLV-10392',
  status: 'Active',
  pickup: {
    city: 'San Jose',
    location: 'Dealer lot',
  },
  dropoff: {
    city: 'Los Angeles',
    location: 'Customer address',
  },
  sla: '2h 10m',
  slaDescription: 'Until next checkpoint',
}

// Issue types
const issueTypes = [
  {
    id: 'pickup-access',
    title: 'Pickup access / delays',
    description: 'Gate locked, contact unreachable, long wait time.',
    icon: PinDrop,
    value: 'pickup-access',
  },
  {
    id: 'vehicle-condition',
    title: 'Vehicle condition concern',
    description: 'Damage observed, warning lights, unsafe to drive.',
    icon: Report,
    value: 'vehicle-condition',
  },
  {
    id: 'compliance-proof',
    title: 'Compliance proof problem',
    description: 'VIN last-4 mismatch, photo upload failing, odometer unclear.',
    icon: FactCheck,
    value: 'compliance-proof',
  },
  {
    id: 'dropoff-access',
    title: 'Drop-off access / delays',
    description: 'No parking, customer unavailable, address mismatch.',
    icon: Flag,
    value: 'dropoff-access',
  },
  {
    id: 'incident',
    title: 'Incident / safety',
    description: 'Accident, roadside assistance needed, personal safety.',
    icon: HealthAndSafety,
    value: 'incident',
  },
  {
    id: 'other',
    title: 'Other',
    description: 'Use description and attachments to explain.',
    icon: MoreHoriz,
    value: 'other',
  },
]

// Severity options
const severityOptions = [
  { value: 'low', label: 'Low (FYI)' },
  { value: 'medium', label: 'Medium (needs action)' },
  { value: 'high', label: 'High (blocks delivery)' },
  { value: 'critical', label: 'Critical (safety / incident)' },
]

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver/dashboard', label: 'Home', icon: Home },
  { href: '/driver/active', label: 'Active', icon: Car },
  { href: '/driver/inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver/menu', label: 'Menu', icon: Menu },
]

export default function DriverIssueReportPage() {
  const [mounted, setMounted] = useState(false)
  const [selectedIssueType, setSelectedIssueType] = useState('pickup-access')
  const [severity, setSeverity] = useState('high')
  const [location, setLocation] = useState('San Jose, CA')
  const [description, setDescription] = useState('')
  const [notifyAdmin, setNotifyAdmin] = useState(true)
  const [smsAlert, setSmsAlert] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
//   const params = useParams({ from: '/driver/issue-report/$deliveryId' })

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/dealer-signin?userType=driver' })
  }

  const handleSubmit = () => {
    // Validate required fields
    if (!description.trim()) {
      toast.error('Description required', {
        description: 'Please describe the issue you are experiencing.',
      })
      return
    }

    if (!location.trim()) {
      toast.error('Location required', {
        description: 'Please provide your current location.',
      })
      return
    }

    // Simulate submission
    toast.success('Report submitted', {
      description: 'Admin has been notified. You will receive updates via email.',
    })

    // Navigate back to active delivery
    setTimeout(() => {
      navigate({ to: '/driver-active' })
    }, 2000)
  }

  const handleCancel = () => {
    toast.info('Report cancelled', {
      description: 'Returning to active delivery.',
    })
    navigate({ to: '/driver-active' })
  }

  const handleAddAttachment = (type: string) => {
    setAttachments([...attachments, `${type}-${Date.now()}`])
    toast.success(`${type} added`, {
      description: `Your ${type.toLowerCase()} has been attached.`,
    })
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-active"
              className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Driver
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Report an Issue
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* Context card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-primary/15 rounded-full blur-3xl"></div>
          
          <CardContent className="relative z-10 p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
                  <Verified className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    CA MVP • Support Flow
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-4">
                  Issue report
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Use this form to notify Admin of problems during a delivery (compliance, vehicle condition, access issues, delays).
                  Notifications are <span className="font-extrabold">email-first</span> (SMS optional if enabled by policy).
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Delivery
                </div>
                <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                  {MOCK_DELIVERY.id}
                </div>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <LocalShipping className="w-4 h-4 text-primary" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    {MOCK_DELIVERY.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pickup</p>
                <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">{MOCK_DELIVERY.pickup.city}</p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{MOCK_DELIVERY.pickup.location}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Drop-off</p>
                <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">{MOCK_DELIVERY.dropoff.city}</p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{MOCK_DELIVERY.dropoff.location}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">SLA</p>
                <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">{MOCK_DELIVERY.sla}</p>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{MOCK_DELIVERY.slaDescription}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issue type */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Issue type</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Choose the closest match. This helps Admin route and resolve quickly (PRD-aligned disputes/support).
                </CardDescription>
              </div>
              <Badge variant="outline" className="chip bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200">
                <Info className="w-3.5 h-3.5 text-amber-500 mr-1" />
                Prototype
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedIssueType}
              onValueChange={setSelectedIssueType}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {issueTypes.map((issue) => (
                <Label
                  key={issue.id}
                  htmlFor={issue.id}
                  className="cursor-pointer"
                >
                  <div className="flex items-start gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition has-[:checked]:border-primary has-[:checked]:ring-4 has-[:checked]:ring-primary/15">
                    <RadioGroupItem
                      value={issue.value}
                      id={issue.id}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {issue.title}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        {issue.description}
                      </p>
                    </div>
                    <issue.icon className="w-5 h-5 text-primary shrink-0" />
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black">Details</CardTitle>
            <CardDescription className="text-sm mt-1">
              Provide a clear description. Admin may request more evidence or create a dispute case.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Severity
                </Label>
                <Select
                  value={severity}
                  onValueChange={setSeverity}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Current location
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="h-12 w-full pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                    placeholder="San Jose, CA"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  What happened?
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm p-4"
                  placeholder="Describe the issue, who you contacted, and what you need from Admin. Example: gate locked, dealer contact unreachable, waiting 25 minutes, request reschedule window or alternate contact."
                />
              </div>
            </div>

            {/* Attachments */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Attachments (optional)
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    Upload photos/screenshots as evidence (prototype). In production, files are time-stamped and linked to the delivery report.
                  </p>
                </div>
                <Paperclip className="w-5 h-5 text-primary shrink-0" />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddAttachment('Photo')}
                  className="py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-primary" />
                  Add photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddAttachment('Screenshot')}
                  className="py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
                >
                  <Image className="w-4 h-4 text-primary" />
                  Add screenshot
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddAttachment('Note')}
                  className="py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  Add note
                </Button>
              </div>

              {attachments.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Attached files:</p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, idx) => (
                      <Badge key={idx} variant="outline" className="chip bg-white dark:bg-slate-900">
                        <FileText className="w-3 h-3 text-primary mr-1" />
                        {att.split('-')[0]} {idx + 1}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notify */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">Notify Admin</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">Email-first (default)</div>
                  </div>
                </div>
                <Checkbox
                  checked={notifyAdmin}
                  onCheckedChange={(checked) => setNotifyAdmin(checked as boolean)}
                  className="h-5 w-5"
                />
              </Label>

              <Label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                <div className="flex items-center gap-3">
                  <Sms className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">SMS alert</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">Optional if policy allows</div>
                  </div>
                </div>
                <Checkbox
                  checked={smsAlert}
                  onCheckedChange={(checked) => setSmsAlert(checked as boolean)}
                  className="h-5 w-5"
                />
              </Label>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1 py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition inline-flex items-center justify-center gap-2"
              >
                Cancel
                <Close className="w-4 h-4 text-primary" />
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 py-4 rounded-2xl font-extrabold bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center justify-center gap-2"
              >
                Submit report
                <ArrowForward className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
              <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                Prototype UI. In production: all submissions are logged (who/when/where), linked to delivery status timeline, and may trigger a dispute workflow depending on policy.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                <item.icon className="w-5 h-5 mx-auto text-primary" />
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {item.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}