// components/pages/admin-payments.tsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import { useAdminPayments, usePaymentActions } from '@/hooks/useAdminPayments';
import { downloadReport } from '@/hooks/useAdminReports';
import { getUser } from '@/lib/tanstack/dataQuery';
import type { 
  PaymentListItem, 
  PaymentStatus,
  PaymentType,
  PaymentProvider,
  AdminPaymentsQueryParams,
  MarkInvoicedRequest,
  MarkPaidRequest,
  MarkPayoutPaidRequest,
} from '@/types/payment';
import {
  DollarSign,
  RefreshCw,
  Download,
  CreditCard,
  FileText,
  User,
  Building2,
  Clock,
  Search,
  Filter,
  Eye,
  ArrowRight,
  AlertCircle,
  Truck,
  CheckCircle,
  XCircle,
  Calendar,
  Wallet,
  Receipt,
  Banknote,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Status options for filter
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'PAID', label: 'Paid' },
  { value: 'AUTHORIZED', label: 'Authorized' },
  { value: 'CAPTURED', label: 'Captured' },
  { value: 'VOIDED', label: 'Voided' },
  { value: 'REFUNDED', label: 'Refunded' },
];

// Status configuration for KPI cards
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  INVOICED: { label: 'Invoiced', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  PAID: { label: 'Paid', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800' },
  AUTHORIZED: { label: 'Authorized', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800' },
  CAPTURED: { label: 'Captured', color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', borderColor: 'border-indigo-200 dark:border-indigo-800' },
  VOIDED: { label: 'Voided', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-900/50', borderColor: 'border-slate-300 dark:border-slate-700' },
  REFUNDED: { label: 'Refunded', color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-900/20', borderColor: 'border-rose-200 dark:border-rose-800' },
};

const PAYMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'POSTPAID', label: 'Postpaid' },
  { value: 'PREPAID', label: 'Prepaid' },
];

const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Providers' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'STRIPE', label: 'Stripe' },
];

// Toggle button component
const ToggleButton = ({ 
  active, 
  onClick, 
  children,
  activeColor = 'bg-primary text-slate-950',
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  activeColor?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-all duration-150",
      active 
        ? activeColor 
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
    )}
  >
    {children}
  </button>
);

// Format currency
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toFixed(2)}`;
}

// Format relative time
function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get status color classes
function getStatusColor(status: PaymentStatus) {
  return STATUS_CONFIG[status] || {
    label: status,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
    borderColor: 'border-slate-200 dark:border-slate-700',
  };
}

export default function AdminPaymentsPage() {
  const { actionItems, signOut } = useAdminActions();
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Debounce search input - 400ms delay
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearchDebouncing, setIsSearchDebouncing] = useState(false);
  
  useEffect(() => {
    if (searchQuery === debouncedSearch) {
      setIsSearchDebouncing(false);
      return;
    }
    
    setIsSearchDebouncing(true);
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setIsSearchDebouncing(false);
    }, 400);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, debouncedSearch]);
  
  // Quick filter toggles
  const [invoicedOnly, setInvoicedOnly] = useState(false);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  
  const [page, setPage] = useState(1);
  
  // Reset page to 1 when any filter changes
  const prevFiltersRef = useRef<string>('');
  useEffect(() => {
    const currentFilters = JSON.stringify({
      statusFilter, paymentTypeFilter, providerFilter, debouncedSearch,
      dateFrom, dateTo, invoicedOnly, unpaidOnly,
    });
    
    if (prevFiltersRef.current && prevFiltersRef.current !== currentFilters && page !== 1) {
      setPage(1);
    }
    prevFiltersRef.current = currentFilters;
  }, [statusFilter, paymentTypeFilter, providerFilter, debouncedSearch, dateFrom, dateTo, invoicedOnly, unpaidOnly, page]);
  
  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (paymentTypeFilter !== 'all') count++;
    if (providerFilter !== 'all') count++;
    if (debouncedSearch.trim()) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (invoicedOnly) count++;
    if (unpaidOnly) count++;
    return count;
  }, [statusFilter, paymentTypeFilter, providerFilter, debouncedSearch, dateFrom, dateTo, invoicedOnly, unpaidOnly]);
  
  // Build query params
  const queryParams: AdminPaymentsQueryParams = useMemo(() => {
    const params: AdminPaymentsQueryParams = {
      page,
      pageSize: 20,
    };
    
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter as PaymentStatus;
    }
    if (paymentTypeFilter && paymentTypeFilter !== 'all') {
      params.paymentType = paymentTypeFilter as PaymentType;
    }
    if (providerFilter && providerFilter !== 'all') {
      params.provider = providerFilter as PaymentProvider;
    }
    if (debouncedSearch.trim()) {
      // Search could be customerId or deliveryId
      if (debouncedSearch.startsWith('cmmcust')) {
        params.customerId = debouncedSearch.trim();
      } else if (debouncedSearch.startsWith('cmmpec') || debouncedSearch.startsWith('cmmdel')) {
        params.deliveryId = debouncedSearch.trim();
      }
    }
    if (dateFrom) {
      params.from = new Date(dateFrom).toISOString();
    }
    if (dateTo) {
      params.to = new Date(dateTo + 'T23:59:59').toISOString();
    }
    if (invoicedOnly) {
      params.invoicedOnly = true;
    }
    if (unpaidOnly) {
      params.unpaidOnly = true;
    }
    
    return params;
  }, [statusFilter, paymentTypeFilter, providerFilter, debouncedSearch, dateFrom, dateTo, invoicedOnly, unpaidOnly, page]);
  
  // Fetch data
  const { data, isLoading, isFetching, isError, error, refetch } = useAdminPayments(queryParams);
  
  // Calculate metrics from data
  const metrics = useMemo(() => {
    if (!data?.items) {
      return {
        INVOICED: 0, PAID: 0, AUTHORIZED: 0, CAPTURED: 0, VOIDED: 0, REFUNDED: 0,
        total: 0, totalAmount: 0,
      };
    }
    
    const counts: Record<string, number> = {
      INVOICED: 0, PAID: 0, AUTHORIZED: 0, CAPTURED: 0, VOIDED: 0, REFUNDED: 0,
    };
    
    let totalAmount = 0;
    data.items.forEach(p => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
      totalAmount += p.amount;
    });
    
    return {
      ...counts,
      total: data.items.length,
      totalAmount,
    };
  }, [data?.items]);
  
  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Payments refreshed');
  }, [refetch]);
  
  const handleExport = useCallback(async (format: string) => {
    try {
      // Build export params from current filters
      const exportParams: Record<string, unknown> = {};
      if (statusFilter && statusFilter !== 'all') exportParams.status = statusFilter;
      if (paymentTypeFilter && paymentTypeFilter !== 'all') exportParams.paymentType = paymentTypeFilter;
      if (providerFilter && providerFilter !== 'all') exportParams.provider = providerFilter;
      if (debouncedSearch.trim()) exportParams.search = debouncedSearch.trim();
      if (dateFrom) exportParams.from = dateFrom;
      if (dateTo) exportParams.to = dateTo;
      if (invoicedOnly) exportParams.invoicedOnly = true;
      if (unpaidOnly) exportParams.unpaidOnly = true;
      
      await downloadReport('payments', exportParams, format);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  }, [statusFilter, paymentTypeFilter, providerFilter, debouncedSearch, dateFrom, dateTo, invoicedOnly, unpaidOnly]);
  
  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setPaymentTypeFilter('all');
    setProviderFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setDateFrom('');
    setDateTo('');
    setInvoicedOnly(false);
    setUnpaidOnly(false);
    setPage(1);
  }, []);
  
  // Status badge component
  const StatusBadge = ({ status }: { status: PaymentStatus }) => {
    const config = getStatusColor(status);
    return (
      <Badge className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border',
        config.bgColor,
        config.color,
        config.borderColor
      )}>
        {config.label}
      </Badge>
    );
  };
  
  // Payment card component
  const PaymentCard = ({ payment }: { payment: PaymentListItem }) => {
    const customerName = payment.delivery.customer.customerType === 'BUSINESS'
      ? payment.delivery.customer.businessName || payment.delivery.customer.contactName || 'Unknown Business'
      : payment.delivery.customer.contactName || 'Unknown';
    
    return (
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
            {/* Left side - Main info */}
            <div className="flex-1 min-w-0">
              {/* Top row - ID, status, type */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-slate-800 dark:text-slate-200">
                  {payment.id.slice(-8).toUpperCase()}
                </div>
                <StatusBadge status={payment.status} />
                <Badge variant="outline" className="text-[10px] font-medium">
                  {payment.paymentType}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-medium">
                  {payment.provider}
                </Badge>
                {payment.invoiceId && (
                  <Badge className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-[10px] font-medium border border-purple-200 dark:border-purple-800">
                    <Receipt className="w-3 h-3 mr-1" />
                    {payment.invoiceId}
                  </Badge>
                )}
              </div>
              
              {/* Amount and delivery */}
              <div className="flex items-start gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              </div>
              
              {/* Delivery route */}
              <div className="flex items-start gap-2 mb-2">
                <Truck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium text-slate-800 dark:text-white truncate block">
                    {payment.delivery.pickupAddress || 'Pickup'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <ArrowRight className="w-3 h-3" />
                    {payment.delivery.dropoffAddress || 'Dropoff'}
                  </span>
                </div>
              </div>
              
              {/* Customer info */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  {payment.delivery.customer.customerType === 'BUSINESS' ? (
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span className="font-medium">{customerName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatRelativeTime(payment.updatedAt)}</span>
                </div>
              </div>
              
              {/* Payout info for postpaid */}
              {payment.paymentType === 'POSTPAID' && payment.delivery.payout && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">Payout: {formatCurrency(payment.delivery.payout.netAmount)}</span>
                    <Badge className={cn(
                      "text-[9px] ml-1",
                      payment.delivery.payout.status === 'PAID' 
                        ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300" 
                        : "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                    )}>
                      {payment.delivery.payout.status}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            
            {/* Right side - Actions */}
            <div className="flex flex-wrap gap-2 xl:flex-col">
              <Link to="/admin-payment-detail" search={{ paymentId: payment.id }}>
                <Button size="sm" variant="outline" className="rounded-xl">
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  View Details
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10 border-primary/25 text-primary-foreground">
                <DollarSign className="w-3.5 h-3.5 mr-1" />
                Finance
              </Badge>
              <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                Payment Management
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Payments</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Payment tracking, invoicing, and payout management for all delivery transactions.
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

        {/* KPI Row - Status Cards */}
        <section className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer",
                statusFilter === status 
                  ? `${config.bgColor} ${config.borderColor} ring-2 ring-primary/30` 
                  : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              )}
            >
              <div className={cn("text-xl font-black leading-none", config.color)}>
                {metrics[status as keyof typeof metrics] ?? 0}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">
                {config.label}
              </div>
            </button>
          ))}
        </section>

        {/* Total amount banner */}
        <section className="mb-6">
          <Card className="rounded-xl border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Banknote className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Amount (Current Page)</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(metrics.totalAmount)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Payments</div>
                <div className="text-xl font-black text-slate-900 dark:text-white">{metrics.total}</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Main Grid */}
        <section className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
          {/* Filters Sidebar */}
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 h-fit xl:sticky xl:top-24">
            <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-black">Filters</CardTitle>
                  {activeFilterCount > 0 && (
                    <Badge className="bg-primary text-slate-950 text-[10px] px-2 py-0.5 rounded-full">
                      {activeFilterCount}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetFilters}
                  disabled={activeFilterCount === 0}
                  className="text-xs text-primary disabled:opacity-50"
                >
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                  Search (Customer/Delivery ID)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="cmmcust... or cmmpec..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      "pl-9 rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm",
                      isSearchDebouncing && "pr-14",
                      searchQuery && !isSearchDebouncing && "pr-9"
                    )}
                  />
                  {isSearchDebouncing && (
                    <div className="absolute right-9 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {searchQuery && !isSearchDebouncing && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedSearch('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Status Dropdown */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Payment Type & Provider */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Type
                  </label>
                  <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                    <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Provider
                  </label>
                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm"
                  />
                </div>
              </div>
              
              {/* Quick Filters */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Quick Filters
                </label>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton 
                    active={invoicedOnly} 
                    onClick={() => setInvoicedOnly(!invoicedOnly)}
                    activeColor="bg-amber-500 text-white border-amber-500"
                  >
                    Invoiced Only
                  </ToggleButton>
                  <ToggleButton 
                    active={unpaidOnly} 
                    onClick={() => setUnpaidOnly(!unpaidOnly)}
                    activeColor="bg-rose-500 text-white border-rose-500"
                  >
                    Unpaid Only
                  </ToggleButton>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments List */}
          <div className="space-y-4">
            {/* Results count and loading indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(isFetching || isSearchDebouncing) && !isLoading && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-primary font-medium">
                      {isSearchDebouncing ? 'Waiting...' : 'Loading...'}
                    </span>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  {data?.count !== undefined && (
                    <span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{data.count}</span> payments found
                    </span>
                  )}
                </p>
              </div>
              {activeFilterCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                </Badge>
              )}
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="rounded-2xl border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Skeleton className="h-6 w-20 rounded" />
                        <Skeleton className="h-6 w-16 rounded" />
                        <Skeleton className="h-6 w-24 rounded" />
                      </div>
                      <Skeleton className="h-8 w-32 mt-3" />
                      <Skeleton className="h-4 w-full mt-3" />
                      <Skeleton className="h-4 w-3/4 mt-2" />
                      <div className="flex gap-4 mt-3">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Error state */}
            {isError && (
              <Card className="rounded-2xl border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10">
                <CardContent className="p-6 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                  <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load payments</p>
                  <p className="text-rose-600 dark:text-rose-400 text-sm mt-1">{error?.message || 'Unknown error'}</p>
                  <Button onClick={() => refetch()} variant="outline" className="mt-4 rounded-xl">
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {!isLoading && !isError && data?.items?.length === 0 && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardContent className="p-8 text-center">
                  <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">No payments found</p>
                  <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
                  <Button onClick={resetFilters} variant="outline" className="mt-4 rounded-xl">
                    Reset Filters
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Payments list */}
            {!isLoading && !isError && data?.items && data.items.length > 0 && (
              <div className="space-y-4">
                {data.items.map(payment => (
                  <PaymentCard key={payment.id} payment={payment} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {data && data.items.length > 0 && data.count > data.pageSize && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-xl"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-500">
                  Page {page} of {Math.ceil(data.count / data.pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(data.count / data.pageSize)}
                  className="rounded-xl"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
