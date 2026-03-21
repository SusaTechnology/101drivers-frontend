// components/dashboard/GlobalFilterBar.tsx
import React, { useState, useEffect } from 'react';
import { Calendar, Filter, X, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  DashboardQueryParams,
  DatePreset,
  DeliveryStatus,
  CustomerType,
  ServiceType,
  FiltersApplied,
} from '@/types/dashboard';
import { getDateRangeForPreset, formatDashboardDate } from '@/hooks/useAdminDashboard';

interface GlobalFilterBarProps {
  filtersApplied: FiltersApplied | undefined;
  onFiltersChange: (params: DashboardQueryParams) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'CUSTOM', label: 'Custom Range' },
];

const DELIVERY_STATUSES: { value: DeliveryStatus; label: string }[] = [
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

const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PRIVATE', label: 'Private' },
];

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'HOME_DELIVERY', label: 'Home Delivery' },
  { value: 'BETWEEN_LOCATIONS', label: 'Between Locations' },
  { value: 'SERVICE_PICKUP_RETURN', label: 'Service Pickup/Return' },
];

export function GlobalFilterBar({
  filtersApplied,
  onFiltersChange,
  onRefresh,
  isLoading = false,
}: GlobalFilterBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<DashboardQueryParams>({});

  // Initialize local filters from applied filters
  useEffect(() => {
    if (filtersApplied) {
      setLocalFilters({
        datePreset: filtersApplied.datePreset || undefined,
        from: filtersApplied.from || undefined,
        to: filtersApplied.to || undefined,
        statuses: filtersApplied.statuses.length > 0 ? filtersApplied.statuses : undefined,
        customerType: filtersApplied.customerType || undefined,
        serviceType: filtersApplied.serviceType || undefined,
        requiresOpsConfirmation: filtersApplied.requiresOpsConfirmation ?? undefined,
        urgentOnly: filtersApplied.urgentOnly ?? undefined,
        disputedOnly: filtersApplied.disputedOnly ?? undefined,
      });
    }
  }, [filtersApplied]);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filtersApplied?.datePreset) count++;
    if (filtersApplied?.from || filtersApplied?.to) count++;
    if (filtersApplied?.statuses && filtersApplied.statuses.length > 0) count++;
    if (filtersApplied?.customerType) count++;
    if (filtersApplied?.serviceType) count++;
    if (filtersApplied?.requiresOpsConfirmation) count++;
    if (filtersApplied?.urgentOnly) count++;
    if (filtersApplied?.disputedOnly) count++;
    return count;
  }, [filtersApplied]);

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'CUSTOM') {
      setLocalFilters(prev => ({ ...prev, datePreset: preset }));
    } else {
      const range = getDateRangeForPreset(preset);
      if (range) {
        setLocalFilters(prev => ({
          ...prev,
          datePreset: preset,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        }));
        onFiltersChange({
          ...localFilters,
          datePreset: preset,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        });
      }
    }
  };

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({});
    onFiltersChange({});
    setIsFilterOpen(false);
  };

  const handleQuickStatusFilter = (status: DeliveryStatus) => {
    const currentStatuses = localFilters.statuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    const newFilters = {
      ...localFilters,
      statuses: newStatuses.length > 0 ? newStatuses : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Preset Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Select
              value={filtersApplied?.datePreset || ''}
              onValueChange={(value) => handlePresetChange(value as DatePreset)}
            >
              <SelectTrigger className="w-[140px] h-9 rounded-xl text-sm">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range Display */}
          {(filtersApplied?.from || filtersApplied?.to) && !filtersApplied?.datePreset && (
            <Badge variant="outline" className="chip-gray text-xs">
              {formatDashboardDate(filtersApplied?.from)} - {formatDashboardDate(filtersApplied?.to)}
            </Badge>
          )}

          {/* Quick Status Filters */}
          <div className="flex items-center gap-1">
            {(['ACTIVE', 'COMPLETED', 'DISPUTED'] as DeliveryStatus[]).map((status) => (
              <Button
                key={status}
                variant={filtersApplied?.statuses?.includes(status) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickStatusFilter(status)}
                className={cn(
                  'h-8 px-3 text-xs font-bold rounded-xl',
                  filtersApplied?.statuses?.includes(status)
                    ? 'bg-primary text-slate-950'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                )}
              >
                {status}
              </Button>
            ))}
          </div>

          {/* More Filters Popover */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center bg-primary text-slate-950 text-xs font-bold rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Card className="border-0 shadow-none">
                <CardHeader className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <CardTitle className="text-base font-bold">Filters</CardTitle>
                  <CardDescription className="text-xs">
                    Refine dashboard data by applying filters
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Custom Date Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Custom Date Range
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={localFilters.from ? localFilters.from.split('T')[0] : ''}
                        onChange={(e) => setLocalFilters(prev => ({
                          ...prev,
                          from: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          datePreset: 'CUSTOM',
                        }))}
                        className="h-9 text-xs rounded-xl"
                        placeholder="From"
                      />
                      <Input
                        type="date"
                        value={localFilters.to ? localFilters.to.split('T')[0] : ''}
                        onChange={(e) => setLocalFilters(prev => ({
                          ...prev,
                          to: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          datePreset: 'CUSTOM',
                        }))}
                        className="h-9 text-xs rounded-xl"
                        placeholder="To"
                      />
                    </div>
                  </div>

                  {/* Status Multi-Select */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Delivery Status
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {DELIVERY_STATUSES.map((status) => (
                        <Button
                          key={status.value}
                          variant={localFilters.statuses?.includes(status.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const current = localFilters.statuses || [];
                            const newStatuses = current.includes(status.value)
                              ? current.filter(s => s !== status.value)
                              : [...current, status.value];
                            setLocalFilters(prev => ({
                              ...prev,
                              statuses: newStatuses.length > 0 ? newStatuses : undefined,
                            }));
                          }}
                          className={cn(
                            'h-7 px-2 text-[10px] font-bold rounded-lg',
                            localFilters.statuses?.includes(status.value)
                              ? 'bg-primary text-slate-950'
                              : 'bg-white dark:bg-slate-950'
                          )}
                        >
                          {status.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Customer Type */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Customer Type
                    </Label>
                    <Select
                      value={localFilters.customerType || ''}
                      onValueChange={(value) => setLocalFilters(prev => ({
                        ...prev,
                        customerType: value as CustomerType || undefined,
                      }))}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-sm">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        {CUSTOMER_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Service Type */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Service Type
                    </Label>
                    <Select
                      value={localFilters.serviceType || ''}
                      onValueChange={(value) => setLocalFilters(prev => ({
                        ...prev,
                        serviceType: value as ServiceType || undefined,
                      }))}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-sm">
                        <SelectValue placeholder="All services" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All services</SelectItem>
                        {SERVICE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Toggle Filters */}
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="urgent" className="text-xs font-semibold">
                        Urgent Only
                      </Label>
                      <Switch
                        id="urgent"
                        checked={localFilters.urgentOnly || false}
                        onCheckedChange={(checked) => setLocalFilters(prev => ({
                          ...prev,
                          urgentOnly: checked || undefined,
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="disputed" className="text-xs font-semibold">
                        Disputed Only
                      </Label>
                      <Switch
                        id="disputed"
                        checked={localFilters.disputedOnly || false}
                        onCheckedChange={(checked) => setLocalFilters(prev => ({
                          ...prev,
                          disputedOnly: checked || undefined,
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="opsConfirm" className="text-xs font-semibold">
                        Needs Ops Confirmation
                      </Label>
                      <Switch
                        id="opsConfirm"
                        checked={localFilters.requiresOpsConfirmation || false}
                        onCheckedChange={(checked) => setLocalFilters(prev => ({
                          ...prev,
                          requiresOpsConfirmation: checked || undefined,
                        }))}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearFilters}
                      className="flex-1 h-9 rounded-xl"
                    >
                      Clear All
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyFilters}
                      className="flex-1 h-9 rounded-xl bg-primary text-slate-950"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </PopoverContent>
          </Popover>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1">
              {filtersApplied?.customerType && (
                <Badge
                  variant="outline"
                  className="chip bg-primary/10 border-primary/25 text-primary-foreground text-[10px]"
                >
                  {filtersApplied.customerType}
                  <X
                    className="w-3 h-3 ml-1 cursor-pointer"
                    onClick={() => onFiltersChange({ ...localFilters, customerType: undefined })}
                  />
                </Badge>
              )}
              {filtersApplied?.serviceType && (
                <Badge
                  variant="outline"
                  className="chip bg-primary/10 border-primary/25 text-primary-foreground text-[10px]"
                >
                  {filtersApplied.serviceType.replace('_', ' ')}
                  <X
                    className="w-3 h-3 ml-1 cursor-pointer"
                    onClick={() => onFiltersChange({ ...localFilters, serviceType: undefined })}
                  />
                </Badge>
              )}
              {filtersApplied?.urgentOnly && (
                <Badge
                  variant="outline"
                  className="chip bg-amber-100 border-amber-200 text-amber-700 text-[10px]"
                >
                  Urgent
                  <X
                    className="w-3 h-3 ml-1 cursor-pointer"
                    onClick={() => onFiltersChange({ ...localFilters, urgentOnly: undefined })}
                  />
                </Badge>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-9 px-3 rounded-xl"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
