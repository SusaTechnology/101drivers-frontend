// components/pages/admin-report-deliveries.tsx
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
import { useDeliveriesReport, downloadReport } from '@/hooks/useAdminReports';
import { useCustomerLookup } from '@/hooks/useAdminDashboard';
import { useDriverLookup } from '@/hooks/useAdminDeliveries';
import { DynamicReportTable } from '@/components/shared/reports/DynamicReportTable';
import type { DeliveriesReportParams, DisplayRow } from '@/types/report';
import {
  Truck,
  RefreshCw,
  Download,
  Filter,
  ArrowLeft,
  User,
  AlertTriangle,
  Scale,
  Building2,
  ArrowUpDown,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'LISTED', label: 'Listed' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DISPUTED', label: 'Disputed' },
];

const SERVICE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Services' },
  { value: 'HOME_DELIVERY', label: 'Home Delivery' },
  { value: 'BETWEEN_LOCATIONS', label: 'Between Locations' },
  { value: 'SERVICE_PICKUP_RETURN', label: 'Service Pickup/Return' },
];

const CREATED_BY_ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'PRIVATE_CUSTOMER', label: 'Private Customer' },
  { value: 'BUSINESS_CUSTOMER', label: 'Business Customer' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'ADMIN', label: 'Admin' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'status', label: 'Status' },
  { value: 'serviceType', label: 'Service Type' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
  DISPUTED: 'bg-rose-50 text-rose-700 border-rose-200',
  BOOKED: 'bg-blue-50 text-blue-700 border-blue-200',
  DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  QUOTED: 'bg-slate-50 text-slate-600 border-slate-200',
  LISTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  EXPIRED: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function AdminDeliveriesReportPage() {
  const { actionItems, signOut } = useAdminActions();

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState('all');
  const [serviceType, setServiceType] = useState('all');
  const [createdByRole, setCreatedByRole] = useState('all');
  const [isUrgent, setIsUrgent] = useState(false);
  const [requiresOpsConfirmation, setRequiresOpsConfirmation] = useState(false);
  const [disputedOnly, setDisputedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
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
  const queryParams: DeliveriesReportParams = useMemo(() => {
    const params: DeliveriesReportParams = { page, pageSize, sortBy, sortOrder };
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (customerId) params.customerId = customerId;
    if (driverId) params.driverId = driverId;
    if (status && status !== 'all') params.status = status;
    if (serviceType && serviceType !== 'all') params.serviceType = serviceType;
    if (createdByRole && createdByRole !== 'all') params.createdByRole = createdByRole;
    if (isUrgent) params.isUrgent = true;
    if (requiresOpsConfirmation) params.requiresOpsConfirmation = true;
    if (disputedOnly) params.disputedOnly = true;
    return params;
  }, [dateFrom, dateTo, customerId, driverId, status, serviceType, createdByRole, isUrgent, requiresOpsConfirmation, disputedOnly, page, pageSize, sortBy, sortOrder]);

  // Fetch data
  const { data, isLoading, isFetching, isError, error, refetch } = useDeliveriesReport(queryParams);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Report refreshed');
  }, [refetch]);

  const handleExport = useCallback(async (format: string) => {
    try {
      await downloadReport('deliveries', queryParams, format);
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
    setStatus('all');
    setServiceType('all');
    setCreatedByRole('all');
    setIsUrgent(false);
    setRequiresOpsConfirmation(false);
    setDisputedOnly(false);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    setCustomerSearch('');
    setDriverSearch('');
  }, []);

  // Link configuration for clickable cells
  const linkConfig = useMemo(() => ({
    deliveryId: {
      path: '/admin-delivery-detail',
      getSearch: (row: DisplayRow) => ({ deliveryId: String(row.deliveryId || row.id) }),
    },
  }), []);

  // Custom formatters for specific columns
  const formatters = useMemo(() => ({
    status: (value: unknown) => {
      const statusStr = String(value || '');
      return (
        <Badge className={cn('text-[10px] font-bold border', STATUS_COLORS[statusStr] || STATUS_COLORS.DRAFT)}>
          {statusStr}
        </Badge>
      );
    },
    flags: (value: unknown, row: DisplayRow) => {
      const flags: React.ReactNode[] = [];
      if (row.isUrgent) {
        flags.push(
          <Badge key="urgent" className="bg-rose-100 text-rose-700 text-[9px] px-1.5 py-0.5">
            <AlertTriangle className="w-3 h-3 mr-0.5" />
            Urgent
          </Badge>
        );
      }
      if (row.hasDispute) {
        flags.push(
          <Badge key="disputed" className="bg-rose-100 text-rose-700 text-[9px] px-1.5 py-0.5">
            <Scale className="w-3 h-3 mr-0.5" />
            Disputed
          </Badge>
        );
      }
      return flags.length > 0 ? <div className="flex items-center gap-1">{flags}</div> : <span className="text-xs text-slate-400">—</span>;
    },
  }), []);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Link to="/admin-reports" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Reports
              </Link>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Deliveries Report</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Delivery volume, lifecycle outcomes, service type distribution, and dealer/driver activity.
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
            <Button
              onClick={handleRefresh}
              disabled={isFetching}
              size="sm"
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </section>

        {/* Summary Cards */}
        {data?.summary && (
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</div>
              <div className="text-xl font-black mt-1">{data.summary.totalDeliveries}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Completed</div>
              <div className="text-xl font-black mt-1 text-green-600">{data.summary.completedCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Urgent</div>
              <div className="text-xl font-black mt-1 text-rose-600">{data.summary.urgentCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Disputed</div>
              <div className="text-xl font-black mt-1 text-rose-600">{data.summary.disputedCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Payment</div>
              <div className="text-xl font-black mt-1 text-blue-600">{data.summary.activePaymentCount}</div>
            </Card>
          </section>
        )}

        {/* Filters */}
        <section className="mb-6">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <CardTitle className="text-base font-black">Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
                          <span className="text-muted-foreground">Select...</span>
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
                                Showing 50 of {filteredCustomers.length}. Refine search.
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
                          <span className="text-muted-foreground">Select...</span>
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
                                Showing 50 of {filteredDrivers.length}. Refine search.
                              </div>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Status */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</Label>
                  <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Service Type */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Service</Label>
                  <Select value={serviceType} onValueChange={(v) => { setServiceType(v); setPage(1); }}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Created By Role */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created By</Label>
                  <Select value={createdByRole} onValueChange={(v) => { setCreatedByRole(v); setPage(1); }}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATED_BY_ROLE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
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
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Sort Order */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order</Label>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Newest First</SelectItem>
                      <SelectItem value="asc">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Toggle Filters */}
                <div className="flex items-end gap-2">
                  <Button
                    variant={isUrgent ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setIsUrgent(!isUrgent); setPage(1); }}
                    className="rounded-xl text-xs h-9"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Urgent
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant={requiresOpsConfirmation ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setRequiresOpsConfirmation(!requiresOpsConfirmation); setPage(1); }}
                    className="rounded-xl text-xs h-9"
                  >
                    Ops Confirm
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant={disputedOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDisputedOnly(!disputedOnly); setPage(1); }}
                    className="rounded-xl text-xs h-9"
                  >
                    <Scale className="w-3 h-3 mr-1" />
                    Disputed
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={resetFilters} className="rounded-xl">
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Report Table */}
        <section>
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              <DynamicReportTable
                columns={data?.columns || []}
                displayRows={data?.displayRows || []}
                isLoading={isLoading}
                isError={isError}
                errorMessage={error?.message || 'Failed to load report'}
                pagination={data?.pagination}
                currentPage={page}
                onPageChange={setPage}
                onRetry={() => refetch()}
                emptyIcon={<Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />}
                emptyMessage="No deliveries found"
                linkConfig={linkConfig}
                formatters={formatters}
                statusColors={STATUS_COLORS}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
