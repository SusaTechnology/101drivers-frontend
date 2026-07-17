// components/pages/admin-insurance-reporting.tsx
//
// Admin internal view of the per-ride insurance & mileage report.
//
// Uses the SAME shared InsuranceReportFilters + InsuranceReportTable as the
// password-gated carrier portal (insurance-portal.tsx) so what an underwriter
// sees externally matches what an admin sees internally — same columns, same
// filters, same sort options.
//
// This page additionally keeps its own summary KPI cards and period
// aggregation table (which the portal does not show), per the dealer's
// request: the admin summary section is required, the portal does not need
// one beyond its six summary cards.
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import {
  useInsuranceMileageReport,
  formatReportMiles,
  downloadReport,
} from '@/hooks/useAdminReports';
import { useCustomerLookup } from '@/hooks/useAdminDashboard';
import { useDriverLookup } from '@/hooks/useAdminDeliveries';
import type { InsuranceMileageReportParams } from '@/types/report';
import {
  InsuranceReportFilters,
  type InsuranceReportFiltersState,
} from '@/components/shared/reports/InsuranceReportFilters';
import { InsuranceReportTable } from '@/components/shared/reports/InsuranceReportTable';
import {
  RefreshCw,
  Download,
  Filter,
  ArrowLeft,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatDrivenHoursDecimal(hours: number): string {
  return Number(hours).toFixed(2);
}

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
};

