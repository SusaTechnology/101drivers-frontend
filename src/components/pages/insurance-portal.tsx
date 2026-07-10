//@ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Shield,
  Lock,
  Loader2,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Truck,
  Calendar,
  MapPin,
  Navigation,
  Clock,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ExportDialog from '@/components/shared/ExportDialog'
import { useDataQuery, useCreate } from '@/lib/tanstack/dataQuery'
import { formatReportDate, formatReportMiles } from '@/hooks/useAdminReports'
import { BUSINESS_TZ } from '@/lib/timezone'

const API_BASE = import.meta.env.VITE_API_URL

interface InsuranceRow {
  id: string
  deliveryId: string
  status: string
  startedAt: string | null
  stoppedAt: string | null
  drivenMiles: number | null
  drivenHours: number | null
  createdAt: string
  delivery: {
    id: string
    status: string
    serviceType: string
    pickupAddress?: string
    dropoffAddress?: string
    customer?: { businessName?: string; user?: { fullName?: string } }
  }
  assignedDriver?: { id: string; user?: { fullName?: string } } | null
}

interface InsuranceData {
  rows: InsuranceRow[]
  summary: {
    totalTrackingSessions: number
    totalDrivenMiles: number
    averageMilesPerTrip: number
    totalDrivenHours: number
    averageDrivenHoursPerTrip: number
    startedCount: number
    stoppedCount: number
  }
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
}

export default function InsurancePortalPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Report filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [exportOpen, setExportOpen] = useState(false)

  // Check for existing session on mount
  useEffect(() => {
    const token = sessionStorage.getItem('insurancePortalToken')
    if (token) {
      setAuthenticated(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoggingIn(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/insurance-portal-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.message || 'Invalid password')
      }

      const data = await response.json()
      if (data.accessToken) {
        sessionStorage.setItem('insurancePortalToken', data.accessToken)
        setAuthenticated(true)
        toast.success('Welcome to the Insurance Portal')
      }
    } catch (error: any) {
      toast.error('Login failed', { description: error?.message || 'Please try again' })
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('insurancePortalToken')
    setAuthenticated(false)
    setPassword('')
  }

  // ── Password Gate ──
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black mx-auto mb-3 border border-slate-200">
              <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Insurance Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your password to access mileage reports</p>
          </div>

          <Card className="border-slate-200 dark:border-slate-800 shadow-xl">
            <CardContent className="p-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Portal Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="h-12 pl-11 rounded-xl text-sm"
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={!password || loggingIn}
                  className="w-full h-12 lime-btn rounded-xl font-extrabold"
                >
                  {loggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Access Portal
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-slate-400 mt-6">
            Authorized personnel only. Contact your 101 Drivers account manager for access.
          </p>
        </div>
      </div>
    )
  }

  // ── Report View ──
  return <ReportView
    onLogout={handleLogout}
    dateFrom={dateFrom} setDateFrom={setDateFrom}
    dateTo={dateTo} setDateTo={setDateTo}
    statusFilter={statusFilter} setStatusFilter={setStatusFilter}
    page={page} setPage={setPage}
    pageSize={pageSize}
    exportOpen={exportOpen} setExportOpen={setExportOpen}
  />
}

// ════════════════════════════════════════════════════════════════════════
// Report View Component
// ════════════════════════════════════════════════════════════════════════

