//@ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Shield, Lock, Eye, EyeOff, Loader2, Download, RefreshCw,
  Truck, MapPin, Navigation, Clock,
  DollarSign, Info, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatReportMiles } from '@/hooks/useAdminReports'
import {
  InsuranceReportFilters,
  type InsuranceReportFiltersState,
} from '@/components/shared/reports/InsuranceReportFilters'
import { InsuranceReportTable } from '@/components/shared/reports/InsuranceReportTable'

const API_BASE = import.meta.env.VITE_API_URL

const DEFAULT_FILTERS: InsuranceReportFiltersState = {
  dateFrom: '',
  dateTo: '',
  statusFilter: '',
  serviceType: '',
  customerId: '',
  driverId: '',
  minMiles: '',
  maxMiles: '',
  minPayment: '',
  maxPayment: '',
  pickupSearch: '',
  sortBy: 'startedAt',
  sortOrder: 'desc',
}

export default function InsurancePortalPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  // Report filters (single source of truth — passed to shared InsuranceReportFilters)
  const [filters, setFilters] = useState<InsuranceReportFiltersState>(DEFAULT_FILTERS)
  const [driverList, setDriverList] = useState<Array<{ id: string; name: string }>>([])
  const [customerList, setCustomerList] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('insurancePortalPassword')
    if (saved) setAuthenticated(true)
  }, [])

  // Fetch driver + customer lists when authenticated
  useEffect(() => {
    if (!authenticated) return
    const pwd = sessionStorage.getItem('insurancePortalPassword') || ''
    // Fetch drivers
    fetch(`${API_BASE}/api/insurance-portal/drivers`, { headers: { 'X-Portal-Password': pwd } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setDriverList(data))
      .catch(() => {})
    // Fetch customers
    fetch(`${API_BASE}/api/insurance-portal/customers`, { headers: { 'X-Portal-Password': pwd } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCustomerList(data))
      .catch(() => {})
  }, [authenticated])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoggingIn(true)
    try {
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
                  <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-slate-500">Portal Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="h-12 pl-11 pr-11 rounded-xl text-sm" autoFocus />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={!password || loggingIn} className="w-full h-12 lime-btn rounded-xl font-extrabold">
                  {loggingIn ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Authenticating...</>) : (<><Shield className="w-4 h-4 mr-2" />Access Portal</>)}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-slate-400 mt-6">Authorized personnel only. Contact your 101 Drivers account manager for access.</p>
        </div>
      </div>
    )
  }

  return <ReportView
    onLogout={handleLogout}
    filters={filters}
    setFilters={setFilters}
    page={page}
    setPage={setPage}
    pageSize={pageSize}
    exportOpen={exportOpen}
    setExportOpen={setExportOpen}
    driverList={driverList}
    customerList={customerList}
  />
}

// ════════════════════════════════════════════════════════════════════════
// Report View
// ════════════════════════════════════════════════════════════════════════

