//@ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Shield, Lock, Eye, EyeOff, Loader2, Download, RefreshCw,
  ChevronLeft, ChevronRight, Truck, MapPin, Navigation, Clock,
  Filter, DollarSign, User, Search, Info, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatReportDate, formatReportMiles } from '@/hooks/useAdminReports'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

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
  const [serviceType, setServiceType] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [minMiles, setMinMiles] = useState('')
  const [maxMiles, setMaxMiles] = useState('')
  const [minPayment, setMinPayment] = useState('')
  const [maxPayment, setMaxPayment] = useState('')
  const [pickupSearch, setPickupSearch] = useState('')
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
    dateFrom={dateFrom} setDateFrom={setDateFrom}
    dateTo={dateTo} setDateTo={setDateTo}
    statusFilter={statusFilter} setStatusFilter={setStatusFilter}
    serviceType={serviceType} setServiceType={setServiceType}
    customerId={customerId} setCustomerId={setCustomerId}
    driverId={driverId} setDriverId={setDriverId}
    customerSearch={customerSearch} setCustomerSearch={setCustomerSearch}
    driverSearch={driverSearch} setDriverSearch={setDriverSearch}
    minMiles={minMiles} setMinMiles={setMinMiles}
    maxMiles={maxMiles} setMaxMiles={setMaxMiles}
    minPayment={minPayment} setMinPayment={setMinPayment}
    maxPayment={maxPayment} setMaxPayment={setMaxPayment}
    pickupSearch={pickupSearch} setPickupSearch={setPickupSearch}
    page={page} setPage={setPage}
    pageSize={pageSize}
    exportOpen={exportOpen} setExportOpen={setExportOpen}
    driverList={driverList}
    customerList={customerList}
  />
}

// ════════════════════════════════════════════════════════════════════════
// Report View
// ════════════════════════════════════════════════════════════════════════

