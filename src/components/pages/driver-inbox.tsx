// app/pages/driver/inbox.tsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Search,
  Mail,
  Inbox as InboxIcon,
  Truck as LocalShipping,
  FileCheck as FactCheck,
  Calendar,
  Shield as Security,
  Headset as SupportAgent,
  Phone,
  MailCheck as MarkEmailRead,
  ArrowRight as ArrowForward,
  LayoutDashboard as Dashboard,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Mock inbox messages
const MOCK_MESSAGES = {
  unreadCount: 1,
  messages: [
    {
      id: 1,
      type: 'Delivery update',
      typeIcon: LocalShipping,
      typeColor: 'primary',
      deliveryId: 'DLV-20418',
      title: 'Delivery status changed: Active',
      description: 'You are currently on-route. Remember: capture odometer + photo evidence at drop-off.',
      route: 'San Jose → Los Angeles',
      time: '12 min ago',
      unread: true,
      link: '/driver-active',
    },
    {
      id: 2,
      type: 'Compliance',
      typeIcon: FactCheck,
      typeColor: 'amber',
      deliveryId: 'DLV-20377',
      title: 'Missing evidence: pickup photo set',
      description: 'Please re-open pickup checklist and upload required photos. This delivery cannot complete without proof.',
      route: 'Policy reminder',
      time: '2 hours ago',
      unread: false,
      link: '/driver-pickup-checklist',
    },
    {
      id: 3,
      type: 'Scheduling',
      typeIcon: Calendar,
      typeColor: 'slate',
      deliveryId: 'DLV-20502',
      title: 'Time window updated',
      description: 'Dealer requested a later drop-off window. Review job details and confirm availability.',
      route: 'New window: 3pm–6pm',
      time: 'Yesterday',
      unread: false,
      link: '/driver-job-details',
    },
    {
      id: 4,
      type: 'System',
      typeIcon: Security,
      typeColor: 'slate',
      deliveryId: '',
      title: 'Security reminder',
      description: 'Never share your verification codes. Sign out on shared devices.',
      route: '',
      time: '3 days ago',
      unread: false,
      link: '',
    },
  ],
}

// Filter options
const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'delivery', label: 'Delivery updates' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'system', label: 'System' },
]

// Tab options
const tabOptions = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'system', label: 'System' },
]

// Bottom navigation items
const bottomNavItems = [
  { href: '/driver-dashboard', label: 'Home', icon: Dashboard },
  { href: '/driver-active', label: 'Active', icon: LocalShipping },
  { href: '/driver-inbox', label: 'Inbox', icon: InboxIcon, active: true },
  { href: '/auth/dealer-signin?userType=driver', label: 'Sign out', icon: LogOut },
]

