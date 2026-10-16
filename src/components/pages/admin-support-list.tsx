// Admin Support List Page - View all support requests
//
// Ops queue behaviors:
//  - SERVER-SIDE PAGINATION — page + per-page (10/20/50/100) are sent as
//    take/skip; the server returns { items, count } and the pager renders
//    from count. keepPreviousData keeps the current rows on screen during
//    a page/filter change (dimmed while fetching) instead of flashing
//    skeletons.
//  - UNREAD FIRST — the SERVER orders the queue: tickets with unseen
//    customer activity (same rule as the red dot) always sort above read
//    ones, then by most recent activity. The sort cannot drift from the
//    dots because both are the same server-side rule.
//  - SEARCH + filters are server-side (status / priority / source /
//    free-text search across subject, message, requester, delivery id).
//  - NO LAYOUT JUMPS — html has scrollbar-gutter: stable (styles.css) so a
//    shorter result list never shifts the page sideways, and the Clear
//    button is always mounted (invisible when inactive) so the filter row
//    never reflows when it appears.
//  - STICKY-ON-SCROLL-UP — scrolling DOWN lets the filter card travel with
//    the content; the moment the admin scrolls UP past the card's natural
//    position, it docks under the navbar (shadow + full width) so filters
//    are reachable from anywhere in the list without scrolling all the way
//    home. Scroll down again (or reach the card's natural spot) and it
//    undocks back into the flow.
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useDataQuery } from '@/lib/tanstack/dataQuery'
import { useQueryClient } from '@tanstack/react-query'
import { useSocketEvent } from '@/hooks/useSocket'
import { socketJoinStaffOps, socketLeaveStaffOps } from '@/lib/socket'
import { Navbar } from '@/components/shared/layout/testNavbar'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
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

// Status colors
const statusColors: Record<SupportRequestStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100]
const SEARCH_DEBOUNCE_MS = 350