function ReportView(props: any) {
  const {
    onLogout, dateFrom, setDateFrom, dateTo, setDateTo,
    statusFilter, setStatusFilter, serviceType, setServiceType,
    customerId, setCustomerId, driverId, setDriverId,
    customerSearch, setCustomerSearch, driverSearch, setDriverSearch,
    minMiles, setMinMiles, maxMiles, setMaxMiles,
    minPayment, setMinPayment, maxPayment, setMaxPayment,
    pickupSearch, setPickupSearch,
    page, setPage, pageSize, exportOpen, setExportOpen,
    driverList, customerList,
  } = props

  const portalPassword = sessionStorage.getItem('insurancePortalPassword') || ''
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    setPage(1)
  }

  // Column definitions for TanStack Table
  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'status',
      header: 'Status',
      size: 90,
      meta: { label: 'Status', sortable: true, sortKey: 'delivery.status' },
      cell: ({ getValue }) => <Badge variant="outline" className="text-[10px] font-bold">{getValue() || '—'}</Badge>,
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      size: 120,
      meta: { label: 'Customer', sortable: false },
      cell: ({ getValue }) => <span>{getValue() || '—'}</span>,
    },
    {
      accessorKey: 'driverName',
      header: 'Driver',
      size: 120,
      meta: { label: 'Driver', sortable: false },
      cell: ({ getValue }) => <span>{getValue() || '—'}</span>,
    },
    {
      id: 'route',
      header: 'Route',
      size: 180,
      meta: { label: 'Route', sortable: false },
      cell: ({ row }) => (
        <span>
          {row.original.pickupAddress ? `${row.original.pickupAddress.split(',')[0]} → ` : ''}
          {row.original.dropoffAddress ? row.original.dropoffAddress.split(',')[0] : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'startedAt',
      header: 'Started',
      size: 130,
      meta: { label: 'Started', sortable: true, sortKey: 'startedAt' },
      cell: ({ getValue }) => <span>{getValue() ? formatReportDate(getValue()) : '—'}</span>,
    },
    {
      accessorKey: 'stoppedAt',
      header: 'Stopped',
      size: 130,
      meta: { label: 'Stopped', sortable: true, sortKey: 'stoppedAt' },
      cell: ({ getValue }) => <span>{getValue() ? formatReportDate(getValue()) : '—'}</span>,
    },
    {
      accessorKey: 'drivenMiles',
      header: 'Miles',
      size: 70,
      meta: { label: 'Miles', sortable: true, sortKey: 'drivenMiles' },
      cell: ({ getValue }) => <span className="font-bold tabular-nums">{formatReportMiles(getValue())}</span>,
    },
    {
      accessorKey: 'drivenHours',
      header: 'Hours',
      size: 60,
      meta: { label: 'Hours', sortable: true, sortKey: 'drivenHours' },
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() != null ? getValue().toFixed(1) : '—'}</span>,
    },
    {
      accessorKey: 'paymentAmount',
      header: 'Payment',
      size: 80,
      meta: { label: 'Payment', sortable: false },
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() != null ? `$${getValue().toFixed(2)}` : '—'}</span>,
    },
    {
      accessorKey: 'payoutAmount',
      header: 'Payout',
      size: 80,
      meta: { label: 'Payout', sortable: false },
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() != null ? `$${getValue().toFixed(2)}` : '—'}</span>,
    },
  ], [])

  const queryParams = useMemo(() => {
    const params: Record<string, any> = { page, pageSize, sortBy, sortOrder }
    if (dateFrom) params.from = dateFrom
    if (dateTo) params.to = dateTo
    if (statusFilter) params.status = statusFilter
    if (serviceType) params.serviceType = serviceType
    if (customerId) params.customerId = customerId
    if (driverId) params.driverId = driverId
    if (minMiles) params.minDrivenMiles = parseFloat(minMiles)
    if (maxMiles) params.maxDrivenMiles = parseFloat(maxMiles)
    if (minPayment) params.minPaymentAmount = parseFloat(minPayment)
    if (maxPayment) params.maxPaymentAmount = parseFloat(maxPayment)
    if (pickupSearch) params.pickupAddressSearch = pickupSearch
    return params
  }, [dateFrom, dateTo, statusFilter, serviceType, customerId, driverId, minMiles, maxMiles, minPayment, maxPayment, pickupSearch, page, pageSize])

  const queryString = new URLSearchParams(
    Object.entries(queryParams).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== '') acc[k] = String(v)
      return acc
    }, {} as Record<string, string>)
  ).toString()

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

  const resetFilters = () => {
    setDateFrom(''); setDateTo(''); setStatusFilter(''); setServiceType('')
    setCustomerId(''); setDriverId(''); setCustomerSearch(''); setDriverSearch('')
    setMinMiles(''); setMaxMiles(''); setMinPayment(''); setMaxPayment('')
    setPickupSearch(''); setPage(1)
  }

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

        {/* Filters */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Filters
              </span>
              <button onClick={resetFilters} className="text-[11px] font-bold text-primary hover:underline">Reset All</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <FilterField label="Date From">
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="h-9 text-sm rounded-xl" />
              </FilterField>
              <FilterField label="Date To">
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="h-9 text-sm rounded-xl" />
              </FilterField>
              <FilterField label="Status">
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-full h-9 px-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <option value="">All</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ACTIVE">Active</option>
                  <option value="BOOKED">Booked</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </FilterField>
              <FilterField label="Service Type">
                <select value={serviceType} onChange={(e) => { setServiceType(e.target.value); setPage(1) }} className="w-full h-9 px-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <option value="">All</option>
                  <option value="home">Home Delivery</option>
                  <option value="dealer">Between Locations</option>
                  <option value="service">Service Pickup/return</option>
                </select>
              </FilterField>
              <FilterField label="Customer">
                <SearchableSelect
                  items={customerList}
                  value={customerId}
                  onChange={(id) => { setCustomerId(id); setPage(1) }}
                  placeholder="All Customers"
                />
              </FilterField>
              <FilterField label="Driver">
                <SearchableSelect
                  items={driverList}
                  value={driverId}
                  onChange={(id) => { setDriverId(id); setPage(1) }}
                  placeholder="All Drivers"
                />
              </FilterField>
              <FilterField label="Min Miles">
                <Input type="number" value={minMiles} onChange={(e) => { setMinMiles(e.target.value); setPage(1) }} placeholder="0" className="h-9 text-sm rounded-xl" />
              </FilterField>
              <FilterField label="Max Miles">
                <Input type="number" value={maxMiles} onChange={(e) => { setMaxMiles(e.target.value); setPage(1) }} placeholder="9999" className="h-9 text-sm rounded-xl" />
              </FilterField>
              <FilterField label="Min Payment ($)">
                <Input type="number" value={minPayment} onChange={(e) => { setMinPayment(e.target.value); setPage(1) }} placeholder="0" className="h-9 text-sm rounded-xl" />
              </FilterField>
              <FilterField label="Max Payment ($)">
                <Input type="number" value={maxPayment} onChange={(e) => { setMaxPayment(e.target.value); setPage(1) }} placeholder="9999" className="h-9 text-sm rounded-xl" />
              </FilterField>
              <FilterField label="Pickup Address">
                <Input value={pickupSearch} onChange={(e) => { setPickupSearch(e.target.value); setPage(1) }} placeholder="e.g. Los Angeles" className="h-9 text-sm rounded-xl" />
              </FilterField>
            </div>
          </CardContent>
        </Card>

        {/* Report Table — TanStack Table with resizable columns */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={data?.displayRows || []}
              isLoading={isLoading}
              isError={isError}
              page={page}
              pageSize={pageSize}
              totalRows={data?.pagination?.totalRows ?? 0}
              totalPages={data?.pagination?.totalPages ?? 1}
              onPageChange={setPage}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              emptyMessage="No tracking sessions found for the selected filters."
            />
          </CardContent>
        </Card>
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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Label>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// SearchableSelect — type to filter, click to select
// ════════════════════════════════════════════════════════════════════════

function SearchableSelect({ items, value, onChange, placeholder }: {
  items: Array<{ id: string; name: string }>
  value: string
  onChange: (id: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Find the selected item's name for display
  const selectedItem = items.find((item) => item.id === value)
  const displayValue = selectedItem ? selectedItem.name : ''

  // Filter items by search text
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (id: string) => {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    onChange('')
    setSearch('')
  }

  return (
    <div className="relative">
      <div
        className="w-full h-9 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <span className={cn("truncate", displayValue ? "text-slate-900 dark:text-white font-semibold" : "text-slate-400")}>
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear() }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", open && "rotate-90")} />
        </div>
      </div>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch('') }} />

          {/* Dropdown panel */}
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-[240px] overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
              </div>
            </div>

            {/* Options list */}
            <div className="overflow-y-auto max-h-[180px]">
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition",
                  !value ? "bg-primary/5 font-bold text-primary" : "text-slate-600 dark:text-slate-400"
                )}
              >
                {placeholder}
              </button>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition truncate",
                    value === item.id ? "bg-primary/5 font-bold text-primary" : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  {item.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-xs text-center text-slate-400">No results found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