function ReportView(props: any) {
  const {
    onLogout, filters, setFilters,
    page, setPage, pageSize, exportOpen, setExportOpen,
    driverList, customerList,
  } = props

  const portalPassword = sessionStorage.getItem('insurancePortalPassword') || ''
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setFilters((prev: InsuranceReportFiltersState) => ({
      ...prev,
      sortBy: newSortBy,
      sortOrder: newSortOrder,
    }))
    setPage(1)
  }

  const handleFiltersChange = (updates: Partial<InsuranceReportFiltersState>) => {
    setFilters((prev: InsuranceReportFiltersState) => ({ ...prev, ...updates }))
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  const queryParams = useMemo(() => {
    const params: Record<string, any> = { page, pageSize, sortBy: filters.sortBy, sortOrder: filters.sortOrder }
    if (filters.dateFrom) params.from = filters.dateFrom
    if (filters.dateTo) params.to = filters.dateTo
    if (filters.statusFilter) params.status = filters.statusFilter
    if (filters.serviceType) params.serviceType = filters.serviceType
    if (filters.customerId) params.customerId = filters.customerId
    if (filters.driverId) params.driverId = filters.driverId
    if (filters.minMiles) params.minDrivenMiles = parseFloat(filters.minMiles)
    if (filters.maxMiles) params.maxDrivenMiles = parseFloat(filters.maxMiles)
    if (filters.minPayment) params.minPaymentAmount = parseFloat(filters.minPayment)
    if (filters.maxPayment) params.maxPaymentAmount = parseFloat(filters.maxPayment)
    if (filters.pickupSearch) params.pickupAddressSearch = filters.pickupSearch
    return params
  }, [filters, page, pageSize])

  // Memoize the query string so it only changes when queryParams actually changes
  const queryString = useMemo(() => {
    return new URLSearchParams(
      Object.entries(queryParams).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null && v !== '') acc[k] = String(v)
        return acc
      }, {} as Record<string, string>)
    ).toString()
  }, [queryParams])

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
    } catch { setIsError(true) }
    finally { setIsLoading(false) }
  }, [queryString, portalPassword])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = () => { fetchData(); toast.success('Report refreshed') }

  const summary = data?.summary || {}
  const totalRows = data?.pagination?.totalRows ?? 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
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
            <Button onClick={handleRefresh} disabled={isLoading} size="sm" variant="outline" className="rounded-xl">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" className="rounded-xl lime-btn" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl text-red-500" onClick={onLogout}>
              <Lock className="h-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Insurance & Mileage Report</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Miles driven, tracking sessions, payments, and period aggregations for insurance review.</p>
        </div>

        {/* Summary cards */}
        {!isLoading && !isError && summary.totalTrackingSessions != null && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <SummaryCard label="Sessions" value={summary.totalTrackingSessions?.toLocaleString() ?? '—'} icon={<Navigation className="w-4 h-4" />} />
            <SummaryCard label="Total Miles" value={formatReportMiles(summary.totalDrivenMiles)} icon={<Truck className="w-4 h-4" />} />
            <SummaryCard label="Total Hours" value={summary.totalDrivenHours?.toFixed(1) ?? '—'} icon={<Clock className="w-4 h-4" />} />
            <SummaryCard label="Avg Miles/Trip" value={summary.averageMilesPerTrip?.toFixed(1) ?? '—'} icon={<MapPin className="w-4 h-4" />} />
            <SummaryCard label="Total Payments" value={summary.totalPaymentAmount != null ? `$${summary.totalPaymentAmount.toFixed(2)}` : '—'} icon={<DollarSign className="w-4 h-4" />} />
            <SummaryCard label="Total Payouts" value={summary.totalPayoutAmount != null ? `$${summary.totalPayoutAmount.toFixed(2)}` : '—'} icon={<DollarSign className="w-4 h-4" />} />
          </div>
        )}

        {/* Filters — shared component, identical to admin insurance-reporting page */}
        <InsuranceReportFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleReset}
          customers={customerList}
          drivers={driverList}
        />

        {/* Report Table — shared component, identical column set as admin */}
        <InsuranceReportTable
          data={data}
          isLoading={isLoading}
          isError={isError}
          page={page}
          pageSize={pageSize}
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onPageChange={setPage}
          onSortChange={handleSortChange}
          emptyMessage="No tracking sessions found for the selected filters."
        />
      </main>

      {/* Export Dialog — no filters, just columns + format + row count notice */}
      <PortalExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        portalPassword={portalPassword}
        totalRows={totalRows}
        pageFilters={queryParams}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Export Dialog — columns + format only. No filters (uses page filters).
// ════════════════════════════════════════════════════════════════════════

