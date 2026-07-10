// components/pages/admin-insurance-reporting.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import { useInsuranceMileageReport, formatReportDate, formatReportMiles } from '@/hooks/useAdminReports';
import { useCustomerLookup } from '@/hooks/useAdminDashboard';
import { useDriverLookup } from '@/hooks/useAdminDeliveries';
import type { InsuranceMileageReportParams, InsuranceMileageReportRow } from '@/types/report';
import { DataTable } from '@/components/shared/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import type { CustomerLookupItem } from '@/types/dashboard';
import type { DriverLookupItem } from '@/types/delivery';
import {
  Car,
  RefreshCw,
  Download,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  User,
  Building2,
  ArrowUpDown,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const GROUP_BY_OPTIONS = [
  { value: 'week', label: 'By Week' },
  { value: 'month', label: 'By Month' },
];

const SERVICE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Services' },
  { value: 'HOME_DELIVERY', label: 'Home Delivery' },
  { value: 'BETWEEN_LOCATIONS', label: 'Between Locations' },
  { value: 'SERVICE_PICKUP_RETURN', label: 'Service Pickup/Return' },
];

const SORT_BY_OPTIONS = [
  { value: 'startedAt', label: 'Started Date' },
  { value: 'stoppedAt', label: 'Stopped Date' },
  { value: 'drivenMiles', label: 'Miles Driven' },
  { value: 'createdAt', label: 'Created Date' },
];

function formatDrivenHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDrivenHoursDecimal(hours: number): string {
  return hours.toFixed(2);
}

const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: 'Newest First' },
  { value: 'asc', label: 'Oldest First' },
];