function ReportView({
  onLogout,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  statusFilter, setStatusFilter,
  page, setPage,
  pageSize,
  exportOpen, setExportOpen,
}: any) {
  const [isFetching, setIsFetching] = useState(false)

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, any> = { page, pageSize, sortBy: 'startedAt', sortOrder: 'desc' }
    if (dateFrom) params.from = dateFrom
    if (dateTo) params.to = dateTo
    if (statusFilter) params.status = statusFilter
    return params
  }, [dateFrom, dateTo, statusFilter, page, pageSize])

  // Fetch report data
  const queryString = new URLSearchParams(
    Object.entries(queryParams).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== '') acc[k] = String(v)
      return acc
    }, {} as Record<string, string>)
  ).toString()

  const { data, isLoading, isError, refetch } = useDataQuery<InsuranceData>({
    apiEndPoint: `${API_BASE}/api/reports/insurance-mileage?${queryString}`,
    noFilter: true,
  })

  const handleRefresh = () => {
    refetch()
    toast.success('Report refreshed')
  }

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setStatusFilter('')
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header — standalone, no admin nav */}
      <header
        className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-[1100px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-200">
              <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">Insurance Portal</div>
              <div className="text-[10px] text-slate-400">Mileage & Tracking Report</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} disabled={isFetching} size="sm" variant="outline" className="rounded-xl">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" className="rounded-xl lime-btn" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl text-red-500" onClick={onLogout}>
              <Lock className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 py-6 pb-24">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Insurance & Mileage Report</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
            Miles driven, tracking sessions, and period aggregations for insurance review.
          </p>
        </div>

        {/* Summary cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="Total Sessions" value={data.summary.totalTrackingSessions?.toLocaleString() ?? '—'} icon={<Navigation className="w-4 h-4" />} />
            <SummaryCard label="Total Miles" value={formatReportMiles(data.summary.totalDrivenMiles)} icon={<Truck className="w-4 h-4" />} />
            <SummaryCard label="Total Hours" value={data.summary.totalDrivenHours?.toFixed(1) ?? '—'} icon={<Clock className="w-4 h-4" />} />
            <SummaryCard label="Avg Miles/Trip" value={data.summary.averageMilesPerTrip?.toFixed(1) ?? '—'} icon={<MapPin className="w-4 h-4" />} />
          </div>
        )}

        {/* Filters */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="h-10 text-sm rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date To</Label>
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="h-10 text-sm rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  className="h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">All</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="BOOKED">Booked</option>
                </select>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={resetFilters}>
                <Filter className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : isError ? (
              <div className="text-center py-16 text-slate-500">
                Failed to load report. Please try refreshing.
              </div>
            ) : !data?.rows || data.rows.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                No tracking sessions found for the selected filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Delivery ID</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Status</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Customer</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Driver</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Route</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Started</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-slate-400">Miles</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-slate-400">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row: InsuranceRow) => (
                        <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                            {row.deliveryId?.slice(-8) ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] font-bold">
                              {row.delivery?.status || row.status || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                            {row.delivery?.customer?.businessName || row.delivery?.customer?.user?.fullName || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                            {row.assignedDriver?.user?.fullName || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate">
                            {row.delivery?.pickupAddress ? `${row.delivery.pickupAddress.split(',')[0]} → ` : ''}
                            {row.delivery?.dropoffAddress ? row.delivery.dropoffAddress.split(',')[0] : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {row.startedAt ? formatReportDate(row.startedAt) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">
                            {formatReportMiles(row.drivenMiles)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                            {row.drivenHours != null ? row.drivenHours.toFixed(1) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data?.pagination && data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500">
                      Showing {((data.pagination.page - 1) * data.pagination.pageSize) + 1} – {Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.totalRows)} of {data.pagination.totalRows}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage((p: number) => p - 1)} disabled={page === 1} className="rounded-xl">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-slate-500">Page {page} of {data.pagination.totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setPage((p: number) => p + 1)} disabled={page >= data.pagination.totalPages} className="rounded-xl">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Export Dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        reportKey="insurance-mileage"
        reportTitle="Insurance & Mileage Report"
        currentFilters={{
          from: dateFrom,
          to: dateTo,
          status: statusFilter,
        }}
        filterConfigs={[
          { key: 'from', label: 'Date From', type: 'date' },
          { key: 'to', label: 'Date To', type: 'date' },
          {
            key: 'status',
            label: 'Delivery Status',
            type: 'select',
            options: [
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'BOOKED', label: 'Booked' },
              { value: 'LISTED', label: 'Listed' },
            ],
          },
        ]}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Summary Card helper
// ════════════════════════════════════════════════════════════════════════

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-400 mb-1">
          {icon}
          <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
