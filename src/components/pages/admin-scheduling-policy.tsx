// components/pages/admin-scheduling-policy.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import {
  // Scheduling Policies
  useSchedulingPolicies,
  useSchedulingPoliciesSummary,
  useUpsertSchedulingPolicy,
  useActivateSchedulingPolicy,
  useDeactivateSchedulingPolicy,
  // Operating Hours
  useOperatingHours,
  useWeeklyOperatingHours,
  useUpsertOperatingHour,
  useActivateOperatingHour,
  useDeactivateOperatingHour,
  // Time Slot Templates
  useTimeSlotTemplates,
  useUpsertTimeSlotTemplate,
  useActivateTimeSlotTemplate,
  useDeactivateTimeSlotTemplate,
  // Helpers
  formatTime,
  getCustomerTypeLabel,
  getServiceTypeLabel,
  getDefaultModeLabel,
} from '@/hooks/useAdminSchedulingPolicy';
import type {
  SchedulingPolicy,
  CustomerType,
  ServiceType,
  DefaultMode,
  OperatingHour,
  DayOfWeek,
  TimeSlotTemplate,
  DAY_OF_WEEK_LABELS,
  DAY_OF_WEEK_SHORT,
} from '@/types/scheduling';
import { DAY_OF_WEEK_LABELS as DAY_LABELS, DAY_OF_WEEK_SHORT as DAY_SHORT } from '@/types/scheduling';
import {
  CalendarClock,
  RefreshCw,
  Plus,
  Edit,
  Power,
  PowerOff,
  Clock,
  Building2,
  User,
  Truck,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Home,
  Calendar,
  Timer,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ==================== SCHEMAS ====================

const policyFormSchema = z.object({
  id: z.string().optional(),
  customerType: z.enum(['BUSINESS', 'PRIVATE']),
  serviceType: z.enum(['HOME_DELIVERY', 'BETWEEN_LOCATIONS', 'SERVICE_PICKUP_RETURN']).nullable(),
  defaultMode: z.enum(['SAME_DAY', 'NEXT_DAY']),
  sameDayCutoffTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
  maxSameDayMiles: z.number().min(0).nullable().optional(),
  bufferMinutes: z.number().min(0),
  afterHoursEnabled: z.boolean(),
  requiresOpsConfirmation: z.boolean(),
  active: z.boolean(),
});

const operatingHourFormSchema = z.object({
  id: z.string().optional(),
  dayOfWeek: z.number().min(1).max(7),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  active: z.boolean(),
});

const timeSlotFormSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Label is required'),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  active: z.boolean(),
});

type PolicyFormData = z.infer<typeof policyFormSchema>;
type OperatingHourFormData = z.infer<typeof operatingHourFormSchema>;
type TimeSlotFormData = z.infer<typeof timeSlotFormSchema>;

// ==================== CONSTANTS ====================

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'all', label: 'All Customers' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PRIVATE', label: 'Private' },
];

const SERVICE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Services' },
  { value: 'HOME_DELIVERY', label: 'Home Delivery' },
  { value: 'BETWEEN_LOCATIONS', label: 'Between Locations' },
  { value: 'SERVICE_PICKUP_RETURN', label: 'Service Pickup/Return' },
];

const ACTIVE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'true', label: 'Active Only' },
  { value: 'false', label: 'Inactive Only' },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: 'all', label: 'All Days' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '7', label: 'Sunday' },
];

// ==================== MAIN COMPONENT ====================