export default function AdminInsuranceReportingPage() {
  const { actionItems, signOut } = useAdminActions();

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('month');
  const [serviceType, setServiceType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [minDrivenHours, setMinDrivenHours] = useState('');
  const [maxDrivenHours, setMaxDrivenHours] = useState('');
  const [minMiles, setMinMiles] = useState('');
  const [maxMiles, setMaxMiles] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [maxPayment, setMaxPayment] = useState('');
  const [pickupSearch, setPickupSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Search state for dropdowns
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [isDriverSelectOpen, setIsDriverSelectOpen] = useState(false);

  // Fetch customer and driver lookup lists for dropdowns
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomerLookup();
  const { data: drivers = [], isLoading: isLoadingDrivers } = useDriverLookup();

  // Find selected customer and driver for display
  const selectedCustomer = useMemo(() => {
    if (customerId && customers.length > 0) {
      return customers.find(c => c.id === customerId);
    }
    return null;
  }, [customerId, customers]);

  const selectedDriver = useMemo(() => {
    if (driverId && drivers.length > 0) {
      return drivers.find(d => d.id === driverId);
    }
    return null;
  }, [driverId, drivers]);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(search));
  }, [customers, customerSearch]);

  // Filter drivers by search (only show approved drivers)
  const filteredDrivers = useMemo(() => {
    let result = drivers.filter(d => d.status === 'APPROVED');
    if (driverSearch) {
      const search = driverSearch.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(search));
    }
    return result;
  }, [drivers, driverSearch]);

  // Build query params
  const queryParams: InsuranceMileageReportParams = useMemo(() => {
    const params: InsuranceMileageReportParams = { page, pageSize, groupBy, sortBy, sortOrder };
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (customerId.trim()) params.customerId = customerId.trim();
    if (driverId.trim()) params.driverId = driverId.trim();
    if (serviceType && serviceType !== 'all') params.serviceType = serviceType;
    if (statusFilter) params.status = statusFilter;
    if (minDrivenHours !== '') params.minDrivenHours = parseFloat(minDrivenHours);
    if (maxDrivenHours !== '') params.maxDrivenHours = parseFloat(maxDrivenHours);
    if (minMiles) (params as any).minDrivenMiles = parseFloat(minMiles);
    if (maxMiles) (params as any).maxDrivenMiles = parseFloat(maxMiles);
    if (minPayment) (params as any).minPaymentAmount = parseFloat(minPayment);
    if (maxPayment) (params as any).maxPaymentAmount = parseFloat(maxPayment);
    if (pickupSearch) (params as any).pickupAddressSearch = pickupSearch;
    return params;
  }, [dateFrom, dateTo, customerId, driverId, groupBy, serviceType, statusFilter, sortBy, sortOrder, minDrivenHours, maxDrivenHours, minMiles, maxMiles, minPayment, maxPayment, pickupSearch, page, pageSize]);

  const { data, isLoading, isFetching, isError, refetch } = useInsuranceMileageReport(queryParams);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Report refreshed');
  }, [refetch]);

  const handleExport = useCallback(async (format: string) => {
    try {
      await downloadReport('insurance-mileage', queryParams, format);
      toast.success(`Report downloaded as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to download ${format.toUpperCase()} report`);
    }
  }, [queryParams]);

  const resetFilters = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setCustomerId('');
    setDriverId('');
    setGroupBy('month');
    setServiceType('all');
    setStatusFilter('');
    setSortBy('startedAt');
    setSortOrder('desc');
    setMinDrivenHours('');
    setMaxDrivenHours('');
    setMinMiles('');
    setMaxMiles('');
    setMinPayment('');
    setMaxPayment('');
    setPickupSearch('');
    setPage(1);
    setCustomerSearch('');
    setDriverSearch('');
  }, []);

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

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
      cell: ({ getValue }) => <span className="text-xs">{getValue() || '—'}</span>,
    },
    {
      accessorKey: 'driverName',
      header: 'Driver',
      size: 120,
      meta: { label: 'Driver', sortable: false },
      cell: ({ getValue }) => <span className="text-xs">{getValue() || '—'}</span>,
    },
    {
      id: 'route',
      header: 'Route',
      size: 180,
      meta: { label: 'Route', sortable: false },
      cell: ({ row }) => (
        <span className="text-xs">
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
      cell: ({ getValue }) => <span className="text-xs">{getValue() ? formatReportDate(getValue()) : '—'}</span>,
    },
    {
      accessorKey: 'stoppedAt',
      header: 'Stopped',
      size: 130,
      meta: { label: 'Stopped', sortable: true, sortKey: 'stoppedAt' },
      cell: ({ getValue }) => <span className="text-xs">{getValue() ? formatReportDate(getValue()) : '—'}</span>,
    },
    {
      accessorKey: 'drivenMiles',
      header: 'Miles',
      size: 70,
      meta: { label: 'Miles', sortable: true, sortKey: 'drivenMiles' },
      cell: ({ getValue }) => <span className="text-xs font-bold tabular-nums">{formatReportMiles(getValue())}</span>,
    },
    {
      accessorKey: 'drivenHours',
      header: 'Hours',
      size: 60,
      meta: { label: 'Hours', sortable: true, sortKey: 'drivenHours' },
      cell: ({ getValue }) => <span className="text-xs tabular-nums">{getValue() != null ? formatDrivenHours(getValue()) : '—'}</span>,
    },
    {
      accessorKey: 'paymentAmount',
      header: 'Payment',
      size: 80,
      meta: { label: 'Payment', sortable: false },
      cell: ({ getValue }) => <span className="text-xs tabular-nums">{getValue() != null ? `$${getValue().toFixed(2)}` : '—'}</span>,
    },
    {
      accessorKey: 'payoutAmount',
      header: 'Payout',
      size: 80,
      meta: { label: 'Payout', sortable: false },
      cell: ({ getValue }) => <span className="text-xs tabular-nums">{getValue() != null ? `$${getValue().toFixed(2)}` : '—'}</span>,
    },
  ], []);

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

        {/* Filters Section */}
        <section className="mb-6">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <CardTitle className="text-base font-black">Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {/* Date From */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">From</Label>
                  <Input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} 
                    className="mt-1.5 rounded-xl h-9 text-sm" 
                  />
                </div>
                {/* Date To */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">To</Label>
                  <Input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }} 
                    className="mt-1.5 rounded-xl h-9 text-sm" 
                  />
                </div>
                {/* Customer Select */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Customer
                  </Label>
                  <Popover open={isCustomerSelectOpen} onOpenChange={setIsCustomerSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCustomerSelectOpen}
                        className="w-full mt-1.5 rounded-xl h-9 justify-between font-normal text-sm"
                      >
                        {selectedCustomer ? (
                          <span className="flex items-center gap-2 truncate">
                            {selectedCustomer.customerType === 'BUSINESS' ? (
                              <Building2 className="w-3 h-3 shrink-0" />
                            ) : (
                              <User className="w-3 h-3 shrink-0" />
                            )}
                            <span className="truncate">{selectedCustomer.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select customer...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search customer..."
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingCustomers ? 'Loading...' : 'No customer found.'}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredCustomers.slice(0, 50).map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={() => {
                                  setCustomerId(customer.id === customerId ? '' : customer.id);
                                  setCustomerSearch('');
                                  setIsCustomerSelectOpen(false);
                                  setPage(1);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Check
                                  className={cn(
                                    'h-4 w-4',
                                    customerId === customer.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {customer.customerType === 'BUSINESS' ? (
                                  <Building2 className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <User className="w-3 h-3 text-muted-foreground" />
                                )}
                                <span className="truncate">{customer.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {customer.customerType === 'BUSINESS' ? 'Business' : 'Private'}
                                </span>
                              </CommandItem>
                            ))}
                            {filteredCustomers.length > 50 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                                Showing 50 of {filteredCustomers.length} customers. Refine your search.
                              </div>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Driver Select */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Driver
                  </Label>
                  <Popover open={isDriverSelectOpen} onOpenChange={setIsDriverSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isDriverSelectOpen}
                        className="w-full mt-1.5 rounded-xl h-9 justify-between font-normal text-sm"
                      >
                        {selectedDriver ? (
                          <span className="flex items-center gap-2 truncate">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">{selectedDriver.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select driver...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search driver..."
                          value={driverSearch}
                          onValueChange={setDriverSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingDrivers ? 'Loading...' : 'No driver found.'}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredDrivers.slice(0, 50).map((driver) => (
                              <CommandItem
                                key={driver.id}
                                value={driver.id}
                                onSelect={() => {
                                  setDriverId(driver.id === driverId ? '' : driver.id);
                                  setDriverSearch('');
                                  setIsDriverSelectOpen(false);
                                  setPage(1);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Check
                                  className={cn(
                                    'h-4 w-4',
                                    driverId === driver.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="truncate">{driver.name}</span>
                              </CommandItem>
                            ))}
                            {filteredDrivers.length > 50 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                                Showing 50 of {filteredDrivers.length} drivers. Refine your search.
                              </div>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Service Type */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Service</Label>
                  <Select value={serviceType} onValueChange={(v) => { setServiceType(v); setPage(1); }}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Min Driven Hours */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Hrs</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="0"
                    value={minDrivenHours}
                    onChange={(e) => { setMinDrivenHours(e.target.value); setPage(1); }}
                    className="mt-1.5 rounded-xl h-9 text-sm"
                  />
                </div>
                {/* Max Driven Hours */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Hrs</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="Any"
                    value={maxDrivenHours}
                    onChange={(e) => { setMaxDrivenHours(e.target.value); setPage(1); }}
                    className="mt-1.5 rounded-xl h-9 text-sm"
                  />
                </div>
                {/* Min Miles */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Miles</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={minMiles}
                    onChange={(e) => { setMinMiles(e.target.value); setPage(1); }}
                    className="mt-1.5 rounded-xl h-9 text-sm"
                  />
                </div>
                {/* Max Miles */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Miles</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Any"
                    value={maxMiles}
                    onChange={(e) => { setMaxMiles(e.target.value); setPage(1); }}
                    className="mt-1.5 rounded-xl h-9 text-sm"
                  />
                </div>
                {/* Min Payment */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Payment $</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={minPayment}
                    onChange={(e) => { setMinPayment(e.target.value); setPage(1); }}
                    className="mt-1.5 rounded-xl h-9 text-sm"
                  />
                </div>
                {/* Max Payment */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Payment $</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Any"
                    value={maxPayment}
                    onChange={(e) => { setMaxPayment(e.target.value); setPage(1); }}
                    className="mt-1.5 rounded-xl h-9 text-sm"
                  />
                </div>
                {/* Pickup Address Search */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pickup Address</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Los Angeles"
                    value={pickupSearch}
                    onChange={(e) => { setPickupSearch(e.target.value); setPage(1); }}
                    className="mt-1.5 rounded-xl h-9 text-sm"
                  />
                </div>
                {/* Status Filter */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</Label>
                  <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="BOOKED">Booked</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Group By */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Group By</Label>
                  <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'week' | 'month')}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GROUP_BY_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Sort By */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" />
                    Sort By
                  </Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SORT_BY_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Sort Order */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order</Label>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SORT_ORDER_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={resetFilters} className="rounded-xl">Reset Filters</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Data Table — TanStack Table with resizable columns */}
        <section>
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={data?.displayRows || data?.rows || []}
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
                emptyMessage="No mileage data found. Try adjusting your filters."
              />
            </CardContent>
          </Card>
        </section>
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
