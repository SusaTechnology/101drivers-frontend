// components/pricing/PricingConfigList.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Tag,
  Layers,
  Calculator,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserPlus,
  Users,
  Crown,
  Clock,
  ArrowRight,
  ShieldCheck,
  Percent,
  Receipt,
  Route,
  FileText,
  CircleDot,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useDataQuery,
  useDataMutation,
  getUser,
} from '@/lib/tanstack/dataQuery';
import {
  useSetDefaultPricingConfig,
  useTogglePricingConfigStatus,
} from '@/hooks/pricing/usePricingConfigs';
import type { PricingConfig, PricingMode, PricingCustomer, PricingTier, CategoryRule } from '@/types/pricing';

// Types for customers (simplified)
interface Customer {
  id: string;
  businessName: string | null;
  contactName: string;
  customerType: 'BUSINESS' | 'PRIVATE';
  user: {
    fullName: string;
    email: string;
  };
  pricingConfigId?: string;
}

interface PricingConfigListProps {
  configs: PricingConfig[];
  isLoading?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string, isActive: boolean) => void;
  onSetDefault?: (id: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Mode badge styles
const modeBadgeStyles: Record<PricingMode, { icon: React.ElementType; className: string; label: string }> = {
  CATEGORY_ABC: {
    icon: Tag,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    label: 'Category A/B/C',
  },
  FLAT_TIER: {
    icon: Layers,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    label: 'Flat Tier',
  },
  PER_MILE: {
    icon: Calculator,
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    label: 'Per Mile',
  },
};

// Category color mapping
const categoryColors: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  B: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  C: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ---------- Helper: format date ----------
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------- Detail Field Row ----------
function DetailField({ label, value, icon: Icon, children }: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ElementType;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm shrink-0">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-right font-semibold text-slate-900 dark:text-white text-sm">
        {children ?? value ?? <span className="text-slate-400">&mdash;</span>}
      </div>
    </div>
  );
}

// ---------- Financial Detail Section (mode-aware) ----------
function FinancialSection({ config }: { config: PricingConfig }) {
  const isCategoryABC = config.pricingMode === 'CATEGORY_ABC';
  const isFlatTier = config.pricingMode === 'FLAT_TIER';

  return (
    <div className="space-y-1">
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
        {isCategoryABC ? 'Common Fees & Settings' : 'Financial Details'}
      </h4>
      <DetailField label={isCategoryABC ? 'Base Fee (global)' : 'Base Fee'} icon={DollarSign}>
        <span className={cn(
          "font-black text-slate-900 dark:text-white",
          isCategoryABC ? "text-sm" : "text-lg"
        )}>
          ${config.baseFee.toFixed(2)}
        </span>
      </DetailField>
      <DetailField label="Insurance Fee" icon={ShieldCheck}>
        <span>${config.insuranceFee.toFixed(2)}</span>
      </DetailField>
      {config.pricingMode === 'PER_MILE' && config.perMileRate && (
        <DetailField label="Per-Mile Rate" icon={Route}>
          <span className="text-lg font-black text-teal-600 dark:text-teal-400">${config.perMileRate.toFixed(2)}/mi</span>
        </DetailField>
      )}
      <Separator className="my-2" />
      <DetailField label="Transaction Fee %" icon={Percent}>
        <span>{config.transactionFeePct}%</span>
      </DetailField>
      <DetailField label="Transaction Fee Fixed" icon={Receipt}>
        <span>${config.transactionFeeFixed.toFixed(2)}</span>
      </DetailField>
      <DetailField label="Driver Share" icon={CircleDot}>
        <span className="text-primary font-bold">{config.driverSharePct}%</span>
      </DetailField>
      <DetailField label="Fee Pass-Through" icon={ArrowRight}>
        <Badge variant="outline" className={cn(
          "text-xs",
          config.feePassThrough
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
        )}>
          {config.feePassThrough ? 'Enabled' : 'Disabled'}
        </Badge>
      </DetailField>
      {isCategoryABC && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
          Category-specific base fees and per-mile rates are shown in the Category A/B/C Rules section above.
        </p>
      )}
      {isFlatTier && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
          Tier-specific flat prices are shown in the Flat Tiers section above.
        </p>
      )}
    </div>
  );
}

