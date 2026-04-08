// components/pages/admin-deliveries.tsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import { 
  useAdminDeliveries,
  formatRelativeTime,
  getStatusColor,
  getServiceTypeLabel,
  formatMiles,
} from '@/hooks/useAdminDeliveries';
import { downloadReport } from '@/hooks/useAdminReports';
import type { 
  DeliveryListItem, 
  DeliveryStatus, 
  AdminDeliveriesQueryParams,
  ServiceType,
  CustomerType,
} from '@/types/delivery';
import {
  LayoutDashboard,
  RefreshCw,
  Download,
  Truck,
  User,
  Building2,
  MapPin,
  Clock,
  AlertTriangle,
  Navigation,
  Search,
  Filter,
  Eye,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  ShieldAlert,
  Activity,
  X,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Status options for filter - matching API statuses
const STATUS_OPTIONS: { value: string; label: string }[] = [
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

// Status configuration for KPI cards
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-800', borderColor: 'border-slate-300 dark:border-slate-700' },
  QUOTED: { label: 'Quoted', color: 'text-slate-700', bgColor: 'bg-slate-50 dark:bg-slate-800/50', borderColor: 'border-slate-200 dark:border-slate-700' },
  LISTED: { label: 'Listed', color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', borderColor: 'border-indigo-200 dark:border-indigo-800' },
  BOOKED: { label: 'Booked', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800' },
  ACTIVE: { label: 'Active', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800' },
  COMPLETED: { label: 'Done', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800' },
  CANCELLED: { label: 'Cancelled', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-900/50', borderColor: 'border-slate-300 dark:border-slate-700' },
  EXPIRED: { label: 'Expired', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  DISPUTED: { label: 'Disputed', color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-900/20', borderColor: 'border-rose-200 dark:border-rose-800' },
};

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
      "inline-flex items-center justify-center px-3 py-2 min-h-[36px] text-[11px] font-semibold rounded-lg border transition-all duration-150",
      active 
        ? activeColor 
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
    )}
  >
    {children}
  </button>
);

const SERVICE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Services' },
  { value: 'HOME_DELIVERY', label: 'Home Delivery' },
  { value: 'BETWEEN_LOCATIONS', label: 'Between Locations' },
  { value: 'SERVICE_PICKUP_RETURN', label: 'Service Pickup/Return' },
];

const CUSTOMER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PRIVATE', label: 'Private' },
];

export default function AdminDeliveriesPage() {
  const { actionItems, signOut } = useAdminActions();
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Debounce search input - 400ms delay
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearchDebouncing, setIsSearchDebouncing] = useState(false);
  
  useEffect(() => {
    // If search is empty or same as debounced, no need to debounce
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
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [disputedOnly, setDisputedOnly] = useState(false);
  const [withoutAssignment, setWithoutAssignment] = useState(false);
  const [requiresOpsConfirmation, setRequiresOpsConfirmation] = useState(false);
  const [complianceMissing, setComplianceMissing] = useState(false);
  const [activeWithoutTracking, setActiveWithoutTracking] = useState(false);
  const [staleTracking, setStaleTracking] = useState(false);
  
  const [page, setPage] = useState(1);
  
  // Reset page to 1 when any filter changes (not page itself)
  const prevFiltersRef = useRef<string>('');
  useEffect(() => {
    const currentFilters = JSON.stringify({
      statusFilter, serviceTypeFilter, customerTypeFilter, debouncedSearch,
      dateFrom, dateTo, urgentOnly, disputedOnly, withoutAssignment,
      requiresOpsConfirmation, complianceMissing, activeWithoutTracking, staleTracking
    });
    
    if (prevFiltersRef.current && prevFiltersRef.current !== currentFilters && page !== 1) {
      setPage(1);
    }
    prevFiltersRef.current = currentFilters;
  }, [statusFilter, serviceTypeFilter, customerTypeFilter, debouncedSearch, dateFrom, dateTo, urgentOnly, disputedOnly, withoutAssignment, requiresOpsConfirmation, complianceMissing, activeWithoutTracking, staleTracking, page]);
  
  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (serviceTypeFilter !== 'all') count++;
    if (customerTypeFilter !== 'all') count++;
    if (debouncedSearch.trim()) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (urgentOnly) count++;
    if (disputedOnly) count++;
    if (withoutAssignment) count++;
    if (requiresOpsConfirmation) count++;
    if (complianceMissing) count++;
    if (activeWithoutTracking) count++;
    if (staleTracking) count++;
    return count;
  }, [statusFilter, serviceTypeFilter, customerTypeFilter, debouncedSearch, dateFrom, dateTo, urgentOnly, disputedOnly, withoutAssignment, requiresOpsConfirmation, complianceMissing, activeWithoutTracking, staleTracking]);
  
  // Build query params
  const queryParams: AdminDeliveriesQueryParams = useMemo(() => {
    const params: AdminDeliveriesQueryParams = {
      page,
      pageSize: 20,
    };
    
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }
    if (serviceTypeFilter && serviceTypeFilter !== 'all') {
      params.serviceType = serviceTypeFilter;
    }
    if (customerTypeFilter && customerTypeFilter !== 'all') {
      params.customerType = customerTypeFilter;
    }
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    if (dateFrom) {
      params.from = dateFrom;
    }
    if (dateTo) {
      params.to = dateTo;
    }
    if (urgentOnly) {
      params.urgentOnly = true;
    }
    if (disputedOnly) {
      params.disputedOnly = true;
    }
    if (withoutAssignment) {
      params.withoutAssignment = true;
    }
    if (requiresOpsConfirmation) {
      params.requiresOpsConfirmation = true;
    }
    if (complianceMissing) {
      params.complianceMissing = true;
    }
    if (activeWithoutTracking) {
      params.activeWithoutTracking = true;
    }
    if (staleTracking) {
      params.staleTracking = true;
    }
    
    return params;
  }, [statusFilter, serviceTypeFilter, customerTypeFilter, debouncedSearch, dateFrom, dateTo, urgentOnly, disputedOnly, withoutAssignment, requiresOpsConfirmation, complianceMissing, activeWithoutTracking, staleTracking, page]);
  
  // Fetch data
  const { data, isLoading, isFetching, isError, error, refetch } = useAdminDeliveries(queryParams);
  
  // Calculate metrics from data - count by all statuses
  const metrics = useMemo(() => {
    if (!data?.items) {
      return {
        DRAFT: 0, QUOTED: 0, LISTED: 0, BOOKED: 0, 
        ACTIVE: 0, COMPLETED: 0, CANCELLED: 0, EXPIRED: 0, DISPUTED: 0,
        total: 0, disputedCount: 0
      };
    }
    
    const counts: Record<string, number> = {
      DRAFT: 0, QUOTED: 0, LISTED: 0, BOOKED: 0, 
      ACTIVE: 0, COMPLETED: 0, CANCELLED: 0, EXPIRED: 0, DISPUTED: 0,
    };
    
    data.items.forEach(d => {
      if (counts[d.status] !== undefined) {
        counts[d.status]++;
      }
    });
    
    return {
      ...counts,
      total: data.items.length,
      disputedCount: data.items.filter(d => d.dispute !== null).length,
    };
  }, [data?.items]);
  
  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Deliveries refreshed');
  }, [refetch]);
  
  const handleExport = useCallback(async (format: string) => {
    try {
      // Build export params from current filters
      const exportParams: Record<string, unknown> = {};
      if (statusFilter && statusFilter !== 'all') exportParams.status = statusFilter;
      if (serviceTypeFilter && serviceTypeFilter !== 'all') exportParams.serviceType = serviceTypeFilter;
      if (customerTypeFilter && customerTypeFilter !== 'all') exportParams.customerType = customerTypeFilter;
      if (debouncedSearch.trim()) exportParams.search = debouncedSearch.trim();
      if (dateFrom) exportParams.from = dateFrom;
      if (dateTo) exportParams.to = dateTo;
      if (urgentOnly) exportParams.urgentOnly = true;
      if (disputedOnly) exportParams.disputedOnly = true;
      if (withoutAssignment) exportParams.withoutAssignment = true;
      if (requiresOpsConfirmation) exportParams.requiresOpsConfirmation = true;
      if (complianceMissing) exportParams.complianceMissing = true;
      if (activeWithoutTracking) exportParams.activeWithoutTracking = true;
      if (staleTracking) exportParams.staleTracking = true;
      
      await downloadReport('deliveries', exportParams, format);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  }, [statusFilter, serviceTypeFilter, customerTypeFilter, debouncedSearch, dateFrom, dateTo, urgentOnly, disputedOnly, withoutAssignment, requiresOpsConfirmation, complianceMissing, activeWithoutTracking, staleTracking]);
  
  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setServiceTypeFilter('all');
    setCustomerTypeFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setDateFrom('');
    setDateTo('');
    setUrgentOnly(false);
    setDisputedOnly(false);
    setWithoutAssignment(false);
    setRequiresOpsConfirmation(false);
    setComplianceMissing(false);
    setActiveWithoutTracking(false);
    setStaleTracking(false);
    setPage(1);
  }, []);
  
  // Status badge component - matching delivery-details style
  const StatusBadge = ({ status }: { status: DeliveryStatus }) => {
    const colors = getStatusColor(status);
    return (
      <Badge className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border',
        colors.bg,
        colors.text,
        colors.border
      )}>
        {status}
      </Badge>
    );
  };
  
  // Delivery card component - matching delivery-details style
  const DeliveryCard = ({ delivery }: { delivery: DeliveryListItem }) => {
    const customerName = delivery.customer.customerType === 'BUSINESS'
      ? delivery.customer.businessName || delivery.customer.contactName || 'Unknown Business'
      : delivery.customer.user?.fullName || delivery.customer.contactName || 'Unknown';
    
    const driverName = delivery.activeAssignment?.driver?.user?.fullName || null;
    const trackingStatus = delivery.tracking?.status || 'NOT_STARTED';
    const drivenMiles = delivery.tracking?.drivenMiles;
    
    return (
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
            {/* Left side - Main info */}
            <div className="flex-1 min-w-0">
              {/* Top row - ID, status, service type */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-slate-800 dark:text-slate-200">
                  {delivery.id.slice(-8).toUpperCase()}
                </div>
                <StatusBadge status={delivery.status} />
                <Badge variant="outline" className="text-[10px] font-medium">
                  {getServiceTypeLabel(delivery.serviceType)}
                </Badge>
                {delivery.scheduling?.isUrgent && (
                  <Badge className="bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    URGENT
                  </Badge>
                )}
                {delivery.dispute && (
                  <Badge className="bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                    <Scale className="w-3 h-3 mr-1" />
                    DISPUTED
                  </Badge>
                )}
                {delivery.tracking?.stale && delivery.status === 'ACTIVE' && (
                  <Badge className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                    STALE TRACKING
                  </Badge>
                )}
              </div>
              
              {/* Route info */}
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white truncate block">
                    {delivery.pickup?.address || 'Pickup not set'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <ArrowRight className="w-3 h-3" />
                    {delivery.dropoff?.address || 'Dropoff not set'}
                  </span>
                </div>
              </div>
              
              {/* Customer & Driver info */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  {delivery.customer.customerType === 'BUSINESS' ? (
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span className="font-medium">{customerName}</span>
                </div>
                {driverName && (
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">{driverName}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatRelativeTime(delivery.updatedAt)}</span>
                </div>
              </div>
              
              {/* Tracking info for active deliveries */}
              {delivery.status === 'ACTIVE' && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">
                      {trackingStatus === 'STARTED' ? 'In Transit' : 'Not Started'}
                    </span>
                  </div>
                  {drivenMiles !== null && drivenMiles !== undefined && (
                    <span className="text-slate-500">{formatMiles(drivenMiles)} driven</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Right side - Actions */}
            <div className="flex flex-wrap gap-2 xl:flex-col">
              <Link to="/admin-delivery-detail" search={{ deliveryId: delivery.id }}>
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
                <Truck className="w-3.5 h-3.5 mr-1" />
                Operations
              </Badge>
              <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                Admin Queue
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Deliveries</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Operational work queue for all delivery requests with filters, status tracking, and compliance oversight.
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

        {/* KPI Row - Interactive status cards */}
        <section className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-5 xl:grid-cols-9 gap-2 mb-6">
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

        {/* Main Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
          {/* Filters Sidebar */}
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 h-fit lg:sticky lg:top-20">
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
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="ID, address, customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (searchDebounceRef.current) {
                          clearTimeout(searchDebounceRef.current);
                        }
                        setDebouncedSearch(searchQuery);
                        setIsSearchDebouncing(false);
                      }
                    }}
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
              
              {/* Service Type & Customer Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Service
                  </label>
                  <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                    <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Customer
                  </label>
                  <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                    <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOMER_TYPE_OPTIONS.map(opt => (
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
              
              {/* Quick Filters - Toggle Style */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Urgency & Issues
                </label>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton 
                    active={urgentOnly} 
                    onClick={() => setUrgentOnly(!urgentOnly)}
                    activeColor="bg-rose-500 text-white border-rose-500"
                  >
                    Urgent
                  </ToggleButton>
                  <ToggleButton 
                    active={disputedOnly} 
                    onClick={() => setDisputedOnly(!disputedOnly)}
                    activeColor="bg-rose-500 text-white border-rose-500"
                  >
                    Disputed
                  </ToggleButton>
                </div>
              </div>
              
              {/* Assignment */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Assignment
                </label>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton 
                    active={withoutAssignment} 
                    onClick={() => setWithoutAssignment(!withoutAssignment)}
                    activeColor="bg-primary text-slate-950 border-primary"
                  >
                    Unassigned
                  </ToggleButton>
                  <ToggleButton 
                    active={requiresOpsConfirmation} 
                    onClick={() => setRequiresOpsConfirmation(!requiresOpsConfirmation)}
                    activeColor="bg-amber-500 text-white border-amber-500"
                  >
                    Needs Ops
                  </ToggleButton>
                </div>
              </div>
              
              {/* Compliance & Tracking */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Compliance
                </label>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton 
                    active={complianceMissing} 
                    onClick={() => setComplianceMissing(!complianceMissing)}
                    activeColor="bg-amber-500 text-white border-amber-500"
                  >
                    Missing
                  </ToggleButton>
                  <ToggleButton 
                    active={activeWithoutTracking} 
                    onClick={() => setActiveWithoutTracking(!activeWithoutTracking)}
                    activeColor="bg-blue-500 text-white border-blue-500"
                  >
                    No Track
                  </ToggleButton>
                  <ToggleButton 
                    active={staleTracking} 
                    onClick={() => setStaleTracking(!staleTracking)}
                    activeColor="bg-orange-500 text-white border-orange-500"
                  >
                    Stale
                  </ToggleButton>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deliveries List */}
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
                      <span className="font-bold text-slate-700 dark:text-slate-300">{data.count}</span> deliveries found
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
                  <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load deliveries</p>
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
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">No deliveries found</p>
                  <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
                  <Button onClick={resetFilters} variant="outline" className="mt-4 rounded-xl">
                    Reset Filters
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Deliveries list */}
            {!isLoading && !isError && data?.items && data.items.length > 0 && (
              <div className="space-y-3">
                {data.items.map(delivery => (
                  <DeliveryCard key={delivery.id} delivery={delivery} />
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