export default function AdminSchedulingPolicyPage() {
  const { actionItems, signOut } = useAdminActions();

  // Tab state
  const [activeTab, setActiveTab] = useState<string>('policies');

  // ==================== SCHEDULING POLICIES STATE ====================
  const [policyActiveFilter, setPolicyActiveFilter] = useState<string>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SchedulingPolicy | null>(null);

  // ==================== OPERATING HOURS STATE ====================
  const [ohActiveFilter, setOhActiveFilter] = useState<string>('all');
  const [ohDayFilter, setOhDayFilter] = useState<string>('all');
  const [isOhModalOpen, setIsOhModalOpen] = useState(false);
  const [editingOh, setEditingOh] = useState<OperatingHour | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'weekly'>('weekly');

  // ==================== TIME SLOT TEMPLATES STATE ====================
  const [tsActiveFilter, setTsActiveFilter] = useState<string>('all');
  const [tsLabelFilter, setTsLabelFilter] = useState<string>('');
  const [isTsModalOpen, setIsTsModalOpen] = useState(false);
  const [editingTs, setEditingTs] = useState<TimeSlotTemplate | null>(null);

  // ==================== SCHEDULING POLICIES HOOKS ====================
  const policyQueryParams = useMemo(() => ({
    active: policyActiveFilter === 'all' ? undefined : policyActiveFilter === 'true',
    customerType: customerTypeFilter === 'all' ? undefined : customerTypeFilter as CustomerType,
    serviceType: serviceTypeFilter === 'all' ? undefined : serviceTypeFilter as ServiceType,
  }), [policyActiveFilter, customerTypeFilter, serviceTypeFilter]);

  const { data: policies = [], isLoading: policiesLoading, isFetching: policiesFetching, isError: policiesError, error: policiesErrorMsg, refetch: refetchPolicies } = useSchedulingPolicies(policyQueryParams);
  const { data: summary } = useSchedulingPoliciesSummary();
  const upsertPolicyMutation = useUpsertSchedulingPolicy();
  const activatePolicyMutation = useActivateSchedulingPolicy();
  const deactivatePolicyMutation = useDeactivateSchedulingPolicy();

  // ==================== OPERATING HOURS HOOKS ====================
  const ohQueryParams = useMemo(() => ({
    active: ohActiveFilter === 'all' ? undefined : ohActiveFilter === 'true',
    dayOfWeek: ohDayFilter === 'all' ? undefined : parseInt(ohDayFilter) as DayOfWeek,
  }), [ohActiveFilter, ohDayFilter]);

  const { data: operatingHours = [], isLoading: ohLoading, isFetching: ohFetching, isError: ohError, error: ohErrorMsg, refetch: refetchOh } = useOperatingHours(ohQueryParams);
  const { data: weeklyHours, isLoading: weeklyLoading, refetch: refetchWeekly } = useWeeklyOperatingHours();
  const upsertOhMutation = useUpsertOperatingHour();
  const activateOhMutation = useActivateOperatingHour();
  const deactivateOhMutation = useDeactivateOperatingHour();

  // ==================== TIME SLOT TEMPLATES HOOKS ====================
  const tsQueryParams = useMemo(() => ({
    active: tsActiveFilter === 'all' ? undefined : tsActiveFilter === 'true',
    label: tsLabelFilter || undefined,
  }), [tsActiveFilter, tsLabelFilter]);

  const { data: timeSlots = [], isLoading: tsLoading, isFetching: tsFetching, isError: tsError, error: tsErrorMsg, refetch: refetchTs } = useTimeSlotTemplates(tsQueryParams);
  const upsertTsMutation = useUpsertTimeSlotTemplate();
  const activateTsMutation = useActivateTimeSlotTemplate();
  const deactivateTsMutation = useDeactivateTimeSlotTemplate();

  // ==================== POLICY FORM ====================
  const policyForm = useForm<PolicyFormData>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      customerType: 'BUSINESS',
      serviceType: null,
      defaultMode: 'NEXT_DAY',
      sameDayCutoffTime: null,
      maxSameDayMiles: null,
      bufferMinutes: 30,
      afterHoursEnabled: false,
      requiresOpsConfirmation: false,
      active: true,
    },
  });

  // ==================== OPERATING HOURS FORM ====================
  const ohForm = useForm<OperatingHourFormData>({
    resolver: zodResolver(operatingHourFormSchema),
    defaultValues: {
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      active: true,
    },
  });

  // ==================== TIME SLOT FORM ====================
  const tsForm = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeSlotFormSchema),
    defaultValues: {
      label: '',
      startTime: '09:00',
      endTime: '09:30',
      active: true,
    },
  });

  // ==================== POLICY HANDLERS ====================
  const handleOpenCreatePolicy = useCallback(() => {
    setEditingPolicy(null);
    policyForm.reset({
      customerType: 'BUSINESS',
      serviceType: null,
      defaultMode: 'NEXT_DAY',
      sameDayCutoffTime: null,
      maxSameDayMiles: null,
      bufferMinutes: 30,
      afterHoursEnabled: false,
      requiresOpsConfirmation: false,
      active: true,
    });
    setIsPolicyModalOpen(true);
  }, [policyForm]);

  const handleOpenEditPolicy = useCallback((policy: SchedulingPolicy) => {
    setEditingPolicy(policy);
    policyForm.reset({
      id: policy.id,
      customerType: policy.customerType,
      serviceType: policy.serviceType,
      defaultMode: policy.defaultMode,
      sameDayCutoffTime: policy.sameDayCutoffTime,
      maxSameDayMiles: policy.maxSameDayMiles,
      bufferMinutes: policy.bufferMinutes,
      afterHoursEnabled: policy.afterHoursEnabled,
      requiresOpsConfirmation: policy.requiresOpsConfirmation,
      active: policy.active,
    });
    setIsPolicyModalOpen(true);
  }, [policyForm]);

  const handleClosePolicyModal = useCallback(() => {
    setIsPolicyModalOpen(false);
    setEditingPolicy(null);
    policyForm.reset();
  }, [policyForm]);

  const handleSubmitPolicy = useCallback((data: PolicyFormData) => {
    upsertPolicyMutation.mutate(data, {
      onSuccess: () => {
        toast.success(editingPolicy ? 'Policy updated successfully' : 'Policy created successfully');
        handleClosePolicyModal();
        refetchPolicies();
      },
      onError: () => {
        toast.error('Failed to save policy');
      },
    });
  }, [editingPolicy, upsertPolicyMutation, handleClosePolicyModal, refetchPolicies]);

  const handleActivatePolicy = useCallback((policyId: string) => {
    activatePolicyMutation.mutate(
      { pathParams: { id: policyId } },
      {
        onSuccess: () => toast.success('Policy activated successfully'),
        onError: () => toast.error('Failed to activate policy'),
      }
    );
  }, [activatePolicyMutation]);

  const handleDeactivatePolicy = useCallback((policyId: string) => {
    deactivatePolicyMutation.mutate(
      { pathParams: { id: policyId } },
      {
        onSuccess: () => toast.success('Policy deactivated successfully'),
        onError: () => toast.error('Failed to deactivate policy'),
      }
    );
  }, [deactivatePolicyMutation]);

  const resetPolicyFilters = useCallback(() => {
    setPolicyActiveFilter('all');
    setCustomerTypeFilter('all');
    setServiceTypeFilter('all');
  }, []);

  // ==================== OPERATING HOURS HANDLERS ====================
  const handleOpenCreateOh = useCallback(() => {
    setEditingOh(null);
    ohForm.reset({
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      active: true,
    });
    setIsOhModalOpen(true);
  }, [ohForm]);

  const handleOpenEditOh = useCallback((oh: OperatingHour) => {
    setEditingOh(oh);
    ohForm.reset({
      id: oh.id,
      dayOfWeek: oh.dayOfWeek,
      startTime: oh.startTime,
      endTime: oh.endTime,
      active: oh.active,
    });
    setIsOhModalOpen(true);
  }, [ohForm]);

  const handleCloseOhModal = useCallback(() => {
    setIsOhModalOpen(false);
    setEditingOh(null);
    ohForm.reset();
  }, [ohForm]);

  const handleSubmitOh = useCallback((data: OperatingHourFormData) => {
    upsertOhMutation.mutate(data, {
      onSuccess: () => {
        toast.success(editingOh ? 'Operating hours updated successfully' : 'Operating hours created successfully');
        handleCloseOhModal();
        refetchOh();
        refetchWeekly();
      },
      onError: () => {
        toast.error('Failed to save operating hours');
      },
    });
  }, [editingOh, upsertOhMutation, handleCloseOhModal, refetchOh, refetchWeekly]);

  const handleActivateOh = useCallback((ohId: string) => {
    activateOhMutation.mutate(
      { pathParams: { id: ohId } },
      {
        onSuccess: () => toast.success('Operating hours activated successfully'),
        onError: () => toast.error('Failed to activate operating hours'),
      }
    );
  }, [activateOhMutation]);

  const handleDeactivateOh = useCallback((ohId: string) => {
    deactivateOhMutation.mutate(
      { pathParams: { id: ohId } },
      {
        onSuccess: () => toast.success('Operating hours deactivated successfully'),
        onError: () => toast.error('Failed to deactivate operating hours'),
      }
    );
  }, [deactivateOhMutation]);

  const resetOhFilters = useCallback(() => {
    setOhActiveFilter('all');
    setOhDayFilter('all');
  }, []);

  // ==================== TIME SLOT HANDLERS ====================
  const handleOpenCreateTs = useCallback(() => {
    setEditingTs(null);
    tsForm.reset({
      label: '',
      startTime: '09:00',
      endTime: '09:30',
      active: true,
    });
    setIsTsModalOpen(true);
  }, [tsForm]);

  const handleOpenEditTs = useCallback((ts: TimeSlotTemplate) => {
    setEditingTs(ts);
    tsForm.reset({
      id: ts.id,
      label: ts.label,
      startTime: ts.startTime,
      endTime: ts.endTime,
      active: ts.active,
    });
    setIsTsModalOpen(true);
  }, [tsForm]);

  const handleCloseTsModal = useCallback(() => {
    setIsTsModalOpen(false);
    setEditingTs(null);
    tsForm.reset();
  }, [tsForm]);

  const handleSubmitTs = useCallback((data: TimeSlotFormData) => {
    upsertTsMutation.mutate(data, {
      onSuccess: () => {
        toast.success(editingTs ? 'Time slot updated successfully' : 'Time slot created successfully');
        handleCloseTsModal();
        refetchTs();
      },
      onError: () => {
        toast.error('Failed to save time slot');
      },
    });
  }, [editingTs, upsertTsMutation, handleCloseTsModal, refetchTs]);

  const handleActivateTs = useCallback((tsId: string) => {
    activateTsMutation.mutate(
      { pathParams: { id: tsId } },
      {
        onSuccess: () => toast.success('Time slot activated successfully'),
        onError: () => toast.error('Failed to activate time slot'),
      }
    );
  }, [activateTsMutation]);

  const handleDeactivateTs = useCallback((tsId: string) => {
    deactivateTsMutation.mutate(
      { pathParams: { id: tsId } },
      {
        onSuccess: () => toast.error('Time slot deactivated'),
        onError: () => toast.error('Failed to deactivate time slot'),
      }
    );
  }, [deactivateTsMutation]);

  const resetTsFilters = useCallback(() => {
    setTsActiveFilter('all');
    setTsLabelFilter('');
  }, []);

  // ==================== RENDER ====================
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
        {/* Header */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Link to="/admin-dashboard" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Scheduling Configuration</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Manage scheduling policies, operating hours, and time slot templates for delivery booking.
            </p>
          </div>
        </section>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <TabsTrigger value="policies" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">
              <CalendarClock className="w-4 h-4 mr-2" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="hours" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">
              <Clock className="w-4 h-4 mr-2" />
              Operating Hours
            </TabsTrigger>
            <TabsTrigger value="slots" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">
              <Timer className="w-4 h-4 mr-2" />
              Time Slots
            </TabsTrigger>
          </TabsList>

          {/* ==================== POLICIES TAB ==================== */}
          <TabsContent value="policies" className="space-y-6">
            {/* Summary Cards */}
            {summary && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</div>
                  <div className="text-xl font-black mt-1">{summary.totalPolicies ?? 0}</div>
                </Card>
                <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Active</div>
                  <div className="text-xl font-black mt-1 text-emerald-600">{summary.activePolicies ?? 0}</div>
                </Card>
                <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Inactive</div>
                  <div className="text-xl font-black mt-1">{summary.inactivePolicies ?? 0}</div>
                </Card>
                <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-primary/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary">By Type</div>
                  <div className="text-sm font-bold mt-1">
                    {summary.byCustomerType?.map(c => `${getCustomerTypeLabel(c.customerType)}: ${c.count}`).join(' / ') || 'No data'}
                  </div>
                </Card>
              </section>
            )}

            {/* Filters & Actions */}
            <section className="flex flex-wrap gap-4 items-end justify-between">
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 flex-1 min-w-[300px]">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</Label>
                      <Select value={policyActiveFilter} onValueChange={setPolicyActiveFilter}>
                        <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVE_FILTER_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer</Label>
                      <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                        <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CUSTOMER_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Service</Label>
                      <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                        <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={resetPolicyFilters} className="rounded-xl">
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <Button onClick={handleOpenCreatePolicy} size="sm" className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Policy
                </Button>
                <Button onClick={() => refetchPolicies()} disabled={policiesFetching} variant="outline" size="sm" className="rounded-xl">
                  <RefreshCw className={cn("h-3.5 w-3.5", policiesFetching && "animate-spin")} />
                </Button>
              </div>
            </section>

            {/* Policies Table */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardContent className="p-0">
                {policiesLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                  </div>
                ) : policiesError ? (
                  <div className="p-8 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                    <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load policies</p>
                    <p className="text-sm text-slate-500 mt-1">{policiesErrorMsg?.message || 'Unknown error'}</p>
                    <Button onClick={() => refetchPolicies()} variant="outline" className="mt-4 rounded-xl">Try Again</Button>
                  </div>
                ) : policies.length === 0 ? (
                  <div className="p-8 text-center">
                    <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-400 font-medium">No policies found</p>
                    <Button onClick={handleOpenCreatePolicy} className="mt-4 rounded-xl">
                      <Plus className="h-4 w-4 mr-1" />
                      Create Policy
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Service</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Mode</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Cutoff</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Miles</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Buffer</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Flags</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => (
                        <TableRow key={policy.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <TableCell className="px-4 py-3">
                            <Badge className={cn('text-[10px] font-bold border', policy.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                              {policy.active ? <><CheckCircle className="w-3 h-3 mr-1" /> Active</> : <><XCircle className="w-3 h-3 mr-1" /> Inactive</>}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {policy.customerType === 'BUSINESS' ? <Building2 className="w-4 h-4 text-slate-400" /> : <User className="w-4 h-4 text-slate-400" />}
                              <span className="text-sm font-medium">{getCustomerTypeLabel(policy.customerType)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {policy.serviceType === 'HOME_DELIVERY' && <Home className="w-4 h-4 text-blue-500" />}
                              {policy.serviceType === 'BETWEEN_LOCATIONS' && <MapPin className="w-4 h-4 text-purple-500" />}
                              {policy.serviceType === 'SERVICE_PICKUP_RETURN' && <Truck className="w-4 h-4 text-amber-500" />}
                              <span className="text-sm">{getServiceTypeLabel(policy.serviceType)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge variant="outline" className={cn('text-[10px]', policy.defaultMode === 'SAME_DAY' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                              {getDefaultModeLabel(policy.defaultMode)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-slate-600">{policy.sameDayCutoffTime ? formatTime(policy.sameDayCutoffTime) : '—'}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-slate-600">{policy.maxSameDayMiles != null ? `${policy.maxSameDayMiles} mi` : '—'}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-slate-600">{policy.bufferMinutes} min</TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {policy.afterHoursEnabled && <Badge className="bg-indigo-50 text-indigo-700 text-[9px]">After Hours</Badge>}
                              {policy.requiresOpsConfirmation && <Badge className="bg-amber-50 text-amber-700 text-[9px]">Ops Confirm</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {policy.active ? (
                                <Button variant="ghost" size="sm" onClick={() => handleDeactivatePolicy(policy.id)} disabled={deactivatePolicyMutation.isPending} className="h-8 w-8 p-0 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Deactivate">
                                  <PowerOff className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => handleActivatePolicy(policy.id)} disabled={activatePolicyMutation.isPending} className="h-8 w-8 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Activate">
                                  <Power className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => handleOpenEditPolicy(policy)} className="h-8 w-8 p-0 rounded-lg" title="Edit">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== OPERATING HOURS TAB ==================== */}
          <TabsContent value="hours" className="space-y-6">
            {/* Filters & Actions */}
            <section className="flex flex-wrap gap-4 items-end justify-between">
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 flex-1 min-w-[300px]">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</Label>
                      <Select value={ohActiveFilter} onValueChange={setOhActiveFilter}>
                        <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVE_FILTER_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Day</Label>
                      <Select value={ohDayFilter} onValueChange={setOhDayFilter}>
                        <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OF_WEEK_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={resetOhFilters} className="rounded-xl">Reset</Button>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Button variant={viewMode === 'weekly' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('weekly')} className="rounded-none">
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-none">
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={handleOpenCreateOh} size="sm" className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Hours
                </Button>
                <Button onClick={() => { refetchOh(); refetchWeekly(); }} disabled={ohFetching || weeklyLoading} variant="outline" size="sm" className="rounded-xl">
                  <RefreshCw className={cn("h-3.5 w-3.5", (ohFetching || weeklyLoading) && "animate-spin")} />
                </Button>
              </div>
            </section>

            {/* Operating Hours Content */}
            {viewMode === 'weekly' && weeklyHours ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                {weeklyHours.days.map((day) => (
                  <Card key={day.dayOfWeek} className="rounded-xl border-slate-200 dark:border-slate-800">
                    <CardHeader className="p-3 border-b border-slate-100 dark:border-slate-800">
                      <CardTitle className="text-sm font-bold">{DAY_LABELS[day.dayOfWeek]}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      {day.items.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No hours set</p>
                      ) : (
                        day.items.map((item) => (
                          <div key={item.id} className={cn(
                            "p-2 rounded-lg text-xs border",
                            item.active ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          )}>
                            <div className="font-medium">{formatTime(item.startTime)} - {formatTime(item.endTime)}</div>
                            <div className="flex items-center justify-between mt-1">
                              <Badge className={cn("text-[9px]", item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                                {item.active ? 'Active' : 'Inactive'}
                              </Badge>
                              <div className="flex gap-1">
                                {item.active ? (
                                  <Button variant="ghost" size="sm" onClick={() => handleDeactivateOh(item.id)} className="h-5 w-5 p-0 text-amber-500">
                                    <PowerOff className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => handleActivateOh(item.id)} className="h-5 w-5 p-0 text-emerald-500">
                                    <Power className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => handleOpenEditOh(item)} className="h-5 w-5 p-0">
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardContent className="p-0">
                  {ohLoading ? (
                    <div className="p-6 space-y-3">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                    </div>
                  ) : ohError ? (
                    <div className="p-8 text-center">
                      <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                      <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load operating hours</p>
                      <Button onClick={() => refetchOh()} variant="outline" className="mt-4 rounded-xl">Try Again</Button>
                    </div>
                  ) : operatingHours.length === 0 ? (
                    <div className="p-8 text-center">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 dark:text-slate-400 font-medium">No operating hours found</p>
                      <Button onClick={handleOpenCreateOh} className="mt-4 rounded-xl">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Hours
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</TableHead>
                          <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Day</TableHead>
                          <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Start</TableHead>
                          <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">End</TableHead>
                          <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {operatingHours.map((oh) => (
                          <TableRow key={oh.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <TableCell className="px-4 py-3">
                              <Badge className={cn('text-[10px] font-bold border', oh.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                                {oh.active ? <><CheckCircle className="w-3 h-3 mr-1" /> Active</> : <><XCircle className="w-3 h-3 mr-1" /> Inactive</>}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 font-medium">{DAY_LABELS[oh.dayOfWeek]}</TableCell>
                            <TableCell className="px-4 py-3">{formatTime(oh.startTime)}</TableCell>
                            <TableCell className="px-4 py-3">{formatTime(oh.endTime)}</TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                {oh.active ? (
                                  <Button variant="ghost" size="sm" onClick={() => handleDeactivateOh(oh.id)} disabled={deactivateOhMutation.isPending} className="h-8 w-8 p-0 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Deactivate">
                                    <PowerOff className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => handleActivateOh(oh.id)} disabled={activateOhMutation.isPending} className="h-8 w-8 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Activate">
                                    <Power className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => handleOpenEditOh(oh)} className="h-8 w-8 p-0 rounded-lg" title="Edit">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== TIME SLOTS TAB ==================== */}
          <TabsContent value="slots" className="space-y-6">
            {/* Filters & Actions */}
            <section className="flex flex-wrap gap-4 items-end justify-between">
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800 flex-1 min-w-[300px]">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</Label>
                      <Select value={tsActiveFilter} onValueChange={setTsActiveFilter}>
                        <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVE_FILTER_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Label</Label>
                      <Input
                        value={tsLabelFilter}
                        onChange={(e) => setTsLabelFilter(e.target.value)}
                        placeholder="Search..."
                        className="mt-1.5 rounded-xl h-9 w-44"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={resetTsFilters} className="rounded-xl">Reset</Button>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <Button onClick={handleOpenCreateTs} size="sm" className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Slot
                </Button>
                <Button onClick={() => refetchTs()} disabled={tsFetching} variant="outline" size="sm" className="rounded-xl">
                  <RefreshCw className={cn("h-3.5 w-3.5", tsFetching && "animate-spin")} />
                </Button>
              </div>
            </section>

            {/* Time Slots Table */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardContent className="p-0">
                {tsLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                  </div>
                ) : tsError ? (
                  <div className="p-8 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                    <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load time slots</p>
                    <Button onClick={() => refetchTs()} variant="outline" className="mt-4 rounded-xl">Try Again</Button>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="p-8 text-center">
                    <Timer className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-400 font-medium">No time slots found</p>
                    <Button onClick={handleOpenCreateTs} className="mt-4 rounded-xl">
                      <Plus className="h-4 w-4 mr-1" />
                      Create Slot
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Label</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Start</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">End</TableHead>
                        <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeSlots.map((ts) => (
                        <TableRow key={ts.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <TableCell className="px-4 py-3">
                            <Badge className={cn('text-[10px] font-bold border', ts.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                              {ts.active ? <><CheckCircle className="w-3 h-3 mr-1" /> Active</> : <><XCircle className="w-3 h-3 mr-1" /> Inactive</>}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 font-medium">{ts.label}</TableCell>
                          <TableCell className="px-4 py-3">{formatTime(ts.startTime)}</TableCell>
                          <TableCell className="px-4 py-3">{formatTime(ts.endTime)}</TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {ts.active ? (
                                <Button variant="ghost" size="sm" onClick={() => handleDeactivateTs(ts.id)} disabled={deactivateTsMutation.isPending} className="h-8 w-8 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Deactivate">
                                  <Power className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => handleActivateTs(ts.id)} disabled={activateTsMutation.isPending} className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50" title="Activate">
                                  <PowerOff className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => handleOpenEditTs(ts)} className="h-8 w-8 p-0 rounded-lg" title="Edit">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ==================== POLICY MODAL ==================== */}
      <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{editingPolicy ? 'Edit Policy' : 'Create Policy'}</DialogTitle>
            <DialogDescription>Configure scheduling rules for customer and service combinations.</DialogDescription>
          </DialogHeader>
          <form onSubmit={policyForm.handleSubmit(handleSubmitPolicy)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer Type *</Label>
                <Select value={policyForm.watch('customerType')} onValueChange={(v) => policyForm.setValue('customerType', v as CustomerType)}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUSINESS">Business</SelectItem>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Service Type</Label>
                <Select value={policyForm.watch('serviceType') || 'all'} onValueChange={(v) => policyForm.setValue('serviceType', v === 'all' ? null : v as ServiceType)}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="HOME_DELIVERY">Home Delivery</SelectItem>
                    <SelectItem value="BETWEEN_LOCATIONS">Between Locations</SelectItem>
                    <SelectItem value="SERVICE_PICKUP_RETURN">Service Pickup/Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Default Mode *</Label>
                <Select value={policyForm.watch('defaultMode')} onValueChange={(v) => policyForm.setValue('defaultMode', v as DefaultMode)}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAME_DAY">Same Day</SelectItem>
                    <SelectItem value="NEXT_DAY">Next Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Buffer Minutes *</Label>
                <Input type="number" {...policyForm.register('bufferMinutes', { valueAsNumber: true })} className="mt-1.5 rounded-xl h-10" placeholder="30" />
              </div>
            </div>
            {policyForm.watch('defaultMode') === 'SAME_DAY' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cutoff Time</Label>
                  <Input type="time" {...policyForm.register('sameDayCutoffTime')} className="mt-1.5 rounded-xl h-10" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Miles</Label>
                  <Input type="number" {...policyForm.register('maxSameDayMiles', { valueAsNumber: true })} className="mt-1.5 rounded-xl h-10" placeholder="25" />
                </div>
              </div>
            )}
            <div className="space-y-3">
              {[
                { name: 'active', label: 'Active', desc: 'Enable this policy for scheduling' },
                { name: 'afterHoursEnabled', label: 'After Hours Enabled', desc: 'Allow scheduling outside normal hours' },
                { name: 'requiresOpsConfirmation', label: 'Requires Ops Confirmation', desc: 'Manual confirmation required before dispatch' },
              ].map(({ name, label, desc }) => (
                <div key={name} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="font-bold text-sm">{label}</div>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                  <Switch checked={policyForm.watch(name as any)} onCheckedChange={(checked) => policyForm.setValue(name as any, checked)} />
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClosePolicyModal} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={upsertPolicyMutation.isPending} className="rounded-xl bg-primary text-slate-950 hover:bg-primary/90">
                {upsertPolicyMutation.isPending ? 'Saving...' : (editingPolicy ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== OPERATING HOURS MODAL ==================== */}
      <Dialog open={isOhModalOpen} onOpenChange={setIsOhModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{editingOh ? 'Edit Operating Hours' : 'Add Operating Hours'}</DialogTitle>
            <DialogDescription>Set operating hours for a specific day.</DialogDescription>
          </DialogHeader>
          <form onSubmit={ohForm.handleSubmit(handleSubmitOh)} className="space-y-4">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Day of Week *</Label>
              <Select value={String(ohForm.watch('dayOfWeek'))} onValueChange={(v) => ohForm.setValue('dayOfWeek', parseInt(v) as DayOfWeek)}>
                <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DAY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Start Time *</Label>
                <Input type="time" {...ohForm.register('startTime')} className="mt-1.5 rounded-xl h-10" />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">End Time *</Label>
                <Input type="time" {...ohForm.register('endTime')} className="mt-1.5 rounded-xl h-10" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <div className="font-bold text-sm">Active</div>
                <p className="text-xs text-slate-500">Enable these operating hours</p>
              </div>
              <Switch checked={ohForm.watch('active')} onCheckedChange={(checked) => ohForm.setValue('active', checked)} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleCloseOhModal} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={upsertOhMutation.isPending} className="rounded-xl bg-primary text-slate-950 hover:bg-primary/90">
                {upsertOhMutation.isPending ? 'Saving...' : (editingOh ? 'Update' : 'Add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== TIME SLOT MODAL ==================== */}
      <Dialog open={isTsModalOpen} onOpenChange={setIsTsModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{editingTs ? 'Edit Time Slot' : 'Create Time Slot'}</DialogTitle>
            <DialogDescription>Define a time slot template for scheduling.</DialogDescription>
          </DialogHeader>
          <form onSubmit={tsForm.handleSubmit(handleSubmitTs)} className="space-y-4">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Label *</Label>
              <Input {...tsForm.register('label')} className="mt-1.5 rounded-xl h-10" placeholder="e.g., 9 AM - 11 AM" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Start Time *</Label>
                <Input type="time" {...tsForm.register('startTime')} className="mt-1.5 rounded-xl h-10" />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">End Time *</Label>
                <Input type="time" {...tsForm.register('endTime')} className="mt-1.5 rounded-xl h-10" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <div className="font-bold text-sm">Active</div>
                <p className="text-xs text-slate-500">Enable this time slot</p>
              </div>
              <Switch checked={tsForm.watch('active')} onCheckedChange={(checked) => tsForm.setValue('active', checked)} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleCloseTsModal} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={upsertTsMutation.isPending} className="rounded-xl bg-primary text-slate-950 hover:bg-primary/90">
                {upsertTsMutation.isPending ? 'Saving...' : (editingTs ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
