// components/pages/admin-user-detail.tsx
// Admin User Detail Page - Real API Integration
import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  History,
  Shield,
  AlertCircle,
  User,
  Truck,
  Store,
  Calendar,
  Clock,
  Mail,
  Phone,
  MapPin,
  Bell,
  Settings,
  Ban,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Activity,
  Map,
  DollarSign,
  Star,
  Users,
  Package,
  AlertTriangle,
  RefreshCw,
  Edit,
  Save,
  XIcon,
  Send,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from 'next-themes';
import { useAdminActions } from '@/hooks/useAdminActions';
import {
  useAdminUserDetail,
  useApproveCustomer,
  useRejectCustomer,
  useSuspendCustomer,
  useUnsuspendCustomer,
  useApproveDriver,
  useRejectDriver,
  useSuspendDriver,
  useUnsuspendDriver,
  useInviteDriver,
  useAdminUpdateUser,
  getActorUserId,
} from '@/hooks/useAdminUsers';
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
import type { AdminUserDetail, AdminUpdateUserRequest } from '@/types/users';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';

// ==================== SCHEMAS ====================

const suspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const editUserSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  fullName: z.string().min(1, 'Full name is required').optional(),
  phone: z.string().optional(),
});

const editCustomerSchema = z.object({
  phone: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  defaultPickupId: z.string().optional(),
  postpaidEnabled: z.boolean().optional(),
});

const editDriverSchema = z.object({
  phone: z.string().optional(),
  profilePhotoUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type SuspendFormData = z.infer<typeof suspendSchema>;
type RejectFormData = z.infer<typeof rejectSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;
type EditCustomerFormData = z.infer<typeof editCustomerSchema>;
type EditDriverFormData = z.infer<typeof editDriverSchema>;

// ==================== PROPS ====================

interface AdminUserDetailPageProps {
  userId: string;
}

// ==================== HELPER COMPONENTS ====================

function StatusBadge({
  status,
  color = 'slate',
  icon: Icon,
  className,
}: {
  status: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
    amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
    rose: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-200',
    slate: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
    primary: 'bg-primary/10 border-primary/25 text-primary-foreground',
    sky: 'bg-sky-50 dark:bg-sky-900/10 border-sky-100 dark:border-sky-900/30 text-sky-900 dark:text-sky-200',
  };

  const StatusIcon = Icon || CheckCircle;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border',
        colors[color] || colors.slate,
        className
      )}
    >
      <StatusIcon className="w-3.5 h-3.5" />
      {status}
    </Badge>
  );
}

function PillBadge({
  children,
  icon: Icon,
  color = 'slate',
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  const colors: Record<string, string> = {
    slate: 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200',
    amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-indigo-900 dark:text-indigo-200',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200',
    sky: 'bg-sky-50 dark:bg-sky-900/10 border-sky-100 dark:border-sky-900/30 text-sky-900 dark:text-sky-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border',
        colors[color] || colors.slate
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className="mt-2 text-xl font-black text-slate-900 dark:text-white font-mono">
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{subtitle}</div>
      )}
    </div>
  );
}

