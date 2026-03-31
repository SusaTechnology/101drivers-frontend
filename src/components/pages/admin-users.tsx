// components/pages/admin-users.tsx
// Admin Users Management Page - Unified Users Table
import React, { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import {
  useAdminUsers,
  useAdminUsersSummary,
  useApproveCustomer,
  useRejectCustomer,
  useSuspendCustomer,
  useUnsuspendCustomer,
  useApproveDriver,
  useRejectDriver,
  useSuspendDriver,
  useUnsuspendDriver,
  useCreateAdminUser,
  getActorUserId,
} from '@/hooks/useAdminUsers';
import type {
  AdminUserRow,
  AdminUsersQueryParams,
  UserRole,
  CustomerType,
  CustomerApprovalStatus,
  DriverStatus,
  CreateAdminUserRequest,
} from '@/types/users';
import {
  USER_ROLE_LABELS,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_APPROVAL_STATUS_LABELS,
  DRIVER_STATUS_LABELS,
  getUserRoleColor,
  getCustomerApprovalStatusColor,
  getDriverStatusColor,
  formatDate,
  formatDateTime,
  getInitials,
} from '@/types/users';
import {
  Users,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Ban,
  ArrowLeft,
  User,
  Truck,
  Store,
  Shield,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  X,
  Plus,
  Mail,
  Phone,
  Lock,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ==================== SCHEMAS ====================

const suspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const createAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SuspendFormData = z.infer<typeof suspendSchema>;
type RejectFormData = z.infer<typeof rejectSchema>;
type CreateAdminFormData = z.infer<typeof createAdminSchema>;

// ==================== CONSTANTS ====================

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'PRIVATE_CUSTOMER', label: 'Private Customer' },
  { value: 'BUSINESS_CUSTOMER', label: 'Business Customer' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'ADMIN', label: 'Admin' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const CUSTOMER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PRIVATE', label: 'Private' },
];

const CUSTOMER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const DRIVER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const SORT_BY_OPTIONS: { value: string; label: string }[] = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Updated Date' },
  { value: 'email', label: 'Email' },
  { value: 'username', label: 'Username' },
  { value: 'fullName', label: 'Full Name' },
  { value: 'lastLoginAt', label: 'Last Login' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ==================== HELPER COMPONENTS ====================

function RoleBadge({ role }: { role: UserRole }) {
  const color = getUserRoleColor(role);
  const Icon = role === 'DRIVER' ? Truck : role === 'BUSINESS_CUSTOMER' ? Store : role === 'ADMIN' ? Shield : User;

  return (
    <Badge className={cn(
      'text-[10px] font-bold border',
      color === 'indigo' && 'bg-indigo-50 text-indigo-700 border-indigo-200',
      color === 'sky' && 'bg-sky-50 text-sky-700 border-sky-200',
      color === 'primary' && 'bg-primary/10 text-primary border-primary/25',
      color === 'slate' && 'bg-slate-50 text-slate-600 border-slate-200',
    )}>
      <Icon className="w-3 h-3 mr-1" />
      {USER_ROLE_LABELS[role]}
    </Badge>
  );
}

function StatusBadge({ isActive, disabledAt }: { isActive: boolean; disabledAt: string | null }) {
  if (disabledAt) {
    return (
      <Badge className="text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
        <Ban className="w-3 h-3 mr-1" />
        Suspended
      </Badge>
    );
  }
  if (isActive) {
    return (
      <Badge className="text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-200">
      <XCircle className="w-3 h-3 mr-1" />
      Inactive
    </Badge>
  );
}

function CustomerStatusBadge({ status }: { status: CustomerApprovalStatus }) {
  const color = getCustomerApprovalStatusColor(status);
  const Icon = status === 'APPROVED' ? CheckCircle : status === 'SUSPENDED' ? Ban : status === 'REJECTED' ? XCircle : Clock;

  return (
    <Badge className={cn(
      'text-[10px] font-bold border',
      color === 'emerald' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
      color === 'amber' && 'bg-amber-50 text-amber-700 border-amber-200',
      color === 'rose' && 'bg-rose-50 text-rose-700 border-rose-200',
      color === 'slate' && 'bg-slate-50 text-slate-600 border-slate-200',
    )}>
      <Icon className="w-3 h-3 mr-1" />
      {CUSTOMER_APPROVAL_STATUS_LABELS[status]}
    </Badge>
  );
}

function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const color = getDriverStatusColor(status);
  const Icon = status === 'APPROVED' ? CheckCircle : status === 'SUSPENDED' ? Ban : Clock;

  return (
    <Badge className={cn(
      'text-[10px] font-bold border',
      color === 'emerald' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
      color === 'amber' && 'bg-amber-50 text-amber-700 border-amber-200',
      color === 'rose' && 'bg-rose-50 text-rose-700 border-rose-200',
    )}>
      <Icon className="w-3 h-3 mr-1" />
      {DRIVER_STATUS_LABELS[status]}
    </Badge>
  );
}

// ==================== SKELETON LOADERS ====================

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {[1, 2, 3, 4, 5].map(i => (
        <Card key={i} className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-7 w-12" />
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function AdminUsersPage() {
  const { actionItems, signOut } = useAdminActions();
  const actorUserId = getActorUserId();
  const navigate = useNavigate();

  // ==================== FILTER STATE ====================
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
  const [driverStatusFilter, setDriverStatusFilter] = useState('all');
  const [hasCustomerFilter, setHasCustomerFilter] = useState('all');
  const [hasDriverFilter, setHasDriverFilter] = useState('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showFilters, setShowFilters] = useState(false);

  // ==================== DIALOG STATE ====================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve-customer' | 'reject-customer' | 'suspend-customer' | 'unsuspend-customer' | 'approve-driver' | 'reject-driver' | 'suspend-driver' | 'unsuspend-driver'>('approve-customer');
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  // Create Admin Dialog State
  const [createAdminDialogOpen, setCreateAdminDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ==================== QUERIES ====================

  const queryParams = useMemo((): Parameters<typeof useAdminUsers>[0] => ({
    q: searchQuery || undefined,
    roles: roleFilter !== 'all' ? roleFilter as UserRole : undefined,
    isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
    hasCustomer: hasCustomerFilter === 'yes' ? true : hasCustomerFilter === 'no' ? false : undefined,
    hasDriver: hasDriverFilter === 'yes' ? true : hasDriverFilter === 'no' ? false : undefined,
    customerType: customerTypeFilter !== 'all' ? customerTypeFilter as CustomerType : undefined,
    customerApprovalStatus: customerStatusFilter !== 'all' ? customerStatusFilter as CustomerApprovalStatus : undefined,
    driverStatus: driverStatusFilter !== 'all' ? driverStatusFilter as DriverStatus : undefined,
    createdFrom: createdFrom || undefined,
    createdTo: createdTo || undefined,
    sortBy: sortBy as AdminUsersQueryParams['sortBy'],
    sortOrder,
    page,
    pageSize,
  }), [searchQuery, roleFilter, statusFilter, hasCustomerFilter, hasDriverFilter, customerTypeFilter, customerStatusFilter, driverStatusFilter, createdFrom, createdTo, sortBy, sortOrder, page, pageSize]);

  const {
    data: usersData,
    isLoading: usersLoading,
    isFetching: usersFetching,
    isError: usersError,
    refetch: refetchUsers,
  } = useAdminUsers(queryParams);

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useAdminUsersSummary();

  // ==================== MUTATIONS ====================

  const approveCustomerMutation = useApproveCustomer();
  const rejectCustomerMutation = useRejectCustomer();
  const suspendCustomerMutation = useSuspendCustomer();
  const unsuspendCustomerMutation = useUnsuspendCustomer();
  const approveDriverMutation = useApproveDriver();
  const rejectDriverMutation = useRejectDriver();
  const suspendDriverMutation = useSuspendDriver();
  const unsuspendDriverMutation = useUnsuspendDriver();
  const createAdminMutation = useCreateAdminUser();

  // ==================== FORMS ====================

  const suspendForm = useForm<SuspendFormData>({
    resolver: zodResolver(suspendSchema),
    defaultValues: { reason: '' },
  });

  const rejectForm = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });

  const createAdminForm = useForm<CreateAdminFormData>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
      isActive: true,
    },
  });

  // ==================== HANDLERS ====================

  const handleViewUser = useCallback((id: string) => {
    navigate({ to: `/admin-user-detail/${id}` });
  }, [navigate]);

  const openDialog = useCallback((action: typeof dialogAction, user: AdminUserRow) => {
    setDialogAction(action);
    setSelectedUser(user);
    setDialogOpen(true);
    suspendForm.reset();
    rejectForm.reset();
  }, [suspendForm, rejectForm]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedUser(null);
  }, []);

  const handleApproveCustomer = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    approveCustomerMutation.mutate({
      pathParams: { id: selectedUser.id },
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Customer approved successfully');
        closeDialog();
      },
      onError: () => toast.error('Failed to approve customer'),
    });
  }, [selectedUser, actorUserId, approveCustomerMutation, closeDialog]);

  const handleRejectCustomer = useCallback((data: RejectFormData) => {
    if (!selectedUser || !actorUserId) return;
    rejectCustomerMutation.mutate({
      pathParams: { id: selectedUser.id },
      ...data,
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Customer rejected');
        closeDialog();
      },
      onError: () => toast.error('Failed to reject customer'),
    });
  }, [selectedUser, actorUserId, rejectCustomerMutation, closeDialog]);

  const handleSuspendCustomer = useCallback((data: SuspendFormData) => {
    if (!selectedUser || !actorUserId) return;
    suspendCustomerMutation.mutate({
      pathParams: { id: selectedUser.id },
      ...data,
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Customer suspended successfully');
        closeDialog();
      },
      onError: () => toast.error('Failed to suspend customer'),
    });
  }, [selectedUser, actorUserId, suspendCustomerMutation, closeDialog]);

  const handleUnsuspendCustomer = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    unsuspendCustomerMutation.mutate({
      pathParams: { id: selectedUser.id },
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Customer unsuspended successfully');
        closeDialog();
      },
      onError: () => toast.error('Failed to unsuspend customer'),
    });
  }, [selectedUser, actorUserId, unsuspendCustomerMutation, closeDialog]);

  const handleApproveDriver = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    approveDriverMutation.mutate({
      pathParams: { id: selectedUser.id },
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Driver approved successfully');
        closeDialog();
      },
      onError: () => toast.error('Failed to approve driver'),
    });
  }, [selectedUser, actorUserId, approveDriverMutation, closeDialog]);

  const handleRejectDriver = useCallback((data: RejectFormData) => {
    if (!selectedUser || !actorUserId) return;
    rejectDriverMutation.mutate({
      pathParams: { id: selectedUser.id },
      ...data,
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Driver rejected');
        closeDialog();
      },
      onError: () => toast.error('Failed to reject driver'),
    });
  }, [selectedUser, actorUserId, rejectDriverMutation, closeDialog]);

  const handleSuspendDriver = useCallback((data: SuspendFormData) => {
    if (!selectedUser || !actorUserId) return;
    suspendDriverMutation.mutate({
      pathParams: { id: selectedUser.id },
      ...data,
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Driver suspended successfully');
        closeDialog();
      },
      onError: () => toast.error('Failed to suspend driver'),
    });
  }, [selectedUser, actorUserId, suspendDriverMutation, closeDialog]);

  const handleUnsuspendDriver = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    unsuspendDriverMutation.mutate({
      pathParams: { id: selectedUser.id },
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Driver unsuspended successfully');
        closeDialog();
      },
      onError: () => toast.error('Failed to unsuspend driver'),
    });
  }, [selectedUser, actorUserId, unsuspendDriverMutation, closeDialog]);

  const handleRefresh = useCallback(() => {
    refetchUsers();
    refetchSummary();
    toast.success('Data refreshed');
  }, [refetchUsers, refetchSummary]);

  const handleCreateAdmin = useCallback((data: CreateAdminFormData) => {
    if (!actorUserId) {
      toast.error('Unable to identify current user');
      return;
    }

    const payload: CreateAdminUserRequest = {
      email: data.email,
      username: data.username,
      password: data.password,
      fullName: data.fullName,
      phone: data.phone || undefined,
      isActive: data.isActive,
      actorUserId,
    };

    createAdminMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Admin user created successfully');
        setCreateAdminDialogOpen(false);
        createAdminForm.reset();
      },
      onError: (error: any) => {
        toast.error(error?.message || 'Failed to create admin user');
      },
    });
  }, [actorUserId, createAdminMutation, createAdminForm]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: string) => {
    setPageSize(Number(newSize));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setCustomerTypeFilter('all');
    setCustomerStatusFilter('all');
    setDriverStatusFilter('all');
    setHasCustomerFilter('all');
    setHasDriverFilter('all');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(1);
  }, []);

  const hasActiveFilters = searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ||
    customerTypeFilter !== 'all' || customerStatusFilter !== 'all' || driverStatusFilter !== 'all' ||
    hasCustomerFilter !== 'all' || hasDriverFilter !== 'all' || createdFrom || createdTo;

  // ==================== RENDER ====================

  const users = usersData?.rows ?? [];
  const pagination = usersData?.pagination;

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
            <h1 className="text-2xl lg:text-3xl font-black">Users Management</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Manage all users across the platform: customers, drivers, and administrators. View details, suspend accounts, and track user activity.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setCreateAdminDialogOpen(true)}
              className="bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 rounded-xl"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Create Admin
            </Button>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="rounded-xl">
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', usersFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </section>

        {/* Summary Cards */}
        {summaryLoading ? (
          <SummarySkeleton />
        ) : summary && (
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Users</div>
              <div className="text-xl font-black mt-1">{summary.totalUsers}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Active</div>
              <div className="text-xl font-black mt-1 text-emerald-600">{summary.activeUsers}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Inactive</div>
              <div className="text-xl font-black mt-1 text-rose-600">{summary.inactiveUsers}</div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Pending Approvals</div>
              <div className="text-xl font-black mt-1 text-amber-600">
                {summary.pendingApprovals.customers + summary.pendingApprovals.drivers}
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">
                {summary.pendingApprovals.customers} customers, {summary.pendingApprovals.drivers} drivers
              </div>
            </Card>
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">By Role</div>
              <div className="text-xs mt-1 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Drivers:</span>
                  <span className="font-bold">{summary.byRole.drivers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customers:</span>
                  <span className="font-bold">{summary.byRole.privateCustomers + summary.byRole.businessCustomers}</span>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Filters */}
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 mb-6">
          <CardContent className="p-4">
            {/* Primary Filters Row */}
            <div className="flex flex-wrap gap-3 items-end">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Search</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Name, email, username..."
                    className="pl-9 rounded-xl h-9 w-full"
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div className="w-40">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</Label>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-32">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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

              {/* Toggle More Filters */}
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-3.5 h-3.5 mr-1" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-primary" />
                )}
              </Button>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="rounded-xl h-9" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Extended Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap gap-3 items-end">
                  {/* Customer Type */}
                  <div className="w-36">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer Type</Label>
                    <Select value={customerTypeFilter} onValueChange={(v) => { setCustomerTypeFilter(v); setPage(1); }}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Customer Status */}
                  <div className="w-36">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer Status</Label>
                    <Select value={customerStatusFilter} onValueChange={(v) => { setCustomerStatusFilter(v); setPage(1); }}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Driver Status */}
                  <div className="w-36">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Driver Status</Label>
                    <Select value={driverStatusFilter} onValueChange={(v) => { setDriverStatusFilter(v); setPage(1); }}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DRIVER_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Has Customer */}
                  <div className="w-32">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Has Customer</Label>
                    <Select value={hasCustomerFilter} onValueChange={(v) => { setHasCustomerFilter(v); setPage(1); }}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Has Driver */}
                  <div className="w-32">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Has Driver</Label>
                    <Select value={hasDriverFilter} onValueChange={(v) => { setHasDriverFilter(v); setPage(1); }}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Created From */}
                  <div className="w-40">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created From</Label>
                    <Input
                      type="date"
                      value={createdFrom}
                      onChange={(e) => { setCreatedFrom(e.target.value); setPage(1); }}
                      className="mt-1.5 rounded-xl h-9 text-sm"
                    />
                  </div>

                  {/* Created To */}
                  <div className="w-40">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created To</Label>
                    <Input
                      type="date"
                      value={createdTo}
                      onChange={(e) => { setCreatedTo(e.target.value); setPage(1); }}
                      className="mt-1.5 rounded-xl h-9 text-sm"
                    />
                  </div>

                  {/* Sort By */}
                  <div className="w-40">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_BY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sort Order */}
                  <div className="w-28">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order</Label>
                    <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Page Size */}
                  <div className="w-28">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Per Page</Label>
                    <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {usersLoading ? (
              <TableSkeleton rows={pageSize} />
            ) : usersError ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load users</p>
                <Button onClick={() => refetchUsers()} variant="outline" className="mt-4 rounded-xl">Try Again</Button>
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 dark:text-slate-400 font-medium">No users found</p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer Info</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Driver Info</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</TableHead>
                      <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow
                        key={user.id}
                        className="border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        onClick={() => handleViewUser(user.id)}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 rounded-xl">
                              <AvatarImage src={user.driver?.profilePhotoUrl || undefined} alt={user.fullName} />
                              <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-sm font-bold rounded-xl">
                                {getInitials(user.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{user.fullName}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <RoleBadge role={user.roles} />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <StatusBadge isActive={user.isActive} disabledAt={user.disabledAt} />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {user.customer ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] font-bold">
                                  {CUSTOMER_TYPE_LABELS[user.customer.customerType]}
                                </Badge>
                                <CustomerStatusBadge status={user.customer.approvalStatus} />
                              </div>
                              {user.customer.businessName && (
                                <div className="text-xs text-slate-500">{user.customer.businessName}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {user.driver ? (
                            <div className="space-y-1">
                              <DriverStatusBadge status={user.driver.status} />
                              <div className="text-xs text-slate-500">
                                {user._count.scheduleChangesRequested} schedule requests
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(user.createdAt)}
                          </div>
                          {user.lastLoginAt && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Last login: {formatDate(user.lastLoginAt)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => handleViewUser(user.id)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                            {/* Customer suspended - show Unsuspend Customer */}
                            {!user.disabledAt && user.customer?.approvalStatus === 'SUSPENDED' && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                onClick={() => openDialog('unsuspend-customer', user)}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Unsuspend Customer
                              </Button>
                            )}
                            {/* Driver suspended - show Unsuspend Driver */}
                            {!user.disabledAt && user.driver?.status === 'SUSPENDED' && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                onClick={() => openDialog('unsuspend-driver', user)}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Unsuspend Driver
                              </Button>
                            )}
                            {/* Driver pending approval - show Approve/Reject */}
                            {!user.disabledAt && user.driver?.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                  onClick={() => openDialog('approve-driver', user)}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="rounded-lg"
                                  onClick={() => openDialog('reject-driver', user)}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {/* Customer pending approval - show Approve/Reject */}
                            {!user.disabledAt && user.customer?.approvalStatus === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                  onClick={() => openDialog('approve-customer', user)}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="rounded-lg"
                                  onClick={() => openDialog('reject-customer', user)}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {/* Customer approved - show Suspend Customer */}
                            {!user.disabledAt && user.customer?.approvalStatus === 'APPROVED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={() => openDialog('suspend-customer', user)}
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" /> Suspend Customer
                              </Button>
                            )}
                            {/* Driver approved - show Suspend Driver */}
                            {!user.disabledAt && user.driver?.status === 'APPROVED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={() => openDialog('suspend-driver', user)}
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" /> Suspend Driver
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                      {Math.min(pagination.page * pagination.pageSize, pagination.totalRows)} of{' '}
                      {pagination.totalRows} users
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8"
                        disabled={pagination.page <= 1}
                        onClick={() => handlePageChange(pagination.page - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="text-xs font-medium">
                        Page {pagination.page} of {pagination.totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => handlePageChange(pagination.page + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {dialogAction === 'approve-customer' && 'Approve Customer'}
              {dialogAction === 'reject-customer' && 'Reject Customer'}
              {dialogAction === 'suspend-customer' && 'Suspend Customer'}
              {dialogAction === 'unsuspend-customer' && 'Unsuspend Customer'}
              {dialogAction === 'approve-driver' && 'Approve Driver'}
              {dialogAction === 'reject-driver' && 'Reject Driver'}
              {dialogAction === 'suspend-driver' && 'Suspend Driver'}
              {dialogAction === 'unsuspend-driver' && 'Unsuspend Driver'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'approve-customer' && `Approve ${selectedUser?.fullName} as a customer? They will be able to create deliveries.`}
              {dialogAction === 'reject-customer' && `Reject ${selectedUser?.fullName}'s customer application?`}
              {dialogAction === 'suspend-customer' && `Suspend ${selectedUser?.fullName}'s customer account? They will not be able to create deliveries.`}
              {dialogAction === 'unsuspend-customer' && `Restore ${selectedUser?.fullName}'s customer account? They will be able to create deliveries again.`}
              {dialogAction === 'approve-driver' && `Approve ${selectedUser?.fullName} as a driver? They will be able to accept delivery assignments.`}
              {dialogAction === 'reject-driver' && `Reject ${selectedUser?.fullName}'s driver application?`}
              {dialogAction === 'suspend-driver' && `Suspend ${selectedUser?.fullName}'s driver account? They will not be able to accept deliveries.`}
              {dialogAction === 'unsuspend-driver' && `Restore ${selectedUser?.fullName}'s driver account? They will be able to accept deliveries again.`}
            </DialogDescription>
          </DialogHeader>

          {/* Approve Customer Confirmation */}
          {dialogAction === 'approve-customer' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  The customer will receive an email notification and be able to create deliveries.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleApproveCustomer}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  disabled={approveCustomerMutation.isPending}
                >
                  {approveCustomerMutation.isPending ? 'Approving...' : 'Approve Customer'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Reject Customer Form */}
          {dialogAction === 'reject-customer' && (
            <form onSubmit={rejectForm.handleSubmit(handleRejectCustomer)} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Reason for rejection</Label>
                <Textarea
                  {...rejectForm.register('reason')}
                  placeholder="Enter reason..."
                  className="mt-1.5 rounded-xl"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={rejectCustomerMutation.isPending}
                >
                  {rejectCustomerMutation.isPending ? 'Rejecting...' : 'Reject Application'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Approve Driver Confirmation */}
          {dialogAction === 'approve-driver' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  The driver will receive an email notification and be able to accept delivery assignments.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleApproveDriver}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  disabled={approveDriverMutation.isPending}
                >
                  {approveDriverMutation.isPending ? 'Approving...' : 'Approve Driver'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Reject Driver Form */}
          {dialogAction === 'reject-driver' && (
            <form onSubmit={rejectForm.handleSubmit(handleRejectDriver)} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Reason for rejection</Label>
                <Textarea
                  {...rejectForm.register('reason')}
                  placeholder="Enter reason..."
                  className="mt-1.5 rounded-xl"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={rejectDriverMutation.isPending}
                >
                  {rejectDriverMutation.isPending ? 'Rejecting...' : 'Reject Application'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Suspend Customer Form */}
          {dialogAction === 'suspend-customer' && (
            <form onSubmit={suspendForm.handleSubmit(handleSuspendCustomer)} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Reason for suspension</Label>
                <Textarea
                  {...suspendForm.register('reason')}
                  placeholder="Enter reason..."
                  className="mt-1.5 rounded-xl"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={suspendCustomerMutation.isPending}
                >
                  {suspendCustomerMutation.isPending ? 'Suspending...' : 'Suspend Customer'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Unsuspend Customer Confirmation */}
          {dialogAction === 'unsuspend-customer' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  The customer will be able to create deliveries again.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleUnsuspendCustomer}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  disabled={unsuspendCustomerMutation.isPending}
                >
                  {unsuspendCustomerMutation.isPending ? 'Restoring...' : 'Restore Customer'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Suspend Driver Form */}
          {dialogAction === 'suspend-driver' && (
            <form onSubmit={suspendForm.handleSubmit(handleSuspendDriver)} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Reason for suspension</Label>
                <Textarea
                  {...suspendForm.register('reason')}
                  placeholder="Enter reason..."
                  className="mt-1.5 rounded-xl"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={suspendDriverMutation.isPending}
                >
                  {suspendDriverMutation.isPending ? 'Suspending...' : 'Suspend Driver'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Unsuspend Driver Confirmation */}
          {dialogAction === 'unsuspend-driver' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  The driver will be able to accept delivery assignments again.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleUnsuspendDriver}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  disabled={unsuspendDriverMutation.isPending}
                >
                  {unsuspendDriverMutation.isPending ? 'Restoring...' : 'Restore Driver'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Admin Dialog */}
      <Dialog open={createAdminDialogOpen} onOpenChange={setCreateAdminDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Create Admin User
            </DialogTitle>
            <DialogDescription>
              Create a new administrator account with full platform access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createAdminForm.handleSubmit(handleCreateAdmin)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="md:col-span-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  {...createAdminForm.register('fullName')}
                  placeholder="John Doe"
                  className="mt-1.5 rounded-xl"
                />
                {createAdminForm.formState.errors.fullName && (
                  <p className="text-xs text-rose-500 mt-1">
                    {createAdminForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email <span className="text-rose-500">*</span>
                </Label>
                <Input
                  {...createAdminForm.register('email')}
                  type="email"
                  placeholder="admin@example.com"
                  className="mt-1.5 rounded-xl"
                />
                {createAdminForm.formState.errors.email && (
                  <p className="text-xs text-rose-500 mt-1">
                    {createAdminForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Username */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Username <span className="text-rose-500">*</span>
                </Label>
                <Input
                  {...createAdminForm.register('username')}
                  placeholder="johndoe"
                  className="mt-1.5 rounded-xl"
                />
                {createAdminForm.formState.errors.username && (
                  <p className="text-xs text-rose-500 mt-1">
                    {createAdminForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Password <span className="text-rose-500">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    {...createAdminForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {createAdminForm.formState.errors.password && (
                  <p className="text-xs text-rose-500 mt-1">
                    {createAdminForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Confirm Password <span className="text-rose-500">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    {...createAdminForm.register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {createAdminForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-rose-500 mt-1">
                    {createAdminForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Phone
                </Label>
                <Input
                  {...createAdminForm.register('phone')}
                  placeholder="+1 555 123 4567"
                  className="mt-1.5 rounded-xl"
                />
              </div>

              {/* Is Active */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...createAdminForm.register('isActive')}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Account is active</span>
                </label>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <Shield className="w-4 h-4 inline mr-1" />
                This user will have full administrative access to the platform.
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateAdminDialogOpen(false);
                  createAdminForm.reset();
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20"
                disabled={createAdminMutation.isPending}
              >
                {createAdminMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Create Admin
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