export default function AdminSupportListPage() {
  const { actionItems, signOut } = useAdminActions()
  const user = getUser()
  const queryClient = useQueryClient()

  // Real-time list refresh: any activity pushed to a conversation this
  // admin participates in reorders rows. Scoped to supportRequests URLs so
  // unrelated cached queries are untouched.
  useSocketEvent('support:inbox', () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[1] === 'string' &&
        q.queryKey[1].includes('/supportRequests/'),
    })
  })

  // Live ops queue (ALL tickets): support:inbox only ever reaches a
  // ticket's OWNER. The backend pings the admin-only staff:ops room
  // (contentless support:staff-inbox) when a NEW ticket is created or a
  // CUSTOMER replies, so the ops list re-sorts live — and the unread-first
  // ordering floats the fresh ticket to the top. The message text still
  // only shows after opening the ticket (conversation privacy).
  useSocketEvent('support:staff-inbox', () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[1] === 'string' &&
        q.queryKey[1].includes('/supportRequests/'),
    })
  })

  // Join the staff ops room for the lifetime of this page; leave on unmount
  // so non-admin pages never keep the room alive. (Reference-counted in
  // socket.ts — the navbar SupportNavBadge shares this room.)
  useEffect(() => {
    socketJoinStaffOps()
    return () => socketLeaveStaffOps()
  }, [])

  // Filter state
  const [statusFilter, setStatusFilter] = useState<SupportRequestStatus | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<SupportRequestPriority | 'ALL'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<SupportRequestCategory | 'ALL'>('ALL')
  const [actorRoleFilter, setActorRoleFilter] = useState<SupportRequestActorRole | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  // Debounced search: keystrokes update the input instantly; the server
  // query only chases the settled value. (Without this, every letter was a
  // new API request — 8-letter word = 8 queries.)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Pagination state — server-side (take/skip), per-page admin-selectable.
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  // Any filter change lands the admin back on page 1 — a filtered result
  // set has no meaningful "page 3 of the old list".
  useEffect(() => {
    setPage(1)
  }, [statusFilter, priorityFilter, categoryFilter, actorRoleFilter, debouncedSearch])

  // Build query params
  const queryParams = new URLSearchParams()
  if (statusFilter !== 'ALL') queryParams.append('status', statusFilter)
  if (priorityFilter !== 'ALL') queryParams.append('priority', priorityFilter)
  if (categoryFilter !== 'ALL') queryParams.append('category', categoryFilter)
  if (actorRoleFilter !== 'ALL') queryParams.append('actorRole', actorRoleFilter)
  if (debouncedSearch) queryParams.append('search', debouncedSearch)
  queryParams.append('take', String(perPage))
  queryParams.append('skip', String((page - 1) * perPage))

  // Fetch support requests — uses the /admin endpoint which returns
  // { items: [...], count: N } (the base /supportRequests endpoint returns
  // a raw array, not wrapped, so items would be undefined).
  const {
    data: supportData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useDataQuery<{ items: SupportRequestListItem[]; count: number }>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/supportRequests/admin?${queryParams.toString()}`,
    noFilter: true,
  })

  const supportRequests = supportData?.items || []
  const totalCount = supportData?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))

  // Clamp the page if the result set shrank under us (tickets resolved,
  // filters tightened elsewhere): never strand the admin on an empty page.
  useEffect(() => {
    if (!isLoading && supportData && page > totalPages) {
      setPage(totalPages)
    }
  }, [supportData, isLoading, page, totalPages, perPage])

  const handlePageChange = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, next), totalPages)
      if (clamped === page) return
      setPage(clamped)
      // Pager lives below a long list — jump home so the fresh rows are
      // actually visible (the navbar arrives with them).
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [page, totalPages]
  )

  // ── Sticky-on-scroll-up filter dock ──
  // The filter card lives in normal flow. A scroll listener watches
  // DIRECTION: scrolling up past the card's natural position docks it
  // under the sticky navbar; scrolling down (or arriving back at its
  // natural position) undocks it. A spacer keeps the page height identical
  // in both states so docking never jolts the scroll offset.
  const filtersRef = useRef<HTMLDivElement>(null)
  const [filtersDocked, setFiltersDocked] = useState(false)
  const lastScrollYRef = useRef(0)
  const filtersTopRef = useRef(Number.POSITIVE_INFINITY)
  const filtersHeightRef = useRef(0)

  useEffect(() => {
    const measure = () => {
      const el = filtersRef.current
      if (!el) return
      // The OUTER div always occupies the natural flow position (while
      // docked, the spacer keeps its height), so its rect is the card's
      // natural resting spot in both states.
      const rect = el.getBoundingClientRect()
      filtersTopRef.current = rect.top + window.scrollY
      filtersHeightRef.current = rect.height
    }
    measure()
    const t = window.setTimeout(measure, 400) // after fonts/layout settle
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const prev = lastScrollYRef.current
      lastScrollYRef.current = y
      if (y === prev) return
      const goingUp = y < prev
      // h-16 (mobile) / lg:h-20 (desktop) sticky navbar offset.
      const headerH = window.innerWidth >= 1024 ? 80 : 64
      const cardPassedUnderHeader = y + headerH >= filtersTopRef.current

      setFiltersDocked((wasDocked) => {
        if (goingUp) {
          // Scrolling up with the card already above the header → dock;
          // still below its natural position → it is visible anyway.
          return cardPassedUnderHeader;
        }
        // Scrolling down → the card scrolls with the content (undock).
        return false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    actorRoleFilter !== 'ALL' ||
    debouncedSearch !== ''

  // The filter form — rendered ONCE; the dock effect repositions this very
  // node (never a duplicate), so there is exactly one set of controls.
  const filterCard = (
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
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as SupportRequestStatus | 'ALL')}
          >
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
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as SupportRequestPriority | 'ALL')}
          >
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

          {/* Category — the ops queue spans every role, so this offers the
              full flat category set (the per-role variants live on the
              user-facing request forms). */}
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as SupportRequestCategory | 'ALL')}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {(Object.keys(categoryLabels) as SupportRequestCategory[]).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Actor Role */}
          <Select
            value={actorRoleFilter}
            onValueChange={(v) => setActorRoleFilter(v as SupportRequestActorRole | 'ALL')}
          >
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

          {/* Clear filters — ALWAYS mounted so the row never reflows when
              it appears/disappears (invisible = keeps its space, disabled =
              cannot be clicked). */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className={cn(
              'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 ml-auto',
              !hasActiveFilters && 'invisible'
            )}
            tabIndex={hasActiveFilters ? 0 : -1}
            aria-hidden={!hasActiveFilters}
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  )

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
                {totalCount} total {totalCount === 1 ? 'request' : 'requests'}
                <span className="hidden sm:inline text-slate-400">
                  {' '}
                  · unread always on top
                </span>
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
                <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        {/* Filters — one node; docks under the navbar while scrolling up */}
        <div
          ref={filtersRef}
          style={filtersDocked ? { height: filtersHeightRef.current } : undefined}
          className="relative mb-4"
        >
          <div
            className={cn(
              filtersDocked &&
                'fixed inset-x-0 top-16 lg:top-20 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-lg py-3 transition-shadow'
            )}
          >
            <div className="max-w-[1600px] mx-auto px-4 lg:px-5">{filterCard}</div>
          </div>
        </div>

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
                <Button variant="outline" onClick={handleClearFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={cn('space-y-2 transition-opacity', isFetching && 'opacity-60')}>
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
                            {/* Unread red dot — non-admin activity newer than
                                the staff read receipt (adminReadAt). Cleared
                                when an admin opens the ticket. */}
                            {request.unreadForAdmin && (
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                                title="New messages not seen by our team yet"
                              />
                            )}
                            <p
                              className={cn(
                                'truncate',
                                request.unreadForAdmin
                                  ? 'font-extrabold text-slate-900 dark:text-white'
                                  : 'font-bold text-slate-900 dark:text-white'
                              )}
                            >
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
                        {/* "N new" chip — number of messages the team has
                            not seen yet on this ticket. */}
                        {request.unreadForAdmin &&
                          (request.unreadMessages ?? 0) > 0 && (
                            <Badge className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0 gap-1">
                              {request.unreadMessages === 1
                                ? '1 new'
                                : `${request.unreadMessages} new`}
                            </Badge>
                          )}
                        <Badge variant="outline" className="text-xs">
                          {request.actorRole}
                        </Badge>
                        <Badge className={cn('text-xs font-medium border', statusColors[request.status])}>
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

        {/* Pagination — server-side; per-page selectable; Prev/Next. */}
        {!isLoading && !error && totalCount > 0 && (
          <nav
            aria-label="Support list pagination"
            className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1">
              Showing{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, totalCount)}
              </span>{' '}
              of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{totalCount}</span>
            </p>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Select
                value={String(perPage)}
                onValueChange={(v) => {
                  setPerPage(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[118px] h-8 text-xs" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </Button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums min-w-[70px] text-center">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </nav>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-8 pb-8 mt-10">
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
              © 2026 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