export default function AdminInsuranceReportingPage() {
  const { actionItems, signOut } = useAdminActions();

  // Filter state — shared shape with the carrier portal
  const [filters, setFilters] = useState<InsuranceReportFiltersState>(DEFAULT_FILTERS);
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Fetch customer and driver lookup lists for dropdowns
  const { data: customers = [] } = useCustomerLookup();
  const { data: drivers = [] } = useDriverLookup();

  // Map the lookup lists into the simple {id, name} shape the shared
  // SearchableSelect expects.
  const customerItems = useMemo(
    () => customers.map((c) => ({ id: c.id, name: c.name })),
    [customers]
  );
  // Drivers dropdown: only approved drivers (matches the original admin page).
  const driverItems = useMemo(
    () =>
      drivers
        .filter((d) => d.status === 'APPROVED')
        .map((d) => ({ id: d.id, name: d.name })),
    [drivers]
  );

  // Build query params — groupBy is fixed to 'month' so the period
  // aggregation table on this page keeps working. The shared filter card no
  // longer exposes a Group By dropdown (it isn't part of the per-ride spec
  // and the carrier portal never had one).
  const queryParams: InsuranceMileageReportParams = useMemo(() => {
    const params: InsuranceMileageReportParams = {
      page,
      pageSize,
      groupBy: 'month',
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
    if (filters.dateFrom) params.from = filters.dateFrom;
    if (filters.dateTo) params.to = filters.dateTo;
    if (filters.customerId.trim()) params.customerId = filters.customerId.trim();
    if (filters.driverId.trim()) params.driverId = filters.driverId.trim();
    if (filters.serviceType) params.serviceType = filters.serviceType;
    if (filters.statusFilter) (params as any).status = filters.statusFilter;
    if (filters.minMiles) (params as any).minDrivenMiles = parseFloat(filters.minMiles);
    if (filters.maxMiles) (params as any).maxDrivenMiles = parseFloat(filters.maxMiles);
    if (filters.minPayment) (params as any).minPaymentAmount = parseFloat(filters.minPayment);
    if (filters.maxPayment) (params as any).maxPaymentAmount = parseFloat(filters.maxPayment);
    if (filters.pickupSearch) (params as any).pickupAddressSearch = filters.pickupSearch;
    return params;
  }, [filters, page, pageSize]);

  const { data, isLoading, isFetching, isError, refetch } = useInsuranceMileageReport(queryParams);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Report refreshed');
  }, [refetch]);

  const handleExport = useCallback(async (format: string) => {
    try {
      await downloadReport('insurance-mileage', queryParams as unknown as Record<string, unknown>, format);
      toast.success(`Report downloaded as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to download ${format.toUpperCase()} report`);
    }
  }, [queryParams]);

  const handleFiltersChange = useCallback(
    (updates: Partial<InsuranceReportFiltersState>) => {
      setFilters((prev) => ({ ...prev, ...updates }));
      setPage(1);
    },
    []
  );

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setFilters((prev) => ({ ...prev, sortBy: newSortBy, sortOrder: newSortOrder }));
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Link to="/admin-reports" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Reports
              </Link>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Insurance & Mileage Report</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Miles driven, tracking sessions, and period aggregations for insurance review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
            <Button onClick={handleRefresh} disabled={isFetching} size="sm" className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </section>

        {data?.summary && (
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tracking Sessions</div>
              <div className="text-xl font-black mt-1">{data.summary.totalTrackingSessions}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-primary/5 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Total Miles</div>
              <div className="text-xl font-black mt-1">{formatReportMiles(data.summary.totalDrivenMiles)}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg Miles/Trip</div>
              <div className="text-xl font-black mt-1">{formatReportMiles(data.summary.averageMilesPerTrip)}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Total Driven Hours</div>
              <div className="text-xl font-black mt-1 text-amber-600 dark:text-amber-400">{formatDrivenHoursDecimal(data.summary.totalDrivenHours)}</div>
              <div className="text-[10px] text-amber-400 mt-0.5">${(data.summary.totalDrivenHours * 0.30).toFixed(2)} est. cost</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-orange-50 dark:bg-orange-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Avg Hrs/Trip</div>
              <div className="text-xl font-black mt-1 text-orange-600 dark:text-orange-400">{formatDrivenHoursDecimal(data.summary.averageDrivenHoursPerTrip)}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Started</div>
              <div className="text-xl font-black mt-1 text-emerald-600">{data.summary.startedCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-blue-50 dark:bg-blue-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Stopped</div>
              <div className="text-xl font-black mt-1 text-blue-600">{data.summary.stoppedCount}</div>
            </Card>
          </section>
        )}

        {/* Period Aggregations */}
        {data?.groupings?.byPeriod && data.groupings.byPeriod.length > 0 && (
          <section className="mb-6">
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Period Aggregation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Period</th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Trips</th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Total Miles</th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Avg Miles</th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-500 text-right">Total Hours</th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-orange-500 text-right">Avg Hrs/Trip</th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Drivers</th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Customers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.groupings.byPeriod.map((period) => (
                        <tr key={period.period} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 text-sm font-bold text-slate-900 dark:text-white">{period.period}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-600">{period.tripCount}</td>
                          <td className="px-3 py-2 text-sm font-bold text-right">{formatReportMiles(period.totalDrivenMiles)}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-600">{formatReportMiles(period.averageMilesPerTrip)}</td>
                          <td className="px-3 py-2 text-sm font-bold text-right text-amber-600 dark:text-amber-400">{formatDrivenHoursDecimal(period.totalDrivenHours)}</td>
                          <td className="px-3 py-2 text-sm text-right text-orange-600 dark:text-orange-400">{formatDrivenHoursDecimal(period.averageDrivenHoursPerTrip)}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-600">{period.uniqueDriverCount}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-600">{period.uniqueCustomerCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Filters — shared component, identical to carrier portal */}
        <InsuranceReportFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleReset}
          customers={customerItems}
          drivers={driverItems}
        />

        {/* Data Table — shared component, identical column set as carrier portal */}
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
          emptyMessage="No mileage data found. Try adjusting your filters."
        />
      </main>

      {/* Export Dialog — uses page filters, no redundant filter inputs */}
      <AdminExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        pageFilters={queryParams}
        totalRows={data?.pagination?.totalRows ?? 0}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Admin Export Dialog — same as portal: columns + format + row count notice
// ════════════════════════════════════════════════════════════════════════

function AdminExportDialog({ open, onOpenChange, pageFilters, totalRows }: any) {
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv')
  const [isExporting, setIsExporting] = useState(false)
  const [availableColumns, setAvailableColumns] = useState<Array<{ key: string; label: string }>>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [columnsLoading, setColumnsLoading] = useState(false)

  useEffect(() => {
    if (open && availableColumns.length === 0) {
      setColumnsLoading(true)
      fetch(`${import.meta.env.VITE_API_URL}/api/reports/columns/insurance-mileage`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(data => { const cols = data.columns || []; setAvailableColumns(cols); setSelectedColumns(new Set(cols.map((c: any) => c.key))) })
        .catch(() => toast.error('Failed to load columns'))
        .finally(() => setColumnsLoading(false))
    }
  }, [open, availableColumns.length])

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
      Object.entries(pageFilters).forEach(([k, v]: any) => {
        if (v !== undefined && v !== null && v !== '' && k !== 'page' && k !== 'pageSize') params.set(k, String(v))
      })
      params.set('columns', Array.from(selectedColumns).join(','))

      const { downloadReport } = await import('@/hooks/useAdminReports')
      await downloadReport('insurance-mileage', Object.fromEntries(params.entries()), format)
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
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 mb-4">
          <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-bold">Filters from the page will be applied.</span> This export will contain{' '}
            <span className="font-black">{totalRows.toLocaleString()}</span> row{totalRows !== 1 ? 's' : ''}.
            {totalRows > 10000 && <span className="text-amber-600 dark:text-amber-400"> This may take a moment.</span>}
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Columns ({selectedColumns.size}/{availableColumns.length})</Label>
            <button onClick={toggleAll} className="text-[11px] font-bold text-primary hover:underline">{allSelected ? 'Deselect All' : 'Select All'}</button>
          </div>
          {columnsLoading ? (
            <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
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
              {isExporting ? (<><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Exporting...</>) : (<><Download className="w-4 h-4" />Export</>)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
