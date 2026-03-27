// components/pages/admin-report-payments.tsx
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
import { usePaymentsReport, formatReportCurrency, downloadReport } from '@/hooks/useAdminReports';
import { useCustomerLookup } from '@/hooks/useAdminDashboard';
import { useDriverLookup } from '@/hooks/useAdminDeliveries';
import { DynamicReportTable } from '@/components/shared/reports/DynamicReportTable';
import type { PaymentsReportParams, DisplayRow } from '@/types/report';
import {
  CreditCard,
  RefreshCw,
  Download,
  Filter,
  ArrowLeft,
  User,
  Building2,
  ArrowUpDown,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'AUTHORIZED', label: 'Authorized' },
  { value: 'CAPTURED', label: 'Captured' },
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'PREPAID', label: 'Prepaid' },
  { value: 'POSTPAID', label: 'Postpaid' },
];

const SORT_BY_OPTIONS = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'status', label: 'Status' },
  { value: 'paymentType', label: 'Payment Type' },
];

const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: 'Newest First' },
  { value: 'asc', label: 'Oldest First' },
];

const STATUS_COLORS: Record<string, string> = {
  AUTHORIZED: 'bg-blue-50 text-blue-700 border-blue-200',
  CAPTURED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  INVOICED: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  REFUNDED: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function AdminPaymentsReportPage() {
  const { actionItems, signOut } = useAdminActions();

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState('all');
  const [paymentType, setPaymentType] = useState('all');
  const [prepaidOnly, setPrepaidOnly] = useState(false);
  const [postpaidOnly, setPostpaidOnly] = useState(false);
  const [failedOnly, setFailedOnly] = useState(false);
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

  const queryParams: PaymentsReportParams = useMemo(() => {
    const params: PaymentsReportParams = { page, pageSize, sortBy, sortOrder };
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (customerId) params.customerId = customerId;
    if (driverId) params.driverId = driverId;
    if (status && status !== 'all') params.status = status;
    if (paymentType && paymentType !== 'all') params.paymentType = paymentType;
    if (prepaidOnly) params.prepaidOnly = true;
    if (postpaidOnly) params.postpaidOnly = true;
    if (failedOnly) params.failedOnly = true;
    return params;
  }, [dateFrom, dateTo, customerId, driverId, status, paymentType, prepaidOnly, postpaidOnly, failedOnly, sortBy, sortOrder, page, pageSize]);

  const { data, isLoading, isFetching, isError, error, refetch } = usePaymentsReport(queryParams);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Report refreshed');
  }, [refetch]);

  const handleExport = useCallback(async (format: string) => {
    try {
      await downloadReport('payments', queryParams, format);
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
    setPaymentType('all');
    setPrepaidOnly(false);
    setPostpaidOnly(false);
    setFailedOnly(false);
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
      getSearch: (row: DisplayRow) => ({ deliveryId: String(row.deliveryId) }),
    },
  }), []);

  // Custom formatters for specific columns
  const formatters = useMemo(() => ({
    status: (value: unknown) => {
      const statusStr = String(value || '');
      return (
        <Badge className={cn('text-[10px] font-bold border', STATUS_COLORS[statusStr] || STATUS_COLORS.PAID)}>
          {statusStr}
        </Badge>
      );
    },
    paymentType: (value: unknown) => {
      return (
        <Badge variant="outline" className="text-[10px]">
          {String(value || '')}
        </Badge>
      );
    },
    amount: (value: unknown) => {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      return <span className="text-sm font-bold text-slate-900 dark:text-white">{formatReportCurrency(num)}</span>;
    },
  }), []);

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
            <h1 className="text-2xl lg:text-3xl font-black">Payments Report</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Payment oversight with status, amount, provider, and invoice tracking.
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
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</div>
              <div className="text-xl font-black mt-1">{data.summary.totalPayments}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-primary/5 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Total Amount</div>
              <div className="text-xl font-black mt-1">{formatReportCurrency(data.summary.totalAmount)}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg Amount</div>
              <div className="text-xl font-black mt-1">{formatReportCurrency(data.summary.averageAmount)}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-blue-50 dark:bg-blue-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Authorized</div>
              <div className="text-xl font-black mt-1 text-blue-600">{data.summary.authorizedCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-indigo-50 dark:bg-indigo-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Captured</div>
              <div className="text-xl font-black mt-1 text-indigo-600">{data.summary.capturedCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Invoiced</div>
              <div className="text-xl font-black mt-1 text-amber-600">{data.summary.invoicedCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Paid</div>
              <div className="text-xl font-black mt-1 text-emerald-600">{data.summary.paidCount}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Failed</div>
              <div className="text-xl font-black mt-1 text-rose-600">{data.summary.failedCount}</div>
            </Card>
          </section>
        )}

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
                  <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="mt-1.5 rounded-xl h-9 text-sm" />
                </div>
                {/* Date To */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="mt-1.5 rounded-xl h-9 text-sm" />
                </div>
                {/* Customer Select */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Customer
                  </Label>
                  <Popover open={isCustomerSelectOpen} onOpenChange={setIsCustomerSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={isCustomerSelectOpen} className="w-full mt-1.5 rounded-xl h-9 justify-between font-normal text-sm">
                        {selectedCustomer ? (
                          <span className="flex items-center gap-2 truncate">
                            {selectedCustomer.customerType === 'BUSINESS' ? <Building2 className="w-3 h-3 shrink-0" /> : <User className="w-3 h-3 shrink-0" />}
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
                        <CommandInput placeholder="Search customer..." value={customerSearch} onValueChange={setCustomerSearch} />
                        <CommandList>
                          <CommandEmpty>{isLoadingCustomers ? 'Loading...' : 'No customer found.'}</CommandEmpty>
                          <CommandGroup>
                            {filteredCustomers.slice(0, 50).map((customer) => (
                              <CommandItem key={customer.id} value={customer.id} onSelect={() => { setCustomerId(customer.id === customerId ? '' : customer.id); setCustomerSearch(''); setIsCustomerSelectOpen(false); setPage(1); }} className="flex items-center gap-2">
                                <Check className={cn('h-4 w-4', customerId === customer.id ? 'opacity-100' : 'opacity-0')} />
                                {customer.customerType === 'BUSINESS' ? <Building2 className="w-3 h-3 text-muted-foreground" /> : <User className="w-3 h-3 text-muted-foreground" />}
                                <span className="truncate">{customer.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{customer.customerType === 'BUSINESS' ? 'Business' : 'Private'}</span>
                              </CommandItem>
                            ))}
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
                      <Button variant="outline" role="combobox" aria-expanded={isDriverSelectOpen} className="w-full mt-1.5 rounded-xl h-9 justify-between font-normal text-sm">
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
                        <CommandInput placeholder="Search driver..." value={driverSearch} onValueChange={setDriverSearch} />
                        <CommandList>
                          <CommandEmpty>{isLoadingDrivers ? 'Loading...' : 'No driver found.'}</CommandEmpty>
                          <CommandGroup>
                            {filteredDrivers.slice(0, 50).map((driver) => (
                              <CommandItem key={driver.id} value={driver.id} onSelect={() => { setDriverId(driver.id === driverId ? '' : driver.id); setDriverSearch(''); setIsDriverSelectOpen(false); setPage(1); }} className="flex items-center gap-2">
                                <Check className={cn('h-4 w-4', driverId === driver.id ? 'opacity-100' : 'opacity-0')} />
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="truncate">{driver.name}</span>
                              </CommandItem>
                            ))}
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
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Payment Type */}
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</Label>
                  <Select value={paymentType} onValueChange={(v) => { setPaymentType(v); setPage(1); }}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
              {/* Toggle Buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant={prepaidOnly ? "default" : "outline"} size="sm" onClick={() => { setPrepaidOnly(!prepaidOnly); setPostpaidOnly(false); setPage(1); }} className="rounded-xl text-xs">
                  Prepaid Only
                </Button>
                <Button variant={postpaidOnly ? "default" : "outline"} size="sm" onClick={() => { setPostpaidOnly(!postpaidOnly); setPrepaidOnly(false); setPage(1); }} className="rounded-xl text-xs">
                  Postpaid Only
                </Button>
                <Button variant={failedOnly ? "default" : "outline"} size="sm" onClick={() => { setFailedOnly(!failedOnly); setPage(1); }} className="rounded-xl text-xs">
                  Failed Only
                </Button>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={resetFilters} className="rounded-xl">Reset Filters</Button>
              </div>
            </CardContent>
          </Card>
        </section>

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
                emptyIcon={<CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />}
                emptyMessage="No payments found"
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
