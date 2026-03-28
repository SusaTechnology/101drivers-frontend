// Dealer Support Request Page
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Menu,
  X,
  Headphones,
  Send,
  AlertCircle,
  CheckCircle,
  Package,
  CreditCard,
  XCircle,
  Gavel,
  HelpCircle,
  Clock,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import {
  CATEGORIES_BY_ROLE,
  PRIORITY_OPTIONS,
  type SupportRequestCategory,
  type SupportRequestPriority,
  type CreateSupportRequestPayload,
  type CreateSupportRequestResponse,
} from '@/types/support'

// Category icons
const categoryIcons: Record<SupportRequestCategory, React.ReactNode> = {
  DELIVERY_ISSUE: <Package className="h-4 w-4" />,
  PAYMENT_ISSUE: <CreditCard className="h-4 w-4" />,
  SCHEDULE_CHANGE: <Clock className="h-4 w-4" />,
  CANCELLATION_REQUEST: <XCircle className="h-4 w-4" />,
  DISPUTE_HELP: <Gavel className="h-4 w-4" />,
  DRIVER_ISSUE: <Truck className="h-4 w-4" />,
  GENERAL: <HelpCircle className="h-4 w-4" />,
}

export default function DealerSupportRequest() {
  const { state } = useLocation()
  const deliveryId = state?.deliveryId || state?.id || ''
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const user = getUser()
  const dealerId = user?.profileId

  // Form state
  const [category, setCategory] = useState<SupportRequestCategory>('DELIVERY_ISSUE')
  const [priority, setPriority] = useState<SupportRequestPriority>('NORMAL')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  // Determine customer type for UI display
  const isPrivateCustomer = user?.userType === 'PRIVATE_CUSTOMER'

  // Get categories for current role (for UI dropdown)
  const categories = isPrivateCustomer ? CATEGORIES_BY_ROLE.PRIVATE_CUSTOMER : CATEGORIES_BY_ROLE.DEALER

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
        toast.success('Support request created', {
          description: 'We will get back to you shortly.',
        })
        // Navigate to support detail or list
        navigate({ to: '/dealer-support-detail', state: { id: data.id } })
      },
      onError: (error: any) => {
        toast.error('Failed to create support request', {
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

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/dealer-signin?userType=dealer' })
  }

  const handleSubmit = () => {
    // Validation
    if (!subject.trim()) {
      toast.error('Subject required', { description: 'Please enter a subject.' })
      return
    }
    if (!message.trim()) {
      toast.error('Message required', { description: 'Please describe your issue.' })
      return
    }

    const payload: CreateSupportRequestPayload = {
      deliveryId: deliveryId || undefined,
      category,
      priority,
      subject: subject.trim(),
      message: message.trim(),
    }

    createSupportMutation.mutate(payload)
  }

  const handleCancel = () => {
    if (deliveryId) {
      navigate({ to: '/dealer-delivery-details', state: { id: deliveryId } })
    } else {
      navigate({ to: '/dealer-dashboard' })
    }
  }

  // Header
  const Header = () => (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center" aria-label="101 Drivers">
            <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
              <img
                src="/assets/101drivers-logo.jpg"
                alt="101 Drivers"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              {isPrivateCustomer ? 'Customer Portal' : 'Dealer Portal'}
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              Contact Operations
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dealer-dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-lime-500 transition-colors px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-3">
            <Link
              to="/dealer-dashboard"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dealer-support-list"
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              My Support Requests
            </Link>
            <Separator className="my-2" />
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-lime-500 transition-colors"
            >
              {mounted && theme === 'dark' ? (
                <>
                  <div className="w-4 h-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <div className="w-4 h-4" />
                  Dark Mode
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </header>
  )

  // Footer
  const Footer = () => (
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
              California-only operations • Email-first notifications
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium">© {new Date().getFullYear()} 101 Drivers Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <main className="w-full max-w-[800px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        {/* Page header */}
        <section className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-lime-500/15 flex items-center justify-center shrink-0">
            <Headphones className="h-7 w-7 text-lime-500" />
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              Contact Operations
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Need help with a delivery, payment, or have a question? Submit a support request and our team will get back to you.
            </p>
          </div>
        </section>

        {/* Delivery context (if applicable) */}
        {deliveryId && deliveryData && (
          <Card className="border-slate-200 dark:border-slate-800 rounded-3xl mb-6">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Related Delivery</div>
                  <div className="font-black text-slate-900 dark:text-white mt-1">
                    #{deliveryData.id?.slice(-6).toUpperCase()}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {deliveryData.pickupAddress?.split(',')[0]} → {deliveryData.dropoffAddress?.split(',')[0]}
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  {deliveryData.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support form */}
        <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
          <CardHeader>
            <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
              Support Request Form
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Category
              </Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SupportRequestCategory)}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        {categoryIcons[cat.value]}
                        <div>
                          <div className="font-bold">{cat.label}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">
                {categories.find(c => c.value === category)?.description}
              </p>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Priority
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as SupportRequestPriority)}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          opt.color === 'red' && "bg-red-500",
                          opt.color === 'amber' && "bg-amber-500",
                          opt.color === 'blue' && "bg-blue-500",
                          opt.color === 'slate' && "bg-slate-400",
                        )} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Subject
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="h-12 rounded-2xl"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Message
              </Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue in detail. Include any relevant information that will help us assist you."
                rows={5}
                className="rounded-2xl"
              />
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1 py-4 rounded-2xl font-extrabold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createSupportMutation.isPending || !subject.trim() || !message.trim()}
                className="flex-1 py-4 rounded-2xl bg-lime-500 text-slate-950 hover:bg-lime-600 font-extrabold gap-2"
              >
                {createSupportMutation.isPending ? 'Submitting...' : 'Submit Request'}
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Info note */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-normal">
                <span className="font-bold">Response time:</span> Our team typically responds within 2-4 hours during business hours. For urgent issues, your request will be prioritized.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            to="/dealer-support-list"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-extrabold"
          >
            <CheckCircle className="h-4 w-4 text-lime-500" />
            View My Support Requests
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
