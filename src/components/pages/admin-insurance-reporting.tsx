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
import { useInsuranceMileageReport, formatReportDate, formatReportMiles, downloadReport } from '@/hooks/useAdminReports';
import { useCustomerLookup } from '@/hooks/useAdminDashboard';
import { useDriverLookup } from '@/hooks/useAdminDeliveries';
import type { InsuranceMileageReportParams, InsuranceMileageReportRow } from '@/types/report';
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
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

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
    return params;
  }, [dateFrom, dateTo, customerId, driverId, groupBy, serviceType, sortBy, sortOrder, page, pageSize]);

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
    setSortBy('startedAt');
    setSortOrder('desc');
    setPage(1);
    setCustomerSearch('');
    setDriverSearch('');
  }, []);

  const ReportRow = ({ row }: { row: InsuranceMileageReportRow }) => (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
      <td className="px-4 py-3">
        <Link
          to="/admin-delivery-detail"
          search={{ deliveryId: row.deliveryId }}
          className="text-sm font-black text-primary hover:underline"
        >
          {row.deliveryId.slice(-8).toUpperCase()}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="text-[10px]">
          {row.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
        {formatReportMiles(row.drivenMiles)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {formatReportDate(row.startedAt)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {formatReportDate(row.stoppedAt)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
        {row.delivery?.pickupAddress && (
          <div className="max-w-[150px] truncate">{row.delivery.pickupAddress}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
        {row.assignedDriver?.fullName || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {row.period}
      </td>
    </tr>
  );

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
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleExport('csv')}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleExport('xlsx')}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Excel
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleExport('pdf')}>
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button onClick={handleRefresh} disabled={isFetching} size="sm" className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </section>

        {data?.summary && (
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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

        {/* Data Table */}
        <section>
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
              ) : isError ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                  <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load report</p>
                  <Button onClick={() => refetch()} variant="outline" className="mt-4 rounded-xl">Try Again</Button>
                </div>
              ) : data?.rows?.length === 0 ? (
                <div className="p-8 text-center">
                  <Car className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">No mileage data found</p>
                  <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Delivery</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Miles</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Started</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Stopped</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Route</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Driver</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.rows?.map(row => <ReportRow key={row.id} row={row} />)}
                    </tbody>
                  </table>
                </div>
              )}

              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Showing {((data.pagination.page - 1) * data.pagination.pageSize) + 1} - {Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.totalRows)} of {data.pagination.totalRows}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1} className="rounded-xl"><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="text-xs text-slate-500">Page {page} of {data.pagination.totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.totalPages} className="rounded-xl"><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
