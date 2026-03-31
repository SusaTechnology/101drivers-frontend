// Driver Issue Report Page - Updated with real API
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Sun,
  Moon,
  Info,
  Verified,
  Truck,
  MapPin,
  Flag,
  FileText,
  ShieldCheck,
  MoreHorizontal,
  Mail,
  MessageSquare,
  Home,
  Car,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  Upload,
  Image,
  Paperclip,
  Send,
  Inbox,
  Menu,
  X,
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import {
  CATEGORIES_BY_ROLE,
  PRIORITY_OPTIONS,
  type SupportRequestCategory,
  type SupportRequestPriority,
  type CreateSupportRequestPayload,
  type CreateSupportRequestResponse,
} from '@/types/support'

// Issue types for drivers (mapped to categories)
const issueTypes = [
  {
    id: 'delivery-issue',
    title: 'Delivery issue',
    description: 'Access problems, customer unavailable, address issues.',
    icon: Truck,
    value: 'DELIVERY_ISSUE' as SupportRequestCategory,
  },
  {
    id: 'schedule-change',
    title: 'Schedule change request',
    description: 'Need to change pickup or dropoff time window.',
    icon: Calendar,
    value: 'SCHEDULE_CHANGE' as SupportRequestCategory,
  },
  {
    id: 'driver-issue',
    title: 'Driver issue',
    description: 'Vehicle issue, traffic delay, personal emergency.',
    icon: FileText,
    value: 'DRIVER_ISSUE' as SupportRequestCategory,
  },
  {
    id: 'general',
    title: 'General',
    description: 'Other issues or questions.',
    icon: MoreHorizontal,
    value: 'GENERAL' as SupportRequestCategory,
  },
]

// Priority options for drivers
const priorityOptions = [
  { value: 'LOW', label: 'Low (FYI)' },
  { value: 'NORMAL', label: 'Normal (needs attention)' },
  { value: 'HIGH', label: 'High (blocks delivery)' },
  { value: 'URGENT', label: 'Urgent (safety / emergency)' },
]

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Home },
  { href: '/driver-active', label: 'Active', icon: Car },
  { href: '/driver-inbox', label: 'Inbox', icon: Inbox },
  { href: '/driver-menu', label: 'Menu', icon: Menu },
]