// ==================== SKELETON LOADERS ====================

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-5 space-y-6">
          {[1, 2].map((i) => (
            <Card key={i} className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function AdminUserDetailPage({ userId }: AdminUserDetailPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { actionItems, signOut: adminSignOut } = useAdminActions();
  const actorUserId = getActorUserId();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve-customer' | 'reject-customer' | 'suspend-customer' | 'unsuspend-customer' | 'invite-driver' | 'approve-driver' | 'reject-driver' | 'suspend-driver' | 'unsuspend-driver'>('approve-customer');

  // Edit mode state
  const [editMode, setEditMode] = useState<'none' | 'user' | 'customer' | 'driver'>('none');
  const [postpaidEnabled, setPostpaidEnabled] = useState(false);

  // ==================== QUERIES ====================

  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useAdminUserDetail(userId);

  // ==================== MUTATIONS ====================

  const approveCustomerMutation = useApproveCustomer();
  const rejectCustomerMutation = useRejectCustomer();
  const suspendCustomerMutation = useSuspendCustomer();
  const unsuspendCustomerMutation = useUnsuspendCustomer();
  const approveDriverMutation = useApproveDriver();
  const inviteDriverMutation = useInviteDriver();
  const rejectDriverMutation = useRejectDriver();
  const suspendDriverMutation = useSuspendDriver();
  const unsuspendDriverMutation = useUnsuspendDriver();
  const adminUpdateUserMutation = useAdminUpdateUser();

  // ==================== FORMS ====================

  const suspendForm = useForm<SuspendFormData>({
    resolver: zodResolver(suspendSchema),
    defaultValues: { reason: '' },
  });

  const rejectForm = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });

  const editUserForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
  });

  const editCustomerForm = useForm<EditCustomerFormData>({
    resolver: zodResolver(editCustomerSchema),
  });

  const editDriverForm = useForm<EditDriverFormData>({
    resolver: zodResolver(editDriverSchema),
  });

  // ==================== EFFECTS ====================

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  // Initialize edit forms when user data loads
  React.useEffect(() => {
    if (user) {
      editUserForm.reset({
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone || '',
      });
      if (user.customer) {
        editCustomerForm.reset({
          phone: user.customer.phone || '',
          contactName: user.customer.contactName || '',
          contactEmail: user.customer.contactEmail || '',
          contactPhone: user.customer.contactPhone || '',
          defaultPickupId: user.customer.defaultPickup?.id || '',
          postpaidEnabled: user.customer.postpaidEnabled,
        });
        setPostpaidEnabled(user.customer.postpaidEnabled);
      }
      if (user.driver) {
        editDriverForm.reset({
          phone: user.driver.phone || '',
          profilePhotoUrl: user.driver.profilePhotoUrl || '',
        });
      }
    }
  }, [user]);

  // ==================== HANDLERS ====================

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`);
  };

  const handleSignOut = () => {
    adminSignOut();
  };

  const openDialog = (action: typeof dialogAction) => {
    setDialogAction(action);
    setDialogOpen(true);
    suspendForm.reset();
    rejectForm.reset();
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const handleApproveCustomer = () => {
    if (!user || !actorUserId) return;
    approveCustomerMutation.mutate(
      {
        pathParams: { id: user.id },
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Customer approved successfully');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to approve customer'),
      }
    );
  };

  const handleRejectCustomer = (data: RejectFormData) => {
    if (!user || !actorUserId) return;
    rejectCustomerMutation.mutate(
      {
        pathParams: { id: user.id },
        ...data,
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Customer rejected');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to reject customer'),
      }
    );
  };

  const handleSuspendCustomer = (data: SuspendFormData) => {
    if (!user || !actorUserId) return;
    suspendCustomerMutation.mutate(
      {
        pathParams: { id: user.id },
        ...data,
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Customer suspended successfully');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to suspend customer'),
      }
    );
  };

  const handleUnsuspendCustomer = () => {
    if (!user || !actorUserId) return;
    unsuspendCustomerMutation.mutate(
      {
        pathParams: { id: user.id },
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Customer unsuspended successfully');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to unsuspend customer'),
      }
    );
  };

  const handleInviteDriver = useCallback(() => {
    if (!user) return;
    inviteDriverMutation.mutate(
      { pathParams: { id: user.id }, actorUserId: getActorUserId() },
      {
        onSuccess: () => {
          toast.success('Driver invited successfully');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to invite driver'),
      }
    );
  }, [user, inviteDriverMutation, closeDialog, refetch]);

  const handleApproveDriver = () => {
    if (!user || !actorUserId) return;
    approveDriverMutation.mutate(
      {
        pathParams: { id: user.id },
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Driver approved successfully');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to approve driver'),
      }
    );
  };

  const handleRejectDriver = (data: RejectFormData) => {
    if (!user || !actorUserId) return;
    rejectDriverMutation.mutate(
      {
        pathParams: { id: user.id },
        ...data,
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Driver rejected');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to reject driver'),
      }
    );
  };

  const handleSuspendDriver = (data: SuspendFormData) => {
    if (!user || !actorUserId) return;
    suspendDriverMutation.mutate(
      {
        pathParams: { id: user.id },
        ...data,
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Driver suspended successfully');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to suspend driver'),
      }
    );
  };

  const handleUnsuspendDriver = () => {
    if (!user || !actorUserId) return;
    unsuspendDriverMutation.mutate(
      {
        pathParams: { id: user.id },
        actorUserId,
      },
      {
        onSuccess: () => {
          toast.success('Driver unsuspended successfully');
          closeDialog();
          refetch();
        },
        onError: () => toast.error('Failed to unsuspend driver'),
      }
    );
  };

  // ==================== EDIT HANDLERS ====================

  const startEditMode = (mode: 'user' | 'customer' | 'driver') => {
    setEditMode(mode);
  };

  const cancelEditMode = () => {
    setEditMode('none');
    // Reset forms to original values
    if (user) {
      editUserForm.reset({
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone || '',
      });
      if (user.customer) {
        editCustomerForm.reset({
          phone: user.customer.phone || '',
          contactName: user.customer.contactName || '',
          contactEmail: user.customer.contactEmail || '',
          contactPhone: user.customer.contactPhone || '',
          defaultPickupId: user.customer.defaultPickup?.id || '',
          postpaidEnabled: user.customer.postpaidEnabled,
        });
        setPostpaidEnabled(user.customer.postpaidEnabled);
      }
      if (user.driver) {
        editDriverForm.reset({
          phone: user.driver.phone || '',
          profilePhotoUrl: user.driver.profilePhotoUrl || '',
        });
      }
    }
  };

  const handleEditUser = (data: EditUserFormData) => {
    if (!user) return;
    const updateData: AdminUpdateUserRequest = {
      email: data.email,
      username: data.username,
      fullName: data.fullName,
      phone: data.phone || undefined,
    };
    adminUpdateUserMutation.mutate(
      {
        pathParams: { id: user.id },
        ...updateData,
      },
      {
        onSuccess: () => {
          toast.success('User updated successfully');
          setEditMode('none');
          refetch();
        },
        onError: () => toast.error('Failed to update user'),
      }
    );
  };

  const handleEditCustomer = (data: EditCustomerFormData) => {
    if (!user) return;
    const updateData: AdminUpdateUserRequest = {
      customer: {
        phone: data.phone || undefined,
        contactName: data.contactName || undefined,
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
        defaultPickupId: data.defaultPickupId || undefined,
        postpaidEnabled: postpaidEnabled,
      },
    };
    adminUpdateUserMutation.mutate(
      {
        pathParams: { id: user.id },
        ...updateData,
      },
      {
        onSuccess: () => {
          toast.success('Customer profile updated successfully');
          setEditMode('none');
          refetch();
        },
        onError: () => toast.error('Failed to update customer profile'),
      }
    );
  };

  const handleEditDriver = (data: EditDriverFormData) => {
    if (!user) return;
    const updateData: AdminUpdateUserRequest = {
      driver: {
        phone: data.phone || undefined,
        profilePhotoUrl: data.profilePhotoUrl || undefined,
      },
    };
    adminUpdateUserMutation.mutate(
      {
        pathParams: { id: user.id },
        ...updateData,
      },
      {
        onSuccess: () => {
          toast.success('Driver profile updated successfully');
          setEditMode('none');
          refetch();
        },
        onError: () => toast.error('Failed to update driver profile'),
      }
    );
  };

  // ==================== RENDER ====================

  const roleColor = user ? getUserRoleColor(user.roles) : 'slate';
  const RoleIcon = user?.roles === 'DRIVER' ? Truck : user?.roles === 'BUSINESS_CUSTOMER' ? Store : user?.roles === 'ADMIN' ? Shield : User;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center" aria-label="101 Drivers">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-lg shadow-black/10 border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers"
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-7">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'text-sm font-semibold hover:text-primary transition-colors',
                    item.href === '/admin-users'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="w-11 h-11 rounded-2xl"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            <Button
              onClick={handleSignOut}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="md:hidden w-11 h-11 rounded-2xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 z-50 md:hidden overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200">
                    <img
                      src="/assets/101drivers-logo.jpg"
                      alt="101 Drivers"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Admin</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 rounded-2xl"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'block px-4 py-3 rounded-2xl text-sm font-semibold transition-colors',
                      item.href === '/admin-users'
                        ? 'bg-primary/15 text-slate-900 dark:text-white border border-primary/25'
                        : 'text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <Separator className="my-6" />

              <Button
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Sign Out
                <LogOut className="w-4 h-4 text-primary" />
              </Button>
            </div>
          </>
        )}
      </header>

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/admin-users"
            className="inline-flex items-center gap-2 font-extrabold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-primary" />
            Back to Users
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-black text-slate-900 dark:text-white">User details</span>
        </div>

        {/* Loading State */}
        {isLoading && <DetailSkeleton />}

        {/* Error State */}
        {isError && (
          <div className="mt-8 text-center py-12">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Failed to load user</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Unable to fetch user details. Please try again.
            </p>
            <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* User Detail Content */}
        {user && (
          <>
            {/* Title */}
            <section className="mt-6 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PillBadge icon={User} color="slate">
                    User Profile
                  </PillBadge>

                  <PillBadge icon={RoleIcon} color={roleColor === 'primary' ? 'indigo' : roleColor as any}>
                    {USER_ROLE_LABELS[user.roles]}
                  </PillBadge>

                  <StatusBadge
                    status={user.isActive ? 'Active' : 'Inactive'}
                    color={user.isActive ? 'emerald' : 'slate'}
                    icon={user.isActive ? CheckCircle : Ban}
                  />

                  {user.disabledAt && (
                    <StatusBadge status="Suspended" color="rose" icon={Ban} />
                  )}
                </div>

                <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
                  {user.fullName}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
                  View identity, role, related records, and activity. Take actions like suspend access.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-primary/5 transition"
                >
                  <RefreshCw className="w-4 h-4 text-primary" />
                  Refresh
                </Button>
                
                {/* Customer suspended - show Unsuspend Customer */}
                {!user.disabledAt && user.customer?.approvalStatus === 'SUSPENDED' && (
                  <Button
                    onClick={() => openDialog('unsuspend-customer')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white hover:opacity-90 transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Unsuspend Customer
                  </Button>
                )}
                
                {/* Driver suspended - show Unsuspend Driver */}
                {!user.disabledAt && user.driver?.status === 'SUSPENDED' && (
                  <Button
                    onClick={() => openDialog('unsuspend-driver')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white hover:opacity-90 transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Unsuspend Driver
                  </Button>
                )}
                
                {/* Driver waitlisted - show Invite Driver */}
                {!user.disabledAt && user.driver?.status === 'WAITLISTED' && (
                  <Button onClick={() => openDialog('invite-driver')} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-600 text-white hover:opacity-90 transition">
                    <Send className="w-4 h-4" />
                    Invite Driver
                  </Button>
                )}
                {/* Driver pending approval - show Approve/Reject */}
                {!user.disabledAt && user.driver?.status === 'PENDING_APPROVAL' && (
                  <>
                    <Button
                      onClick={() => openDialog('approve-driver')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white hover:opacity-90 transition"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Driver
                    </Button>
                    <Button
                      onClick={() => openDialog('reject-driver')}
                      variant="destructive"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Driver
                    </Button>
                  </>
                )}
                {/* Driver rejected */}
                {!user.disabledAt && user.driver?.status === 'REJECTED' && (
                  <Badge variant="outline" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-rose-200 text-rose-600 text-sm">Rejected</Badge>
                )}
                {/* Driver legacy pending */}
                {!user.disabledAt && user.driver?.status === 'PENDING' && (
                  <Badge variant="outline" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-amber-200 text-amber-600 text-sm">Legacy Pending</Badge>
                )}
                
                {/* Customer pending approval - show Approve/Reject */}
                {!user.disabledAt && user.customer?.approvalStatus === 'PENDING' && (
                  <>
                    <Button
                      onClick={() => openDialog('approve-customer')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white hover:opacity-90 transition"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Customer
                    </Button>
                    <Button
                      onClick={() => openDialog('reject-customer')}
                      variant="destructive"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Customer
                    </Button>
                  </>
                )}
                
                {/* Customer approved - show Suspend Customer */}
                {!user.disabledAt && user.customer?.approvalStatus === 'APPROVED' && (
                  <Button
                    onClick={() => openDialog('suspend-customer')}
                    variant="outline"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Ban className="w-4 h-4" />
                    Suspend Customer
                  </Button>
                )}
                
                {/* Driver approved - show Suspend Driver */}
                {!user.disabledAt && user.driver?.status === 'APPROVED' && (
                  <Button
                    onClick={() => openDialog('suspend-driver')}
                    variant="outline"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Ban className="w-4 h-4" />
                    Suspend Driver
                  </Button>
                )}
              </div>
            </section>

            {/* Summary */}
            <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left column - Account summary */}
              <Card className="lg:col-span-7 border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14 rounded-2xl">
                        <AvatarImage src={user.driver?.profilePhotoUrl || undefined} alt={user.fullName} />
                        <AvatarFallback className="bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-lg font-black">
                          {getInitials(user.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-xl font-black">Account summary</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          Core identity + access
                        </CardDescription>
                      </div>
                    </div>
                    {editMode === 'none' && (
                      <Button
                        onClick={() => startEditMode('user')}
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6 sm:p-7">
                  {editMode === 'user' ? (
                    <form onSubmit={editUserForm.handleSubmit(handleEditUser)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Full name
                          </Label>
                          <Input
                            {...editUserForm.register('fullName')}
                            className="rounded-xl"
                            placeholder="Full name"
                          />
                          {editUserForm.formState.errors.fullName && (
                            <p className="text-xs text-rose-500 mt-1">{editUserForm.formState.errors.fullName.message}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Email
                          </Label>
                          <Input
                            {...editUserForm.register('email')}
                            type="email"
                            className="rounded-xl"
                            placeholder="Email"
                          />
                          {editUserForm.formState.errors.email && (
                            <p className="text-xs text-rose-500 mt-1">{editUserForm.formState.errors.email.message}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Username
                          </Label>
                          <Input
                            {...editUserForm.register('username')}
                            className="rounded-xl"
                            placeholder="Username"
                          />
                          {editUserForm.formState.errors.username && (
                            <p className="text-xs text-rose-500 mt-1">{editUserForm.formState.errors.username.message}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Phone
                          </Label>
                          <Input
                            {...editUserForm.register('phone')}
                            className="rounded-xl"
                            placeholder="Phone"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelEditMode}
                          className="rounded-xl"
                        >
                          <XIcon className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="rounded-xl"
                          disabled={adminUpdateUserMutation.isPending}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {adminUpdateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Full name
                          </Label>
                          <div className="text-sm font-medium">{user.fullName}</div>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Email
                          </Label>
                          <div className="text-sm font-medium flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {user.email}
                            {user.emailVerifiedAt && (
                              <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                Verified
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Username
                          </Label>
                          <div className="text-sm font-medium">@{user.username}</div>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Phone
                          </Label>
                          <div className="text-sm font-medium flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400" />
                            {user.phone ? (
                              <a
                                href={`tel:${user.phone.replace(/[^+\d]/g, '')}`}
                                className="text-primary hover:underline"
                              >
                                {user.phone}
                              </a>
                            ) : '—'}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Role
                          </Label>
                          <div className="text-sm font-medium">
                            <PillBadge icon={RoleIcon} color={roleColor === 'primary' ? 'indigo' : roleColor as any}>
                              {USER_ROLE_LABELS[user.roles]}
                            </PillBadge>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            Created
                          </Label>
                          <div className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {formatDateTime(user.createdAt)}
                          </div>
                        </div>

                        {user.lastLoginAt && (
                          <div>
                            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                              Last Login
                            </Label>
                            <div className="text-sm font-medium flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400" />
                              {formatDateTime(user.lastLoginAt)}
                            </div>
                          </div>
                        )}

                        {user.disabledAt && (
                          <div className="md:col-span-2">
                            <Label className="text-xs font-bold text-rose-600 mb-2 block">
                              Suspended
                            </Label>
                            <div className="text-sm text-rose-700 dark:text-rose-300">
                              <div className="flex items-center gap-2 mb-1">
                                <Ban className="w-4 h-4" />
                                {formatDateTime(user.disabledAt)}
                              </div>
                              {user.disabledReason && (
                                <div className="text-xs bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg mt-2">
                                  Reason: {user.disabledReason}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator className="my-6" />

                      {/* KPIs */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard
                          label="Deliveries"
                          value={user._count.deliveriesCreated}
                          icon={Package}
                        />
                        <KpiCard
                          label="Notifications"
                          value={user._count.notifEvents}
                          icon={Bell}
                        />
                        <KpiCard
                          label="Admin Actions"
                          value={user._count.adminActions}
                          icon={Shield}
                        />
                        <KpiCard
                          label="Schedule Requests"
                          value={user._count.scheduleChangesRequested}
                          icon={Clock}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Right column */}
              <div className="lg:col-span-5 space-y-6">
                {/* Customer Info */}
                {user.customer && (
                  <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Store className="w-5 h-5 text-primary" />
                          <div>
                            <CardTitle className="text-xl font-black">Customer Profile</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {CUSTOMER_TYPE_LABELS[user.customer.customerType]} customer
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {editMode === 'none' && (
                            <Button
                              onClick={() => startEditMode('customer')}
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          <StatusBadge
                            status={CUSTOMER_APPROVAL_STATUS_LABELS[user.customer.approvalStatus]}
                            color={getCustomerApprovalStatusColor(user.customer.approvalStatus)}
                            icon={user.customer.approvalStatus === 'APPROVED' ? CheckCircle : user.customer.approvalStatus === 'SUSPENDED' ? Ban : Clock}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 sm:p-7 space-y-4">
                      {editMode === 'customer' ? (
                        <form onSubmit={editCustomerForm.handleSubmit(handleEditCustomer)} className="space-y-4">
                          <div className="space-y-4">
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Contact Name</Label>
                              <Input
                                {...editCustomerForm.register('contactName')}
                                className="rounded-xl mt-1"
                                placeholder="Contact name"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Contact Email</Label>
                              <Input
                                {...editCustomerForm.register('contactEmail')}
                                type="email"
                                className="rounded-xl mt-1"
                                placeholder="Contact email"
                              />
                              {editCustomerForm.formState.errors.contactEmail && (
                                <p className="text-xs text-rose-500 mt-1">{editCustomerForm.formState.errors.contactEmail.message}</p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Contact Phone</Label>
                              <Input
                                {...editCustomerForm.register('contactPhone')}
                                className="rounded-xl mt-1"
                                placeholder="Contact phone"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold text-slate-500">Postpaid Enabled</Label>
                              <Switch
                                checked={postpaidEnabled}
                                onCheckedChange={setPostpaidEnabled}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelEditMode}
                              className="rounded-xl"
                            >
                              <XIcon className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              className="rounded-xl"
                              disabled={adminUpdateUserMutation.isPending}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              {adminUpdateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {user.customer.businessName && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Business Name</Label>
                              <div className="font-medium">{user.customer.businessName}</div>
                            </div>
                          )}
                          {user.customer.businessAddress && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Address</Label>
                              <div className="text-sm flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {user.customer.businessAddress}
                              </div>
                            </div>
                          )}
                          {user.customer.contactName && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Contact Name</Label>
                              <div className="text-sm">{user.customer.contactName}</div>
                            </div>
                          )}
                          {user.customer.contactEmail && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Contact Email</Label>
                              <div className="text-sm">{user.customer.contactEmail}</div>
                            </div>
                          )}
                          {user.customer.contactPhone && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Contact Phone</Label>
                              <div className="text-sm">
                                <a
                                  href={`tel:${user.customer.contactPhone.replace(/[^+\d]/g, '')}`}
                                  className="text-primary hover:underline"
                                >
                                  {user.customer.contactPhone}
                                </a>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4">
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Postpaid</Label>
                              <div className="text-sm">
                                {user.customer.postpaidEnabled ? (
                                  <Badge className="bg-primary/10 text-primary">Enabled</Badge>
                                ) : (
                                  <span className="text-slate-500">No</span>
                                )}
                              </div>
                            </div>
                            {user.customer.approvedAt && (
                              <div>
                                <Label className="text-xs font-bold text-slate-500">Approved</Label>
                                <div className="text-sm">{formatDate(user.customer.approvedAt)}</div>
                              </div>
                            )}
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <KpiCard label="Deliveries" value={user.customer._count.deliveries} />
                            <KpiCard label="Quotes" value={user.customer._count.quotes} />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Driver Info */}
                {user.driver && (
                  <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Truck className="w-5 h-5 text-sky-500" />
                          <div>
                            <CardTitle className="text-xl font-black">Driver Profile</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              Driver account details
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {editMode === 'none' && (
                            <Button
                              onClick={() => startEditMode('driver')}
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          <StatusBadge
                            status={DRIVER_STATUS_LABELS[user.driver.status]}
                            color={getDriverStatusColor(user.driver.status)}
                            icon={user.driver.status === 'APPROVED' ? CheckCircle : user.driver.status === 'SUSPENDED' ? Ban : Clock}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 sm:p-7 space-y-4">
                      {editMode === 'driver' ? (
                        <form onSubmit={editDriverForm.handleSubmit(handleEditDriver)} className="space-y-4">
                          <div className="space-y-4">
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Phone</Label>
                              <Input
                                {...editDriverForm.register('phone')}
                                className="rounded-xl mt-1"
                                placeholder="Phone"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Profile Photo URL</Label>
                              <Input
                                {...editDriverForm.register('profilePhotoUrl')}
                                className="rounded-xl mt-1"
                                placeholder="https://..."
                              />
                              {editDriverForm.formState.errors.profilePhotoUrl && (
                                <p className="text-xs text-rose-500 mt-1">{editDriverForm.formState.errors.profilePhotoUrl.message}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelEditMode}
                              className="rounded-xl"
                            >
                              <XIcon className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              className="rounded-xl"
                              disabled={adminUpdateUserMutation.isPending}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              {adminUpdateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {user.driver.location && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Location</Label>
                              <div className="text-sm space-y-1">
                                {user.driver.location.homeBaseCity && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    {user.driver.location.homeBaseCity}, {user.driver.location.homeBaseState}
                                  </div>
                                )}
                                <div className="text-xs text-slate-400">
                                  Last updated: {formatDateTime(user.driver.location.currentAt)}
                                </div>
                              </div>
                            </div>
                          )}
                          {user.driver.preferences && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Preferences</Label>
                              <div className="text-sm">
                                {user.driver.preferences.city && (
                                  <span className="mr-4">City: {user.driver.preferences.city}</span>
                                )}
                                {user.driver.preferences.radiusMiles && (
                                  <span>Radius: {user.driver.preferences.radiusMiles} miles</span>
                                )}
                              </div>
                            </div>
                          )}
                          {user.driver.alerts && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Alerts</Label>
                              <div className="flex gap-2 mt-1">
                                {user.driver.alerts.emailEnabled && (
                                  <Badge variant="outline" className="text-xs">Email</Badge>
                                )}
                                {user.driver.alerts.smsEnabled && (
                                  <Badge variant="outline" className="text-xs">SMS</Badge>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Driver Selfie Photo */}
                          <div>
                            <Label className="text-xs font-bold text-slate-500">Selfie Photo</Label>
                            <div className="mt-2">
                              {user.driver.selfiePhotoUrl ? (
                                <img
                                  src={user.driver.selfiePhotoUrl}
                                  alt="Driver selfie"
                                  className="w-32 h-32 object-cover rounded-2xl border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400">
                                  <Camera className="w-6 h-6 mb-1" />
                                  <span className="text-[10px]">No selfie</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {user.driver.approvedAt && (
                            <div>
                              <Label className="text-xs font-bold text-slate-500">Approved</Label>
                              <div className="text-sm">{formatDate(user.driver.approvedAt)}</div>
                            </div>
                          )}
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <KpiCard label="Assignments" value={user.driver._count.assignments} />
                            <KpiCard label="Ratings" value={user.driver._count.ratingsReceived} icon={Star} />
                            <KpiCard label="Payouts" value={user.driver._count.payouts} icon={DollarSign} />
                            <KpiCard label="Districts" value={user.driver._count.districts} icon={Map} />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* No Customer/Driver */}
                {!user.customer && !user.driver && (
                  <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardContent className="p-6 text-center">
                      <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No customer or driver profile associated</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>

            {/* Recent Admin Actions */}
            {user.recentAdminActions.length > 0 && (
              <section className="mt-6">
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <History className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle className="text-xl font-black">Recent Admin Actions</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          Audit trail for this user
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-950">
                        <TableRow>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Time
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Action
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Actor Type
                          </TableHead>
                          <TableHead className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Reason
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {user.recentAdminActions.map((action) => (
                          <TableRow key={action.id} className="hover:bg-primary/5 transition">
                            <TableCell className="px-5 py-4 text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                              {formatDateTime(action.createdAt)}
                            </TableCell>
                            <TableCell className="px-5 py-4">
                              <Badge variant="outline" className="text-xs font-bold">
                                {action.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                              {action.actorType}
                            </TableCell>
                            <TableCell className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                              {action.reason || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}
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
              {dialogAction === 'invite-driver' && 'Invite Driver'}
              {dialogAction === 'approve-driver' && 'Approve Driver'}
              {dialogAction === 'reject-driver' && 'Reject Driver'}
              {dialogAction === 'suspend-driver' && 'Suspend Driver'}
              {dialogAction === 'unsuspend-driver' && 'Unsuspend Driver'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'approve-customer' && `Approve ${user?.fullName} as a customer? They will be able to create deliveries.`}
              {dialogAction === 'reject-customer' && `Reject ${user?.fullName}'s customer application?`}
              {dialogAction === 'suspend-customer' && `Suspend ${user?.fullName}'s customer account? They will not be able to create deliveries.`}
              {dialogAction === 'unsuspend-customer' && `Restore ${user?.fullName}'s customer account? They will be able to create deliveries again.`}
              {dialogAction === 'invite-driver' && `Invite ${user?.fullName} to complete their driver application? They will receive an email with instructions.`}
              {dialogAction === 'approve-driver' && `Approve ${user?.fullName} as a driver? They will be able to accept delivery assignments.`}
              {dialogAction === 'reject-driver' && `Reject ${user?.fullName}'s driver application?`}
              {dialogAction === 'suspend-driver' && `Suspend ${user?.fullName}'s driver account? They will not be able to accept deliveries.`}
              {dialogAction === 'unsuspend-driver' && `Restore ${user?.fullName}'s driver account? They will be able to accept deliveries again.`}
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

          {/* Invite Driver Confirmation */}
          {dialogAction === 'invite-driver' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
                <div className="text-sm text-sky-700 dark:text-sky-300">
                  This will send an email to {user?.email} with instructions to complete their driver application.
                  They will be moved from <b>Waitlisted</b> to <b>Invited</b> status.
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeDialog} className="rounded-2xl">Cancel</Button>
                <Button onClick={handleInviteDriver} disabled={inviteDriverMutation.isPending} className="rounded-2xl bg-sky-600 hover:bg-sky-700 text-white">
                  {inviteDriverMutation.isPending ? 'Inviting...' : 'Send Invite'}
                </Button>
              </div>
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

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-10 pb-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-slate-200">
                <img
                  src="/assets/101drivers-logo.jpg"
                  alt="101 Drivers logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Admin Console • User Details
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              © 2024 101 Drivers Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
