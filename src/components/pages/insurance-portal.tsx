//@ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Truck,
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
import { formatReportDate, formatReportMiles } from '@/hooks/useAdminReports'

const API_BASE = import.meta.env.VITE_API_URL

export default function InsurancePortalPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    const saved = sessionStorage.getItem('insurancePortalPassword')
    if (saved) {
      setAuthenticated(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoggingIn(true)
    try {
      // Test the password by fetching the columns endpoint
      const response = await fetch(`${API_BASE}/api/insurance-portal/columns`, {
        headers: { 'X-Portal-Password': password },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.message || 'Invalid password')
      }

      sessionStorage.setItem('insurancePortalPassword', password)
      setAuthenticated(true)
      toast.success('Welcome to the Insurance Portal')
    } catch (error: any) {
      toast.error('Login failed', { description: error?.message || 'Please try again' })
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('insurancePortalPassword')
    setAuthenticated(false)
    setPassword('')
  }

  // ── Password Gate ──
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-full max-w-md">
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
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="h-12 pl-11 pr-11 rounded-xl text-sm"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
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
// Report View Component — standalone, no app bar, no routing
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
  const portalPassword = sessionStorage.getItem('insurancePortalPassword') || ''
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, any> = { page, pageSize, sortBy: 'startedAt', sortOrder: 'desc' }
    if (dateFrom) params.from = dateFrom
    if (dateTo) params.to = dateTo
    if (statusFilter) params.status = statusFilter
    return params
  }, [dateFrom, dateTo, statusFilter, page, pageSize])

  // Build query string
  const queryString = new URLSearchParams(
    Object.entries(queryParams).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== '') acc[k] = String(v)
      return acc
    }, {} as Record<string, string>)
  ).toString()

  // Fetch report data using the portal endpoint (raw fetch with password header)
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const response = await fetch(`${API_BASE}/api/insurance-portal/report?${queryString}`, {
        headers: { 'X-Portal-Password': portalPassword },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      setData(json)
    } catch (err) {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [queryString, portalPassword])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData()
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
      {/* Header — standalone, no admin nav, no links */}
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
            <Button onClick={handleRefresh} disabled={isError} size="sm" variant="outline" className="rounded-xl">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
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
                <Filter className="w-3.5 w-3.5 mr-1" />
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
            ) : !data?.displayRows || data.displayRows.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                No tracking sessions found for the selected filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Status</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Customer</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Driver</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Route</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Started</th>
                        <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-slate-400">Stopped</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-slate-400">Miles</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-slate-400">Hours</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-slate-400">Payment</th>
                        <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-slate-400">Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.displayRows.map((row: any) => (
                        <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] font-bold">
                              {row.status || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                            {row.customerName || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                            {row.driverName || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate">
                            {row.pickupAddress ? `${row.pickupAddress.split(',')[0]} → ` : ''}
                            {row.dropoffAddress ? row.dropoffAddress.split(',')[0] : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {row.startedAt ? formatReportDate(row.startedAt) : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {row.stoppedAt ? formatReportDate(row.stoppedAt) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-300">
                            {formatReportMiles(row.drivenMiles)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                            {row.drivenHours != null ? row.drivenHours.toFixed(1) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {row.paymentAmount != null ? `$${row.paymentAmount.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                            {row.payoutAmount != null ? `$${row.payoutAmount.toFixed(2)}` : '—'}
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

      {/* Export Dialog — uses the portal export endpoint */}
      <PortalExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        portalPassword={portalPassword}
        currentFilters={{
          from: dateFrom,
          to: dateTo,
          status: statusFilter,
        }}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Portal Export Dialog — uses the portal export endpoint (no JWT)
// ════════════════════════════════════════════════════════════════════════

function PortalExportDialog({
  open,
  onOpenChange,
  portalPassword,
  currentFilters,
}: any) {
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv')
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [isExporting, setIsExporting] = useState(false)
  const [availableColumns, setAvailableColumns] = useState<Array<{ key: string; label: string }>>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [columnsLoading, setColumnsLoading] = useState(false)

  // Fetch available columns when dialog opens
  useEffect(() => {
    if (open && availableColumns.length === 0) {
      setColumnsLoading(true)
      fetch(`${API_BASE}/api/insurance-portal/columns`, {
        headers: { 'X-Portal-Password': portalPassword },
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load columns')
          return res.json()
        })
        .then(data => {
          const cols = data.columns || []
          setAvailableColumns(cols)
          // All columns selected by default
          setSelectedColumns(new Set(cols.map((c: any) => c.key)))
        })
        .catch(() => toast.error('Failed to load columns'))
        .finally(() => setColumnsLoading(false))
    }
  }, [open, portalPassword, availableColumns.length])

  // Initialize filters when dialog opens
  useEffect(() => {
    if (open) {
      setFilters({
        from: currentFilters.from || '',
        to: currentFilters.to || '',
        status: currentFilters.status || '',
      })
    }
  }, [open, currentFilters])

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedColumns.size === availableColumns.length) {
      setSelectedColumns(new Set())
    } else {
      setSelectedColumns(new Set(availableColumns.map(c => c.key)))
    }
  }

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast.error('Select at least one column')
      return
    }

    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.status) params.set('status', filters.status)
      // Send selected columns as comma-separated keys
      params.set('columns', Array.from(selectedColumns).join(','))

      const response = await fetch(`${API_BASE}/api/insurance-portal/export?${params}`, {
        headers: { 'X-Portal-Password': portalPassword },
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `insurance-mileage-report.${format}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) filename = match[1].replace(/['"]/g, '')
      }

      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      toast.success(`Report downloaded as ${format.toUpperCase()}`)
      onOpenChange(false)
    } catch (error: any) {
      toast.error('Export failed', { description: error?.message || 'Please try again' })
    } finally {
      setIsExporting(false)
    }
  }

  if (!open) return null

  const allSelected = selectedColumns.size === availableColumns.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => onOpenChange(false)}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-[520px] w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-primary" />
          Export Report
        </h2>

        {/* Filters */}
        <div className="space-y-3 mb-4">
          <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Filters</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600">Date From</Label>
              <Input type="date" value={filters.from || ''} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="h-10 text-sm rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600">Date To</Label>
              <Input type="date" value={filters.to || ''} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="h-10 text-sm rounded-xl" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-600">Delivery Status</Label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="">All</option>
              <option value="COMPLETED">Completed</option>
              <option value="ACTIVE">Active</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Column Selection */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Columns ({selectedColumns.size}/{availableColumns.length})
            </Label>
            <button
              onClick={toggleAll}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {columnsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
              {availableColumns.map((col) => (
                <label
                  key={col.key}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-sm",
                    selectedColumns.has(col.key)
                      ? "border-primary bg-primary/5 font-bold text-slate-900 dark:text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="w-4 h-4 rounded accent-lime-500"
                  />
                  <span className="truncate">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Format */}
        <div className="space-y-3 mb-6">
          <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Format</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['csv', 'xlsx', 'pdf'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition",
                  format === fmt ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <span className={cn("text-[11px] font-extrabold", format === fmt ? "text-primary" : "text-slate-500")}>
                  {fmt === 'csv' ? 'CSV' : fmt === 'xlsx' ? 'Excel' : 'PDF'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            className="flex-1 lime-btn rounded-xl font-extrabold gap-2"
            onClick={handleExport}
            disabled={isExporting || selectedColumns.size === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>
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
