// components/pages/admin-disputes.tsx
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { getUser } from '@/lib/tanstack/dataQuery';
import {
  useAdminDisputes,
  useDisputeActions,
  useOpenDispute,
  formatRelativeTime,
  getDisputeStatusColor,
} from '@/hooks/useAdminDisputes';
import { downloadReport } from '@/hooks/useAdminReports';
import type {
  DisputeListItem,
  DisputeStatus,
  AdminDisputesQueryParams,
} from '@/types/dispute';
import {
  Gavel,
  RefreshCw,
  Download,
  Scale,
  AlertCircle,
  Eye,
  ArrowRight,
  Search,
  Filter,
  X,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  MessageSquare,
  Ban,
  Check,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Status options for filter
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

// Status configuration for KPI cards
const STATUS_CONFIG: Record<DisputeStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  OPEN: { label: 'Open', color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-900/20', borderColor: 'border-rose-200 dark:border-rose-800' },
  UNDER_REVIEW: { label: 'In Review', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  RESOLVED: { label: 'Resolved', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800' },
  CLOSED: { label: 'Closed', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-800', borderColor: 'border-slate-300 dark:border-slate-700' },
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
      "inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-all duration-150",
      active
        ? activeColor
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
    )}
  >
    {children}
  </button>
);

export default function AdminDisputesPage() {
  const { actionItems, signOut } = useAdminActions();
  const actorUser = getUser();
  const actorUserId = actorUser?.id;

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

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
  const [legalHoldOnly, setLegalHoldOnly] = useState(false);

  // Dialog states
  const [selectedDispute, setSelectedDispute] = useState<DisputeListItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionDialogType, setActionDialogType] = useState<'note' | 'status' | 'resolve' | 'close' | 'legalHold' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [newStatus, setNewStatus] = useState<DisputeStatus | ''>('');

  // Build query params - only status is passed to API, other filters are client-side
  const queryParams: AdminDisputesQueryParams = useMemo(() => {
    const params: AdminDisputesQueryParams = {};
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter as DisputeStatus;
    }
    return params;
  }, [statusFilter]);

  // Fetch data
  const { data: disputes, isLoading, isFetching, isError, error, refetch } = useAdminDisputes(queryParams);

  // Open dispute mutation
  const openDisputeMutation = useOpenDispute();

  // Dispute actions mutation (for selected dispute)
  const disputeActions = useDisputeActions(selectedDispute?.id || '');

  // Client-side filtering (search and legal hold)
  const filteredDisputes = useMemo(() => {
    if (!disputes) return [];
    return disputes.filter((dispute) => {
      // Search filter
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.toLowerCase();
        const matches =
          dispute.id.toLowerCase().includes(term) ||
          dispute.deliveryId.toLowerCase().includes(term) ||
          dispute.reason.toLowerCase().includes(term) ||
          dispute.delivery?.pickupAddress?.toLowerCase().includes(term) ||
          dispute.delivery?.dropoffAddress?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      // Legal hold filter
      if (legalHoldOnly && !dispute.legalHold) return false;
      return true;
    });
  }, [disputes, debouncedSearch, legalHoldOnly]);

  // Calculate metrics from data
  const metrics = useMemo(() => {
    if (!disputes) {
      return { OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, CLOSED: 0, total: 0, legalHold: 0 };
    }

    const counts: Record<DisputeStatus, number> = {
      OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, CLOSED: 0,
    };

    let legalHoldCount = 0;
    disputes.forEach(d => {
      if (counts[d.status] !== undefined) {
        counts[d.status]++;
      }
      if (d.legalHold) legalHoldCount++;
    });

    return {
      ...counts,
      total: disputes.length,
      legalHold: legalHoldCount,
    };
  }, [disputes]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (debouncedSearch.trim()) count++;
    if (legalHoldOnly) count++;
    return count;
  }, [statusFilter, debouncedSearch, legalHoldOnly]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Disputes refreshed');
  }, [refetch]);

  const handleExport = useCallback(async (format: string) => {
    try {
      // Build export params from current filters
      const exportParams: Record<string, unknown> = {};
      if (statusFilter && statusFilter !== 'all') exportParams.status = statusFilter;
      if (legalHoldOnly) exportParams.legalHold = true;
      
      await downloadReport('disputes', exportParams, format);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  }, [statusFilter, legalHoldOnly]);

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setLegalHoldOnly(false);
  }, []);

  // Open detail dialog
  const openDetailDialog = (dispute: DisputeListItem) => {
    setSelectedDispute(dispute);
    setDetailDialogOpen(true);
  };

  // Open action dialog
  const openActionDialog = (type: typeof actionDialogType) => {
    setActionDialogType(type);
    setActionNote('');
    setNewStatus('');
    setActionDialogOpen(true);
  };

  // Handle action submission
  const handleActionSubmit = () => {
    if (!selectedDispute || !actorUserId) return;

    switch (actionDialogType) {
      case 'note':
        disputeActions.addNote.mutate(
          { note: actionNote, actorUserId },
          {
            onSuccess: () => {
              setActionDialogOpen(false);
              refetch();
            },
          }
        );
        break;
      case 'status':
        if (!newStatus) {
          toast.error('Please select a status');
          return;
        }
        disputeActions.changeStatus.mutate(
          { status: newStatus as DisputeStatus, note: actionNote || undefined, actorUserId },
          {
            onSuccess: () => {
              setActionDialogOpen(false);
              refetch();
            },
          }
        );
        break;
      case 'resolve':
        disputeActions.resolve.mutate(
          { resolutionNote: actionNote, actorUserId },
          {
            onSuccess: () => {
              setActionDialogOpen(false);
              refetch();
            },
          }
        );
        break;
      case 'close':
        disputeActions.close.mutate(
          { closingNote: actionNote, actorUserId },
          {
            onSuccess: () => {
              setActionDialogOpen(false);
              refetch();
            },
          }
        );
        break;
      case 'legalHold':
        disputeActions.legalHold.mutate(
          { legalHold: !selectedDispute.legalHold, note: actionNote || undefined, actorUserId },
          {
            onSuccess: () => {
              setActionDialogOpen(false);
              refetch();
            },
          }
        );
        break;
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: DisputeStatus }) => {
    const config = STATUS_CONFIG[status];
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

  // Dispute card component
  const DisputeCard = ({ dispute }: { dispute: DisputeListItem }) => {
    return (
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
            {/* Left side - Main info */}
            <div className="flex-1 min-w-0">
              {/* Top row - ID, status, legal hold */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-slate-800 dark:text-slate-200">
                  {dispute.id.slice(-8).toUpperCase()}
                </div>
                <StatusBadge status={dispute.status} />
                {dispute.legalHold && (
                  <Badge className="bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                    <Scale className="w-3 h-3 mr-1" />
                    LEGAL HOLD
                  </Badge>
                )}
              </div>

              {/* Reason */}
              <div className="mb-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {dispute.reason}
                </p>
              </div>

              {/* Route info */}
              {dispute.delivery && (
                <div className="flex items-start gap-2 mb-2">
                  <Truck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-semibold text-slate-900 dark:text-white truncate block">
                      {dispute.delivery.pickupAddress || 'Pickup'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <ArrowRight className="w-3 h-3" />
                      {dispute.delivery.dropoffAddress || 'Dropoff'}
                    </span>
                  </div>
                </div>
              )}

              {/* Delivery ID & Time */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">Delivery: {dispute.deliveryId.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatRelativeTime(dispute.openedAt || dispute.createdAt)}</span>
                </div>
                {dispute._count?.notes > 0 && (
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    <span>{dispute._count.notes} notes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex flex-wrap gap-2 xl:flex-col">
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openDetailDialog(dispute)}>
                <Eye className="w-3.5 h-3.5 mr-1" />
                View
              </Button>
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
              <Badge variant="outline" className="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                <Gavel className="w-3.5 h-3.5 mr-1" />
                Disputes
              </Badge>
              <Badge variant="outline" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                Resolution Queue
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Dispute Management</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Review and resolve issues tied to deliveries. Track status, manage legal holds, and document resolution notes.
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
        <section className="grid grid-cols-4 gap-2 mb-6">
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
                {metrics[status as DisputeStatus] ?? 0}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">
                {config.label}
              </div>
            </button>
          ))}
        </section>

        {/* Legal Hold Banner */}
        {metrics.legalHold > 0 && (
          <section className="mb-6">
            <Card className="rounded-xl border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Scale className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Legal Hold Cases</div>
                    <div className="text-xl font-black text-indigo-700 dark:text-indigo-300">{metrics.legalHold} disputes</div>
                  </div>
                </div>
                <ToggleButton
                  active={legalHoldOnly}
                  onClick={() => setLegalHoldOnly(!legalHoldOnly)}
                  activeColor="bg-indigo-500 text-white border-indigo-500"
                >
                  Filter Legal Hold
                </ToggleButton>
              </CardContent>
            </Card>
          </section>
        )}

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
                    placeholder="ID, delivery, reason..."
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

              {/* Quick Filters */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Quick Filters
                </label>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton
                    active={legalHoldOnly}
                    onClick={() => setLegalHoldOnly(!legalHoldOnly)}
                    activeColor="bg-indigo-500 text-white border-indigo-500"
                  >
                    Legal Hold
                  </ToggleButton>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disputes List */}
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
                  <span className="font-bold text-slate-700 dark:text-slate-300">{filteredDisputes.length}</span>
                  {debouncedSearch || legalHoldOnly ? ' filtered' : ''} of {disputes?.length || 0} disputes
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
                      </div>
                      <Skeleton className="h-4 w-3/4 mt-3" />
                      <Skeleton className="h-4 w-full mt-2" />
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
                  <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load disputes</p>
                  <p className="text-rose-600 dark:text-rose-400 text-sm mt-1">{error?.message || 'Unknown error'}</p>
                  <Button onClick={() => refetch()} variant="outline" className="mt-4 rounded-xl">
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {!isLoading && !isError && filteredDisputes.length === 0 && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardContent className="p-8 text-center">
                  <Gavel className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">No disputes found</p>
                  <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
                  <Button onClick={resetFilters} variant="outline" className="mt-4 rounded-xl">
                    Reset Filters
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Disputes list */}
            {!isLoading && !isError && filteredDisputes.length > 0 && (
              <div className="space-y-3">
                {filteredDisputes.map(dispute => (
                  <DisputeCard key={dispute.id} dispute={dispute} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-3">
              Dispute {selectedDispute?.id.slice(-8).toUpperCase()}
              {selectedDispute && <StatusBadge status={selectedDispute.status} />}
              {selectedDispute?.legalHold && (
                <Badge className="bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                  <Scale className="w-3 h-3 mr-1" />
                  Legal Hold
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              View details and manage this dispute case.
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <div className="space-y-4">
              {/* Reason */}
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reason</Label>
                <p className="text-sm font-medium mt-1">{selectedDispute.reason}</p>
              </div>

              {/* Delivery */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Delivery ID</Label>
                  <Link
                    to="/admin-delivery-detail"
                    search={{ deliveryId: selectedDispute.deliveryId }}
                    className="text-sm font-medium text-primary hover:underline mt-1 block"
                  >
                    {selectedDispute.deliveryId.slice(-8).toUpperCase()}
                  </Link>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Opened At</Label>
                  <p className="text-sm mt-1">{formatRelativeTime(selectedDispute.openedAt || selectedDispute.createdAt)}</p>
                </div>
              </div>

              {/* Route */}
              {selectedDispute.delivery && (
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Route</Label>
                  <div className="flex items-start gap-2 mt-1">
                    <Truck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-medium">{selectedDispute.delivery.pickupAddress}</span>
                      <span className="flex items-center gap-1 mt-0.5 text-slate-500">
                        <ArrowRight className="w-3 h-3" />
                        {selectedDispute.delivery.dropoffAddress}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedDispute.notes && selectedDispute.notes.length > 0 && (
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Notes ({selectedDispute.notes.length})
                  </Label>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {selectedDispute.notes.map(note => (
                      <div key={note.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <p className="text-sm">{note.note}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatRelativeTime(note.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openActionDialog('note')}>
                  <MessageSquare className="w-3.5 h-3.5 mr-1" />
                  Add Note
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openActionDialog('status')}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Change Status
                </Button>
                {selectedDispute.status !== 'RESOLVED' && (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openActionDialog('resolve')}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Resolve
                  </Button>
                )}
                {selectedDispute.status !== 'CLOSED' && (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openActionDialog('close')}>
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    Close
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => openActionDialog('legalHold')}
                >
                  <Scale className="w-3.5 h-3.5 mr-1" />
                  {selectedDispute.legalHold ? 'Remove Hold' : 'Legal Hold'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black">
              {actionDialogType === 'note' && 'Add Note'}
              {actionDialogType === 'status' && 'Change Status'}
              {actionDialogType === 'resolve' && 'Resolve Dispute'}
              {actionDialogType === 'close' && 'Close Dispute'}
              {actionDialogType === 'legalHold' && (selectedDispute?.legalHold ? 'Remove Legal Hold' : 'Apply Legal Hold')}
            </DialogTitle>
            <DialogDescription>
              {actionDialogType === 'note' && 'Add an admin note to this dispute.'}
              {actionDialogType === 'status' && 'Update the dispute status.'}
              {actionDialogType === 'resolve' && 'Mark this dispute as resolved.'}
              {actionDialogType === 'close' && 'Close this dispute case.'}
              {actionDialogType === 'legalHold' && 'Toggle legal hold status for this dispute.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionDialogType === 'status' && (
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">New Status</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as DisputeStatus)}>
                  <SelectTrigger className="mt-2 rounded-xl">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {actionDialogType === 'resolve' ? 'Resolution Note' : actionDialogType === 'close' ? 'Closing Note' : 'Note'}
              </Label>
              <Textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Enter note..."
                className="mt-2 rounded-xl"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleActionSubmit}
              disabled={disputeActions.isAnyPending}
              className="bg-primary text-slate-950 rounded-xl"
            >
              {disputeActions.isAnyPending && (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              )}
              <Check className="w-4 h-4 mr-1" />
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