export default function DriverIssueReportPage() {
  const { state } = useLocation()
  const deliveryId = state?.deliveryId || state?.id || ''
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const driverId = user?.profileId

  // Form state
  const [selectedIssueType, setSelectedIssueType] = useState<SupportRequestCategory>('DELIVERY_ISSUE')
  const [priority, setPriority] = useState<SupportRequestPriority>('NORMAL')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])

  // Fetch delivery details if deliveryId is provided
  const {
    data: deliveryData,
    isLoading: deliveryLoading,
  } = useDataQuery({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/${deliveryId}`,
    noFilter: true,
    enabled: !!deliveryId,
  })

  // Create support request mutation
  const createSupportMutation = useCreate<CreateSupportRequestPayload, CreateSupportRequestResponse>(
    `${import.meta.env.VITE_API_URL}/api/supportRequests/contact`,
    {
      onSuccess: (data) => {
        toast.success('Report submitted', {
          description: 'Operations team has been notified. Check your inbox for updates.',
        })
        // Navigate back to active delivery or support detail
        setTimeout(() => {
          navigate({ to: '/driver-active' })
        }, 2000)
      },
      onError: (error: any) => {
        toast.error('Failed to submit report', {
          description: error.message || 'Please try again.',
        })
      },
    }
  )

  // Theme handling
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSubmit = () => {
    // Validate required fields
    if (!subject.trim()) {
      toast.error('Subject required', {
        description: 'Please enter a brief subject for your issue.',
      })
      return
    }

    if (!description.trim()) {
      toast.error('Description required', {
        description: 'Please describe the issue you are experiencing.',
      })
      return
    }

    const payload: CreateSupportRequestPayload = {
      deliveryId: deliveryId || undefined,
      category: selectedIssueType,
      priority,
      subject: subject.trim(),
      message: description.trim(),
    }

    createSupportMutation.mutate(payload)
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

  // Determine delivery context
  const delivery = deliveryData ? {
    id: deliveryData.id,
    status: deliveryData.status,
    pickup: {
      city: deliveryData.pickupAddress?.split(',')[0] || 'Pickup',
      location: deliveryData.pickupAddress || '',
    },
    dropoff: {
      city: deliveryData.dropoffAddress?.split(',')[0] || 'Dropoff',
      location: deliveryData.dropoffAddress || '',
    },
  } : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
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
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-lime-500/15 rounded-full blur-3xl"></div>
          
          <CardContent className="relative z-10 p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime-500/10 text-slate-900 border border-lime-500/25 w-fit">
                  <Verified className="w-3.5 h-3.5 text-lime-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Driver Portal • Support
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-4">
                  Issue report
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Use this form to notify Operations of problems during a delivery (access issues, delays, vehicle problems).
                  Notifications are <span className="font-extrabold">email-first</span>.
                </p>
              </div>

              {delivery && (
                <div className="text-left sm:text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Delivery
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                    #{delivery.id?.slice(-6).toUpperCase()}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <Truck className="w-4 h-4 text-lime-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      {delivery.status}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {delivery && (
              <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pickup</p>
                  <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">{delivery.pickup.city}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Drop-off</p>
                  <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">{delivery.dropoff.city}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Issue type */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Issue type</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Choose the closest match. This helps Operations route and resolve quickly.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedIssueType}
              onValueChange={(v) => setSelectedIssueType(v as SupportRequestCategory)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {issueTypes.map((issue) => (
                <Label
                  key={issue.id}
                  htmlFor={issue.id}
                  className="cursor-pointer"
                >
                  <div className={cn(
                    "flex items-start gap-4 p-4 rounded-2xl border transition",
                    selectedIssueType === issue.value
                      ? "border-lime-500 ring-4 ring-lime-500/15 bg-lime-50/50 dark:bg-lime-900/10"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}>
                    <RadioGroupItem
                      value={issue.value}
                      id={issue.id}
                      className="sr-only"
                    />
                    <issue.icon className={cn(
                      "w-5 h-5 shrink-0",
                      selectedIssueType === issue.value ? "text-lime-500" : "text-slate-400"
                    )} />
                    <div className="flex-1">
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {issue.title}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        {issue.description}
                      </p>
                    </div>
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
              Provide a clear description. Operations may request more evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Priority
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as SupportRequestPriority)}
              >
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Subject
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
                className="h-12 rounded-2xl"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                What happened?
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm p-4"
                placeholder="Describe the issue in detail. Example: Gate locked, dealer contact unreachable, waiting 25 minutes, need alternate contact."
              />
            </div>

            {/* Attachments */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Attachments (optional)
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    Upload photos/screenshots as evidence.
                  </p>
                </div>
                <Paperclip className="w-5 h-5 text-lime-500 shrink-0" />
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddAttachment('Photo')}
                  className="py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-lime-50 transition inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 w-4 text-lime-500" />
                  Add photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddAttachment('Screenshot')}
                  className="py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-lime-50 transition inline-flex items-center justify-center gap-2"
                >
                  <Image className="w-4 h-4 text-lime-500" />
                  Add screenshot
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAddAttachment('Note')}
                  className="py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-lime-50 transition inline-flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-lime-500" />
                  Add note
                </Button>
              </div>

              {attachments.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Attached files:</p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, idx) => (
                      <Badge key={idx} variant="outline" className="bg-white dark:bg-slate-900">
                        <FileText className="w-3 h-3 text-lime-500 mr-1" />
                        {att.split('-')[0]} {idx + 1}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1 py-4 rounded-2xl font-extrabold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition inline-flex items-center justify-center gap-2"
              >
                Cancel
                <X className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createSupportMutation.isPending || !subject.trim() || !description.trim()}
                className="flex-1 py-4 rounded-2xl font-extrabold bg-lime-500 text-slate-950 hover:shadow-xl hover:shadow-lime-500/20 transition inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {createSupportMutation.isPending ? 'Submitting...' : 'Submit report'}
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
              <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal font-medium">
                All submissions are logged (who/when/where), linked to delivery status timeline, and reviewed by Operations.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-[900px] mx-auto px-5 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                <item.icon className="w-5 h-5 mx-auto text-lime-500" />
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