// ---------- Mode-Specific Section (full detail per type) ----------
function ModeSpecificSection({ config }: { config: PricingConfig }) {
  if (config.pricingMode === 'PER_MILE') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Per-Mile Pricing</h4>
        </div>
        <div className="rounded-2xl bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-900/30 p-6 text-center">
          <Route className="w-8 h-8 text-teal-500 mx-auto mb-2" />
          <div className="text-4xl font-black text-teal-700 dark:text-teal-300">${config.perMileRate?.toFixed(2)}</div>
          <div className="text-sm text-teal-600 dark:text-teal-400 font-bold mt-1">per mile</div>
          <div className="mt-4 pt-4 border-t border-teal-200 dark:border-teal-900/30 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-teal-500/70">Base Fee</div>
              <div className="text-lg font-bold text-teal-800 dark:text-teal-200">${config.baseFee.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-teal-500/70">Insurance Fee</div>
              <div className="text-lg font-bold text-teal-800 dark:text-teal-200">${config.insuranceFee.toFixed(2)}</div>
            </div>
          </div>
          <div className="text-xs text-teal-500/70 mt-3">
            Total for 50 mi example: ${((config.perMileRate || 0) * 50 + config.baseFee + config.insuranceFee).toFixed(2)}
          </div>
        </div>
      </div>
    );
  }

  if (config.pricingMode === 'FLAT_TIER' && config.tiers.length > 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Flat Tiers ({config.tiers.length})</h4>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-4 gap-0 bg-slate-50 dark:bg-slate-900 px-5 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tier</div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Min Miles</div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Max Miles</div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Flat Price</div>
          </div>
          {/* Tier rows */}
          {config.tiers.map((tier: PricingTier, idx: number) => (
            <div
              key={tier.id || idx}
              className={cn(
                "grid grid-cols-4 gap-0 px-5 py-4 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30",
                idx < config.tiers.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : "",
                idx % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-900/30" : ""
              )}
            >
              <div className="flex items-center">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[10px] font-bold px-2 py-0.5">
                  {idx + 1}
                </Badge>
              </div>
              <div className="flex items-center font-medium text-slate-700 dark:text-slate-300">{tier.minMiles} mi</div>
              <div className="flex items-center font-medium text-slate-700 dark:text-slate-300">{tier.maxMiles != null ? `${tier.maxMiles} mi` : <span className="text-slate-400">Unlimited</span>}</div>
              <div className="flex items-center justify-end font-black text-slate-900 dark:text-white text-base">${tier.flatPrice.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (config.pricingMode === 'CATEGORY_ABC' && config.categoryRules.length > 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Category A/B/C Rules</h4>
        </div>
        <div className="space-y-4">
          {config.categoryRules.map((rule: CategoryRule) => {
            const colorClass = categoryColors[rule.category] || 'border-slate-200 dark:border-slate-800';
            const bgLight = rule.category === 'A' ? 'bg-emerald-50 dark:bg-emerald-900/5'
              : rule.category === 'B' ? 'bg-amber-50 dark:bg-amber-900/5'
              : 'bg-rose-50 dark:bg-rose-900/5';
            const badgeBg = rule.category === 'A' ? 'bg-emerald-500 text-white'
              : rule.category === 'B' ? 'bg-amber-500 text-white'
              : 'bg-rose-500 text-white';

            return (
              <div
                key={rule.id || rule.category}
                className={cn(
                  "rounded-2xl border p-5 transition-all",
                  colorClass
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={cn("text-base font-black w-10 h-10 flex items-center justify-center p-0 rounded-xl border-0 shrink-0", badgeBg)}>
                    {rule.category}
                  </Badge>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">Category {rule.category}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {rule.minMiles} mi {rule.maxMiles != null ? `– ${rule.maxMiles} mi` : 'and above'}
                    </div>
                  </div>
                </div>
                <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3", bgLight, "rounded-xl p-3 -mx-1")}>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Base Fee</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">${rule.baseFee?.toFixed(2) ?? '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Per Mile</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">${rule.perMileRate?.toFixed(2) ?? '—'}<span className="text-xs font-medium text-slate-400">/mi</span></div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Min Miles</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{rule.minMiles}<span className="text-xs font-medium text-slate-400"> mi</span></div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Max Miles</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{rule.maxMiles != null ? `${rule.maxMiles}` : '∞'}<span className="text-xs font-medium text-slate-400"> mi</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ---------- Empty State ----------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mb-5">
        <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
        Select a configuration
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
        Choose a pricing configuration from the list to view its full details.
      </p>
    </div>
  );
}

// ---------- Main Component ----------
export function PricingConfigList({
  configs,
  isLoading = false,
  onEdit,
  onDelete,
  onToggleStatus,
  onSetDefault,
  searchQuery = '',
  onSearchChange,
}: PricingConfigListProps) {
  const navigate = useNavigate();

  // Selected config state
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  // Auto-select first config when list changes
  useEffect(() => {
    if (configs.length > 0) {
      const firstId = configs[0].id;
      // Only auto-select if nothing is selected or the selected one no longer exists
      if (!selectedConfigId || !configs.find(c => c.id === selectedConfigId)) {
        setSelectedConfigId(firstId);
      }
    } else {
      setSelectedConfigId(null);
    }
  }, [configs, selectedConfigId]);

  const selectedConfig = configs.find(c => c.id === selectedConfigId) ?? null;

  // State for assignment modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedConfigName, setSelectedConfigName] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [pricingModeOverride, setPricingModeOverride] = useState<string>('null');
  const [postpaidEnabled, setPostpaidEnabled] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');

  // State for view customers modal
  const [viewCustomersModalOpen, setViewCustomersModalOpen] = useState(false);
  const [viewingConfigCustomers, setViewingConfigCustomers] = useState<PricingCustomer[]>([]);
  const [viewingConfigName, setViewingConfigName] = useState<string>('');

  // Set default mutation
  const setDefaultMutation = useSetDefaultPricingConfig({
    onSuccess: () => {
      toast.success('Configuration set as default successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to set as default: ${error?.message || 'Unknown error'}`);
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useTogglePricingConfigStatus({
    onSuccess: () => {
      toast.success('Status updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update status: ${error?.message || 'Unknown error'}`);
    },
  });

  // Fetch customers
  const {
    data: customersData,
    isLoading: customersLoading,
    error: customersError,
  } = useDataQuery<Customer[]>({
    apiEndPoint: `${API_BASE_URL}/api/customers`,
    noFilter: true,
    staleTime: 30 * 1000,
  });

  // Filter customers to only BUSINESS
  const businessCustomers = customersData?.filter(
    (c) => c.customerType === 'BUSINESS'
  ) || [];

  // Mutation for assignment
  const assignMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_BASE_URL}/api/customers/:id/admin-pricing`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Pricing configuration assigned successfully');
      setAssignModalOpen(false);
      setSelectedCustomerId('');
      setPricingModeOverride('null');
      setPostpaidEnabled(true);
      setNote('');
    },
    onError: (error: any) => {
      toast.error(`Assignment failed: ${error?.message || 'Unknown error'}`);
    },
    invalidateQueryKey: [['data', `${API_BASE_URL}/api/customers`]],
  });

  const handleAssign = (configId: string, configName: string) => {
    setSelectedConfigId(configId);
    setSelectedConfigName(configName);
    setAssignModalOpen(true);
  };

  const submitAssign = () => {
    if (!selectedConfigId || !selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    const user = getUser();
    const payload = {
      pricingConfigId: selectedConfigId,
      pricingModeOverride: pricingModeOverride === 'null' ? null : pricingModeOverride,
      postpaidEnabled,
      actorUserId: user?.id || 'admin_user',
      note: note.trim() || undefined,
    };
    assignMutation.mutate({
      pathParams: { id: selectedCustomerId },
      ...payload,
    });
  };

  // Handle set as default
  const handleSetDefault = (configId: string) => {
    const user = getUser();
    setDefaultMutation.mutate({
      id: configId,
      actorUserId: user?.id || 'admin_user',
    });
  };

  // Handle toggle status
  const handleToggleStatus = (configId: string, currentStatus: boolean) => {
    const user = getUser();
    toggleStatusMutation.mutate({
      id: configId,
      active: !currentStatus,
      actorUserId: user?.id || 'admin_user',
    });
  };

  // Handle view customers
  const handleViewCustomers = (config: PricingConfig) => {
    setViewingConfigCustomers(config.customers || []);
    setViewingConfigName(config.name);
    setViewCustomersModalOpen(true);
  };

  // Get customer info for display in assignment modal
  const getCustomerCurrentConfig = (customerId: string): { name: string; id: string } | null => {
    const customer = businessCustomers.find(c => c.id === customerId);
    if (!customer || !customer.pricingConfigId) return null;
    const currentConfig = configs.find(c => c.id === customer.pricingConfigId);
    if (!currentConfig) return null;
    return { name: currentConfig.name, id: currentConfig.id };
  };

  // ---------- Loading skeleton ----------
  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6" style={{ minHeight: '600px' }}>
            {/* Left panel skeleton */}
            <div className="w-full lg:w-[380px] shrink-0 space-y-4">
              <div className="flex gap-2">
                <Skeleton className="h-11 flex-1 rounded-2xl" />
                <Skeleton className="h-11 w-28 rounded-2xl" />
              </div>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
            {/* Right panel skeleton */}
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
              <Separator className="my-4" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          {configs.length === 0 ? (
            /* ---------- Empty configs state ---------- */
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-5">
                <DollarSign className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                No pricing configurations found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Get started by creating your first pricing configuration'}
              </p>
              <Link to="/admin-pricing-config/create">
                <Button className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-slate-950">
                  <Plus className="w-4 h-4" />
                  Create Configuration
                </Button>
              </Link>
            </div>
          ) : (
            /* ---------- Master-Detail Layout ---------- */
            <div className="flex flex-col lg:flex-row" style={{ minHeight: '640px' }}>
              {/* ===== LEFT PANEL: Config List ===== */}
              <div className="w-full lg:w-[380px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
                {/* Search + New Config */}
                <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => onSearchChange?.(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                      placeholder="Search configurations..."
                    />
                  </div>
                  <Link to="/admin-pricing-config/create" className="block">
                    <Button className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-slate-950 hover:shadow-lg hover:shadow-primary/20 transition text-sm font-bold">
                      <Plus className="w-4 h-4" />
                      New Config
                    </Button>
                  </Link>
                </div>

                {/* Scrollable List */}
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {configs.map((config) => {
                      const modeInfo = modeBadgeStyles[config.pricingMode];
                      const ModeIcon = modeInfo.icon;
                      const isSelected = config.id === selectedConfigId;

                      return (
                        <button
                          key={config.id}
                          onClick={() => setSelectedConfigId(config.id)}
                          className={cn(
                            "w-full text-left rounded-2xl p-4 transition-all duration-150 border",
                            isSelected
                              ? "ring-2 ring-primary bg-primary/5 border-primary/30 dark:bg-primary/10 dark:border-primary/40 shadow-sm"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {config.isDefault && (
                                <Crown className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                              <span className={cn(
                                "font-extrabold text-slate-900 dark:text-white truncate text-sm",
                                !config.isDefault && "pl-6"
                              )}>
                                {config.name}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] shrink-0", modeInfo.className)}
                            >
                              <ModeIcon className="w-3 h-3" />
                              {modeInfo.label}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              {config.pricingMode === 'PER_MILE' && (
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  ${config.baseFee.toFixed(2)} + ${config.perMileRate?.toFixed(2) ?? '—'}/mi
                                </span>
                              )}
                              {config.pricingMode === 'FLAT_TIER' && (
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  {config._count?.tiers ?? config.tiers?.length ?? 0} tier{(config._count?.tiers ?? config.tiers?.length ?? 0) !== 1 ? 's' : ''}
                                </span>
                              )}
                              {config.pricingMode === 'CATEGORY_ABC' && (
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  {config._count?.categoryRules ?? config.categoryRules?.length ?? 0} categories
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {config.active ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                                  <CheckCircle className="w-3 h-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                  <XCircle className="w-3 h-3" />
                                  Inactive
                                </span>
                              )}
                              {config._count?.customers && config._count.customers > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                  <Users className="w-3 h-3" />
                                  {config._count.customers}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2 pb-1">
                      {configs.length} configuration{configs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </ScrollArea>
              </div>

              {/* ===== RIGHT PANEL: Detail View ===== */}
              <div className="flex-1 min-w-0">
                {selectedConfig ? (
                  <ScrollArea className="h-full">
                    <div className="p-6 lg:p-8 space-y-6">
                      {/* ---- Header Section ---- */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {selectedConfig.isDefault && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] font-bold gap-1">
                                <Crown className="w-3 h-3" />
                                DEFAULT
                              </Badge>
                            )}
                            {selectedConfig.active ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-[10px] font-bold gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-[10px] font-bold gap-1">
                                <XCircle className="w-3 h-3" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                            {selectedConfig.name}
                          </h2>
                          {selectedConfig.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                              {selectedConfig.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn("inline-flex items-center gap-1.5 px-3 py-1.5", modeBadgeStyles[selectedConfig.pricingMode].className)}
                          >
                            {React.createElement(modeBadgeStyles[selectedConfig.pricingMode].icon, { className: "w-4 h-4" })}
                            {modeBadgeStyles[selectedConfig.pricingMode].label}
                          </Badge>
                        </div>
                      </div>

                      {/* Dates row */}
                      <div className="flex flex-wrap gap-4 text-xs text-slate-400 dark:text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Created: {formatDate(selectedConfig.createdAt)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Updated: {formatDate(selectedConfig.updatedAt)}
                        </div>
                      </div>

                      <Separator />

                      {/* ---- Mode-Specific Section (shown first, most important) ---- */}
                      <ModeSpecificSection config={selectedConfig} />

                      <Separator />

                      {/* ---- Common Fees & Settings ---- */}
                      <FinancialSection config={selectedConfig} />

                      <Separator />

                      {/* ---- Customers Section ---- */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Customers</h4>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Users className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="text-lg font-black text-slate-900 dark:text-white">
                                {selectedConfig._count?.customers ?? selectedConfig.customers?.length ?? 0}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">assigned customers</div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewCustomers(selectedConfig)}
                            disabled={!selectedConfig._count?.customers && !selectedConfig.customers?.length}
                            className="rounded-xl gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5" />
                            View Customers
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* ---- Action Buttons ---- */}
                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={() => {
                            if (onEdit) onEdit(selectedConfig.id);
                            else navigate({ to: `/admin-pricing-config/edit/${selectedConfig.id}` });
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-slate-950 hover:shadow-lg hover:shadow-primary/20 transition font-bold text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleAssign(selectedConfig.id, selectedConfig.name)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
                        >
                          <UserPlus className="w-4 h-4" />
                          Assign to Customer
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleSetDefault(selectedConfig.id)}
                          disabled={selectedConfig.isDefault || setDefaultMutation.isPending}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
                        >
                          <Crown className="w-4 h-4" />
                          {selectedConfig.isDefault ? 'Default' : 'Set as Default'}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-700 dark:hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &ldquo;{selectedConfig.name}&rdquo;? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  if (onDelete) onDelete(selectedConfig.id);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  /* ---- Empty Detail State ---- */
                  <div className="h-full min-h-[400px] lg:min-h-0">
                    <EmptyState />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Assignment Modal ===== */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Pricing Configuration</DialogTitle>
            <DialogDescription>
              Assign &ldquo;{selectedConfigName}&rdquo; to a business customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Customer Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer *</label>
              {customersLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : customersError ? (
                <p className="text-sm text-red-500">Failed to load customers</p>
              ) : (
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a business customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessCustomers.length === 0 ? (
                      <SelectItem value="none" disabled>No business customers found</SelectItem>
                    ) : (
                      businessCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div className="flex flex-col">
                            <span>{customer.businessName || customer.user.fullName}</span>
                            <span className="text-xs text-slate-500">{customer.user.email}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Current Config Warning */}
            {selectedCustomerId && getCustomerCurrentConfig(selectedCustomerId) && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Current config:</span>{' '}
                    {getCustomerCurrentConfig(selectedCustomerId)?.name}
                    <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                      This will replace the current pricing configuration.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Mode Override */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Pricing Mode Override</label>
              <Select value={pricingModeOverride} onValueChange={setPricingModeOverride}>
                <SelectTrigger>
                  <SelectValue placeholder="No override (use config's default mode)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">No override</SelectItem>
                  <SelectItem value="PER_MILE">Per Mile</SelectItem>
                  <SelectItem value="FLAT_TIER">Flat Tier</SelectItem>
                  <SelectItem value="CATEGORY_ABC">Category A/B/C</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Override the pricing mode for this customer. Leave as &ldquo;No override&rdquo; to use the configuration&rsquo;s mode.
              </p>
            </div>

            {/* Postpaid Enabled */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="postpaid"
                checked={postpaidEnabled}
                onCheckedChange={(checked) => setPostpaidEnabled(checked === true)}
              />
              <label
                htmlFor="postpaid"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Postpaid Enabled
              </label>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Note (optional)</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this assignment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitAssign}
              disabled={!selectedCustomerId || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== View Customers Modal ===== */}
      <Dialog open={viewCustomersModalOpen} onOpenChange={setViewCustomersModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Assigned Customers</DialogTitle>
            <DialogDescription>
              Customers using &ldquo;{viewingConfigName}&rdquo; pricing configuration
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {viewingConfigCustomers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No customers are currently assigned to this configuration.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {viewingConfigCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {customer.businessName || customer.contactName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {customer.contactEmail}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          customer.customerType === 'BUSINESS'
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"
                        )}
                      >
                        {customer.customerType}
                      </Badge>
                      {customer.postpaidEnabled && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                          Postpaid
                        </Badge>
                      )}
                      {customer.pricingModeOverride && (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-[10px]">
                          {customer.pricingModeOverride}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewCustomersModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
