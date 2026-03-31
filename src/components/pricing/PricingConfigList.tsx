// components/pricing/PricingConfigList.tsx
import React, { useState } from 'react';
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
  MoreVertical,
  CheckCircle,
  XCircle,
  Star,
  RefreshCw,
  AlertCircle,
  UserPlus,
  Users,
  Crown,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  useDataQuery,
  useDataMutation,
  getUser,
} from '@/lib/tanstack/dataQuery';
import {
  useSetDefaultPricingConfig,
  useTogglePricingConfigStatus,
} from '@/hooks/pricing/usePricingConfigs';
import type { PricingConfig, PricingMode, PricingCustomer } from '@/types/pricing';

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

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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

  // State for assignment modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
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

  // Loading skeleton for table
  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-7 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-11 w-80" />
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-7">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black">Pricing Configurations</CardTitle>
              <CardDescription className="text-sm mt-1">
                Manage pricing configurations for the platform
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full sm:w-[320px] h-11 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                  placeholder="Search configurations..."
                />
              </div>

              {/* Create button */}
              <Link to="/admin-pricing-config/create">
                <Button className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition">
                  <Plus className="w-4 h-4" />
                  New Config
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-7">
          {configs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                No pricing configurations found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Name
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Mode
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Base Fee
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Driver Share
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => {
                    const modeInfo = modeBadgeStyles[config.pricingMode];
                    const ModeIcon = modeInfo.icon;

                    return (
                      <TableRow
                        key={config.id}
                        className={cn(
                          "border-slate-100 dark:border-slate-800 hover:bg-primary/5 transition",
                          config.isDefault && "bg-amber-50/50 dark:bg-amber-900/10"
                        )}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            {config.isDefault && (
                              <Crown className="w-4 h-4 text-amber-500 fill-amber-500" title="Default configuration" />
                            )}
                            {!config.isDefault && config._count?.customers && config._count.customers > 0 && (
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" title="Has assigned customers" />
                            )}
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                {config.name}
                                {config.isDefault && (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                                    DEFAULT
                                  </Badge>
                                )}
                              </div>
                              {config.description && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[200px]">
                                  {config.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant="outline"
                            className={cn("inline-flex items-center gap-1.5 px-3 py-1.5", modeInfo.className)}
                          >
                            <ModeIcon className="w-3.5 h-3.5" />
                            {modeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-black text-slate-900 dark:text-white">
                            ${config.baseFee.toFixed(2)}
                          </div>
                          {config.insuranceFee ? (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              + ${config.insuranceFee.toFixed(2)} insurance
                            </div>
                          ) : null}
                          {config.pricingMode === 'PER_MILE' && config.perMileRate && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              ${config.perMileRate}/mi
                            </div>
                          )}
                          {config.pricingMode === 'FLAT_TIER' && config.tiers.length > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {config.tiers.length} tier{config.tiers.length > 1 ? 's' : ''}
                            </div>
                          )}
                          {config.pricingMode === 'CATEGORY_ABC' && config.categoryRules.length > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {config.categoryRules.length} categor{config.categoryRules.length > 1 ? 'ies' : 'y'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-bold text-slate-700 dark:text-slate-300">
                            {config.driverSharePct}%
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            {/* Quick Status Toggle */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleStatus(config.id, config.active)}
                                className="flex items-center gap-1.5"
                                title={config.active ? 'Click to deactivate' : 'Click to activate'}
                              >
                                {config.active ? (
                                  <ToggleRight className="w-6 h-6 text-green-500" />
                                ) : (
                                  <ToggleLeft className="w-6 h-6 text-slate-400" />
                                )}
                              </button>
                              <span className={cn(
                                "text-xs font-medium",
                                config.active ? "text-green-600 dark:text-green-400" : "text-slate-500"
                              )}>
                                {config.active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {config._count?.customers && config._count.customers > 0 && (
                              <button
                                onClick={() => handleViewCustomers(config)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs"
                                title="View assigned customers"
                              >
                                <Users className="w-3.5 h-3.5" />
                                {config._count.customers}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  if (onEdit) onEdit(config.id);
                                  else navigate({ to: `/admin-pricing-config/edit/${config.id}` });
                                }}
                                className="cursor-pointer"
                              >
                                <Edit className="w-4 h-4 mr-2 text-primary" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAssign(config.id, config.name)}
                                className="cursor-pointer"
                              >
                                <UserPlus className="w-4 h-4 mr-2 text-blue-500" />
                                Assign to Customer
                              </DropdownMenuItem>
                              {config._count?.customers && config._count.customers > 0 && (
                                <DropdownMenuItem
                                  onClick={() => handleViewCustomers(config)}
                                  className="cursor-pointer"
                                >
                                  <Users className="w-4 h-4 mr-2 text-slate-500" />
                                  View Customers ({config._count.customers})
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {!config.isDefault && (
                                <DropdownMenuItem
                                  onClick={() => handleSetDefault(config.id)}
                                  className="cursor-pointer"
                                  disabled={setDefaultMutation.isPending}
                                >
                                  <Crown className="w-4 h-4 mr-2 text-amber-500" />
                                  Set as Default
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400 cursor-pointer"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{config.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        if (onDelete) onDelete(config.id);
                                      }}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {configs.length > 0 && (
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing <span className="font-extrabold">{configs.length}</span> configuration{configs.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Pricing Configuration</DialogTitle>
            <DialogDescription>
              Assign "{selectedConfigName}" to a business customer.
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
                Override the pricing mode for this customer. Leave as "No override" to use the configuration's mode.
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

      {/* View Customers Modal */}
      <Dialog open={viewCustomersModalOpen} onOpenChange={setViewCustomersModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Assigned Customers</DialogTitle>
            <DialogDescription>
              Customers using "{viewingConfigName}" pricing configuration
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