function PortalExportDialog({ open, onOpenChange, portalPassword, totalRows, pageFilters }: any) {
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv')
  const [isExporting, setIsExporting] = useState(false)
  const [availableColumns, setAvailableColumns] = useState<Array<{ key: string; label: string }>>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [columnsLoading, setColumnsLoading] = useState(false)

  useEffect(() => {
    if (open && availableColumns.length === 0) {
      setColumnsLoading(true)
      fetch(`${API_BASE}/api/insurance-portal/columns`, { headers: { 'X-Portal-Password': portalPassword } })
        .then(res => { if (!res.ok) throw new Error(); return res.json() })
        .then(data => { const cols = data.columns || []; setAvailableColumns(cols); setSelectedColumns(new Set(cols.map((c: any) => c.key))) })
        .catch(() => toast.error('Failed to load columns'))
        .finally(() => setColumnsLoading(false))
    }
  }, [open, portalPassword, availableColumns.length])

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  const toggleAll = () => {
    selectedColumns.size === availableColumns.length ? setSelectedColumns(new Set()) : setSelectedColumns(new Set(availableColumns.map(c => c.key)))
  }

  const handleExport = async () => {
    if (selectedColumns.size === 0) { toast.error('Select at least one column'); return }
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      // Apply ALL page filters to the export
      Object.entries(pageFilters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && k !== 'page' && k !== 'pageSize') params.set(k, String(v))
      })
      params.set('columns', Array.from(selectedColumns).join(','))

      const response = await fetch(`${API_BASE}/api/insurance-portal/export?${params}`, { headers: { 'X-Portal-Password': portalPassword } })
      if (!response.ok) throw new Error(`Export failed: ${response.status}`)

      const blob = await response.blob()
      const cd = response.headers.get('Content-Disposition')
      let filename = `insurance-mileage-report.${format}`
      if (cd) { const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/); if (m && m[1]) filename = m[1].replace(/['"]/g, '') }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = filename
      document.body.appendChild(link); link.click()
      document.body.removeChild(link); window.URL.revokeObjectURL(url)

      toast.success(`Report downloaded as ${format.toUpperCase()}`)
      onOpenChange(false)
    } catch (error: any) { toast.error('Export failed', { description: error?.message || 'Please try again' }) }
    finally { setIsExporting(false) }
  }

  if (!open) return null
  const allSelected = selectedColumns.size === availableColumns.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => onOpenChange(false)}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-[560px] w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-primary" /> Export Report
        </h2>

        {/* Page filters notice + row count */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 mb-4">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-bold">Filters from the page will be applied.</span> This export will contain{' '}
            <span className="font-black">{totalRows.toLocaleString()}</span> row{totalRows !== 1 ? 's' : ''}.
            {totalRows > 10000 && <span className="text-amber-600 dark:text-amber-400"> This may take a moment.</span>}
          </div>
        </div>

        {/* Column Selection */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Columns ({selectedColumns.size}/{availableColumns.length})</Label>
            <button onClick={toggleAll} className="text-[11px] font-bold text-primary hover:underline">{allSelected ? 'Deselect All' : 'Select All'}</button>
          </div>
          {columnsLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 p-1">
              {availableColumns.map((col) => (
                <label key={col.key} className={cn("flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition text-sm", selectedColumns.has(col.key) ? "border-primary bg-primary/5 font-bold text-slate-900 dark:text-white" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800")}>
                  <input type="checkbox" checked={selectedColumns.has(col.key)} onChange={() => toggleColumn(col.key)} className="w-4 h-4 rounded accent-lime-500" />
                  <span className="truncate">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Format + Actions */}
        <div className="flex items-end gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Format</Label>
            <div className="flex gap-2">
              {(['csv', 'xlsx', 'pdf'] as const).map((fmt) => (
                <button key={fmt} onClick={() => setFormat(fmt)} className={cn("px-4 py-2 rounded-xl border-2 transition text-[11px] font-extrabold", format === fmt ? "border-primary bg-primary/5 text-primary" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")}>
                  {fmt === 'csv' ? 'CSV' : fmt === 'xlsx' ? 'Excel' : 'PDF'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={isExporting}>Cancel</Button>
            <Button className="lime-btn rounded-xl font-extrabold gap-2" onClick={handleExport} disabled={isExporting || selectedColumns.size === 0}>
              {isExporting ? (<><Loader2 className="w-4 h-4 animate-spin" />Exporting...</>) : (<><Download className="w-4 h-4" />Export</>)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-400 mb-1">{icon}<span className="text-[10px] font-black uppercase tracking-wider">{label}</span></div>
        <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
