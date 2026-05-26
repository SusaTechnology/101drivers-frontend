// Admin Support List Page - View all support requests
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Headphones,
  Package,
  CreditCard,
  XCircle,
  Gavel,
  HelpCircle,
  Truck,
  Calendar,
  Search,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  User,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'
import { Navbar } from '@/components/shared/layout/testNavbar'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORIES_BY_ROLE,
  type SupportRequestListItem,
  type SupportRequestStatus,
  type SupportRequestPriority,
  type SupportRequestCategory,
  type SupportRequestActorRole,
} from '@/types/support'

// Category icons
const categoryIcons: Record<SupportRequestCategory, React.ReactNode> = {
  DELIVERY_ISSUE: <Package className="h-4 w-4" />,
  PAYMENT_ISSUE: <CreditCard className="h-4 w-4" />,
  SCHEDULE_CHANGE: <Calendar className="h-4 w-4" />,
  CANCELLATION_REQUEST: <XCircle className="h-4 w-4" />,
  DISPUTE_HELP: <Gavel className="h-4 w-4" />,
  DRIVER_ISSUE: <Truck className="h-4 w-4" />,
  GENERAL: <HelpCircle className="h-4 w-4" />,
}

// Category labels
const categoryLabels: Record<SupportRequestCategory, string> = {
  DELIVERY_ISSUE: 'Delivery Issue',
  PAYMENT_ISSUE: 'Payment Issue',
  SCHEDULE_CHANGE: 'Schedule Change',
  CANCELLATION_REQUEST: 'Cancellation Request',
  DISPUTE_HELP: 'Dispute Help',
  DRIVER_ISSUE: 'Driver Issue',
  GENERAL: 'General',
}

// Actor role labels
const actorRoleLabels: Record<SupportRequestActorRole, string> = {
  DEALER: 'Dealer',
  PRIVATE_CUSTOMER: 'Customer',
  DRIVER: 'Driver',
  ADMIN: 'Admin',
}

// Status colors
const statusColors: Record<SupportRequestStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
}

// Priority colors
const priorityColors: Record<SupportRequestPriority, string> = {
  LOW: 'text-slate-500',
  NORMAL: 'text-blue-500',
  HIGH: 'text-amber-500',
  URGENT: 'text-red-500',
}

export default function AdminSupportListPage() {
  const navigate = useNavigate()
  const { actionItems, signOut } = useAdminActions()
  const user = getUser()
  const adminId = user?.id

  // Filter state
  const [statusFilter, setStatusFilter] = useState<SupportRequestStatus | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<SupportRequestPriority | 'ALL'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<SupportRequestCategory | 'ALL'>('ALL')
  const [actorRoleFilter, setActorRoleFilter] = useState<SupportRequestActorRole | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Build query params
  const queryParams = new URLSearchParams()
  if (statusFilter !== 'ALL') queryParams.append('status', statusFilter)
  if (priorityFilter !== 'ALL') queryParams.append('priority', priorityFilter)
  if (categoryFilter !== 'ALL') queryParams.append('category', categoryFilter)
  if (actorRoleFilter !== 'ALL') queryParams.append('actorRole', actorRoleFilter)
  if (searchQuery) queryParams.append('search', searchQuery)

  // Fetch support requests
  const {
    data: supportData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useDataQuery<{ items: SupportRequestListItem[]; count: number }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests?${queryParams.toString()}`,
    noFilter: true,
  })

  const supportRequests = supportData?.items || []

  // Format date
  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Format time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Clear all filters
  const handleClearFilters = () => {
    setStatusFilter('ALL')
    setPriorityFilter('ALL')
    setCategoryFilter('ALL')
    setActorRoleFilter('ALL')
    setSearchQuery('')
  }

  const hasActiveFilters = statusFilter !== 'ALL' || priorityFilter !== 'ALL' || 
    categoryFilter !== 'ALL' || actorRoleFilter !== 'ALL' || searchQuery

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Support Requests"
      />

      <main className="w-full max-w-[1600px] mx-auto px-4 lg:px-5 py-4 lg:py-5">
        {/* Page Header */}
        <section className="mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <Headphones className="w-3 h-3 text-primary mr-1" />
                  Support Queue
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {supportData?.count ?? 0} total requests
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search requests..."
                    className="pl-9 h-9"
                  />
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                {/* Status */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SupportRequestStatus | 'ALL')}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Priority */}
                <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as SupportRequestPriority | 'ALL')}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Priorities</SelectItem>
                    {PRIORITY_OPTIONS.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Actor Role */}
                <Select value={actorRoleFilter} onValueChange={(v) => setActorRoleFilter(v as SupportRequestActorRole | 'ALL')}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="From" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Sources</SelectItem>
                    <SelectItem value="DEALER">Dealer</SelectItem>
                    <SelectItem value="DRIVER">Driver</SelectItem>
                    <SelectItem value="PRIVATE_CUSTOMER">Customer</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Request List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
            <CardContent className="p-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-200">Failed to load requests</p>
                <p className="text-sm text-red-600 dark:text-red-300">Please try again later.</p>
              </div>
            </CardContent>
          </Card>
        ) : supportRequests.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-10 text-center">
              <Headphones className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No support requests</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {hasActiveFilters
                  ? 'No requests match your filters. Try adjusting your search.'
                  : 'There are no support requests at this time.'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {supportRequests.map((request) => (
              <Link
                key={request.id}
                to="/admin-support-detail"
                state={{ id: request.id }}
                className="block"
              >
                <Card className="border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-md transition cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Category Icon */}
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary shrink-0">
                          {categoryIcons[request.category]}
                        </div>

                        {/* Subject & Meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {request.subject}
                            </p>
                            {request.priority === 'URGENT' && (
                              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">URGENT</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium">{categoryLabels[request.category]}</span>
                            {request.deliveryId && (
                              <>
                                <span>•</span>
                                <span>Delivery #{request.deliveryId.slice(-6).toUpperCase()}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{formatDate(request.createdAt)} {formatTime(request.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {request.actorRole}
                        </Badge>
                        <Badge className={cn("text-xs font-medium border", statusColors[request.status])}>
                          {request.status.replace('_', ' ')}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-8 pb-8">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-slate-200">
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