export default function DriverInboxPage() {
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [activeTab, setActiveTab] = useState('all')
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

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

  const handleMarkAllRead = () => {
    toast.success('All messages marked as read', {
      description: 'Your inbox has been cleared.',
    })
  }

  const handleMessageClick = (message: typeof MOCK_MESSAGES.messages[0]) => {
    if (message.link) {
      navigate({ to: message.link })
    } else {
      toast.info('System message', {
        description: message.description,
      })
    }
  }

  const handleContactSupport = () => {
    toast.info('Contacting support', {
      description: 'Support will reach out shortly.',
    })
  }

  const handleGoToActiveDelivery = () => {
    navigate({ to: '/driver-active' })
  }

  // Filter messages based on search, filter type, and active tab
  const filteredMessages = MOCK_MESSAGES.messages.filter(message => {
    // Search filter
    if (searchQuery && !message.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !message.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !message.deliveryId.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    // Tab filter
    if (activeTab === 'unread' && !message.unread) return false
    if (activeTab === 'compliance' && message.type !== 'Compliance') return false
    if (activeTab === 'scheduling' && message.type !== 'Scheduling') return false
    if (activeTab === 'system' && message.type !== 'System') return false

    // Type filter
    if (filterType === 'unread' && !message.unread) return false
    if (filterType === 'delivery' && message.type !== 'Delivery update') return false
    if (filterType === 'compliance' && message.type !== 'Compliance') return false
    if (filterType === 'scheduling' && message.type !== 'Scheduling') return false
    if (filterType === 'system' && message.type !== 'System') return false

    return true
  })

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/driver-dashboard"
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
                Inbox
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
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

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-5 sm:px-6 py-6 pb-28 space-y-6">
        {/* Title / Filters */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-slate-900 border border-primary/25 w-fit">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    Email-first notifications
                  </span>
                </div>

                <h1 className="mt-4 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Messages & alerts
                </h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
                  Delivery updates, requests for proof re-upload, scheduling changes, and policy reminders.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 w-full sm:w-72 pl-12 pr-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                    placeholder="Search delivery ID, keyword..."
                  />
                </div>

                <Select
                  value={filterType}
                  onValueChange={setFilterType}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm min-w-[140px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              {tabOptions.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition",
                    activeTab === tab.id
                      ? "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                >
                  {tab.label}
                  {tab.id === 'unread' && MOCK_MESSAGES.unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-slate-950 text-[10px] font-black">
                      {MOCK_MESSAGES.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inbox List */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-black">Inbox</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Tap a message to open the related delivery or checklist.
                </CardDescription>
              </div>

              <Button
                onClick={handleMarkAllRead}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
              >
                <MarkEmailRead className="w-4 h-4" />
                Mark all read
              </Button>
            </div>
          </CardHeader>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className="w-full text-left p-6 sm:p-7 hover:bg-slate-50 dark:hover:bg-slate-950 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                        message.typeColor === 'primary' && "bg-primary/15",
                        message.typeColor === 'amber' && "bg-amber-500/15",
                        message.typeColor === 'slate' && "bg-slate-900/10 dark:bg-white/10"
                      )}>
                        <message.typeIcon className={cn(
                          "w-5 h-5",
                          message.typeColor === 'amber' && "text-amber-600",
                          message.typeColor !== 'amber' && "text-primary"
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {message.unread && (
                            <Badge variant="outline" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                              <span className="w-2 h-2 rounded-full bg-primary" />
                              Unread
                            </Badge>
                          )}
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                            {message.type}
                          </span>
                          {message.deliveryId && (
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                              {message.deliveryId}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                          {message.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {message.description}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {message.route && (
                            <>
                              <span>{message.route}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                            </>
                          )}
                          <span>{message.time}</span>
                        </div>
                      </div>
                    </div>

                    <ArrowForward className={cn(
                      "w-5 h-5 shrink-0",
                      message.typeColor === 'amber' ? "text-amber-600" : "text-primary"
                    )} />
                  </div>
                </button>
              ))
            ) : (
              <div className="p-12 text-center">
                <InboxIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  No messages found
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Try adjusting your filters or search query
                </p>
              </div>
            )}
          </div>

          <CardContent className="p-6 sm:p-7 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Prototype inbox. In production, notifications follow Admin policy (email-first; SMS optional if enabled) and messages link directly to
              deliveries, checklists, or disputes.
            </p>
          </CardContent>
        </Card>

        {/* Help / policy */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <SupportAgent className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Need help?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  If you can't complete a checklist due to access issues, contact support and document what happened.
                </p>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleGoToActiveDelivery}
                    variant="outline"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                  >
                    Go to Active Delivery
                    <ArrowForward className="w-4 h-4 text-primary" />
                  </Button>

                  <Button
                    onClick={handleContactSupport}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition"
                  >
                    <Phone className="w-4 h-4" />
                    Contact Support
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 safe-bottom">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "py-2 rounded-2xl transition flex flex-col items-center",
                  item.active 
                    ? "bg-slate-50 dark:bg-slate-900" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                )}
              >
                <div className="w-10 h-10 mx-auto rounded-2xl flex items-center justify-center">
                  <item.icon className={cn(
                    "w-5 h-5",
                    item.active ? "text-primary" : "text-primary"
                  )} />
                </div>
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  item.active 
                    ? "text-slate-900 dark:text-white" 
                    : "text-slate-500 dark:text-slate-400"
                )}>
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