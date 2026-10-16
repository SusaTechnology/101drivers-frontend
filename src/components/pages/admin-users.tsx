// components/pages/admin-users.tsx
// Admin Users Management Page - Unified Users Table
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { firstUrlParamValue } from '@/lib/dashboardRoutes';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
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
import { useSocketEvent } from '@/hooks/useSocket';
import {
  useAdminUsersV2,
  useAdminUserStatusStats,
  useZipRegions,
  useApproveCustomer,
  useRejectCustomer,
  useSuspendCustomer,
  useUnsuspendCustomer,
  useApproveDriver,
  useRejectDriver,
  useSuspendDriver,
  useUnsuspendDriver,
  useInviteDriver,
  useResendInviteDriver,
  useInviteAdminUser,
  useResendAdminInvite,
  useDisableAdmin,
  useEnableAdmin,
  usePromoteAdmin,
  useDemoteAdmin,
  getActorUserId,
} from '@/hooks/useAdminUsers';
import { getUser } from '@/lib/tanstack/dataQuery';
import { ServiceAreaBadge } from '@/components/admin/ServiceAreaBadge';
import type {
  AdminUserRow,
  AdminUsersQueryParams,
  AdminInviteStatus,
  UserRole,
  CustomerType,
  CustomerApprovalStatus,
  DriverStatus,
} from '@/types/users';
import { effectiveAdminStatus } from '@/lib/adminStatus';
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
  ShieldCheck,
  ShieldOff,
  AlertCircle,
  Gift,
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
  Send,
  PauseCircle,
  Info,
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

// V3: Admins are INVITED, not created with a password. The admin supplies
// only identity fields; the invitee receives a single-use email link and
// sets their own password (48h expiry). No default password ever exists.
const inviteAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
});

type SuspendFormData = z.infer<typeof suspendSchema>;
type RejectFormData = z.infer<typeof rejectSchema>;
type InviteAdminFormData = z.infer<typeof inviteAdminSchema>;

// ==================== CONSTANTS ====================

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'PRIVATE_CUSTOMER', label: 'Private Customer' },
  { value: 'BUSINESS_CUSTOMER', label: 'Business Customer' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'ADMIN', label: 'Admin' },
];

// V2: Unified status options — replaces the old STATUS_OPTIONS +
// CUSTOMER_STATUS_OPTIONS + DRIVER_STATUS_OPTIONS (which had duplicate
// "Pending" entries and didn't cover both customers + drivers).
// The backend /admin/v2 endpoint ORs customer + driver conditions for
// each status, so "Pending" shows BOTH pending customers + pending drivers.
const V2_STATUS_OPTIONS: { value: string; label: string; driverOnly: boolean }[] = [
  { value: 'all', label: 'All Status', driverOnly: false },
  { value: 'PENDING', label: 'Pending', driverOnly: false },
  { value: 'APPROVED', label: 'Approved', driverOnly: false },
  { value: 'REJECTED', label: 'Rejected', driverOnly: false },
  { value: 'SUSPENDED', label: 'Suspended', driverOnly: false },
  { value: 'INVITED', label: 'Invited (driver only)', driverOnly: true },
  { value: 'WAITLISTED', label: 'Waitlisted (driver only)', driverOnly: true },
];

// Per-role status option lists — the Status field swaps its OPTION LIST
// with the Role (same cell, same UI, same pattern as the admin swap), so
// a role only ever sees statuses that exist on its rows and every label
// matches the badge the rows actually show. The old single unified list
// for all roles is why "Pending" on Role=Driver read as a no-op: it maps
// to three driver states whose badges say Waitlisted / Invited / Pending
// Approval — nothing on screen ever said "Pending".
//
// Labels mirror DRIVER_STATUS_LABELS / CUSTOMER_APPROVAL_STATUS_LABELS
// (types/users.ts) so filter and badge always agree.
const DRIVER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const CUSTOMER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'PENDING', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

// Which status list the (non-admin) Status dropdown shows for a role.
// Role = All keeps the unified cross-role list (driver-only picks there
// auto-switch Role to Driver); Role = Admin never reaches this — the
// dedicated admin lifecycle dropdown renders instead (ADMIN_STATUS_OPTIONS).
function statusOptionsForRole(role: string): { value: string; label: string }[] {
  if (role === 'DRIVER') return DRIVER_STATUS_OPTIONS;
  if (role === 'PRIVATE_CUSTOMER' || role === 'BUSINESS_CUSTOMER') return CUSTOMER_STATUS_OPTIONS;
  return V2_STATUS_OPTIONS;
}

// ==================== STATUS STAT CARDS (dedicated stats endpoint) ====================
// Small per-status count cards above the table, fed by the DEDICATED
// GET /users/admin/status-stats endpoint (global counts — NOT the paginated
// users list). Clicking a card applies the matching Role + Status filter to
// the table; clicking the active card clears the filter. Colors mirror the
// row badges (getDriverStatusColor / getCustomerApprovalStatusColor).
//
// LIVE: the cards refetch on the users:stats-changed socket ping (new
// signup, invite, approval...) and every number ANIMATES to its new value
// (ease-out count-up, reduced-motion aware) — the row visibly breathes
// when someone registers while the page is open.
type StatCardConfig = {
  value: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  /** Static literal bg-* class for the share-of-total bar. Must stay a
      full literal — a dynamically derived bg-* class would never be
      generated by Tailwind's scanner. */
  barColor: string;
};

const DRIVER_STAT_CARDS: StatCardConfig[] = [
  { value: 'WAITLISTED', label: 'Waitlisted', color: 'text-slate-600 dark:text-slate-300', bgColor: 'bg-slate-50 dark:bg-slate-800/50', borderColor: 'border-slate-200 dark:border-slate-700', barColor: 'bg-slate-400 dark:bg-slate-500' },
  { value: 'INVITED', label: 'Invited', color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-50 dark:bg-sky-900/20', borderColor: 'border-sky-200 dark:border-sky-800', barColor: 'bg-sky-500 dark:bg-sky-400' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', barColor: 'bg-amber-500 dark:bg-amber-400' },
  { value: 'APPROVED', label: 'Approved', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800', barColor: 'bg-emerald-500 dark:bg-emerald-400' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', barColor: 'bg-amber-500 dark:bg-amber-400' },
  { value: 'REJECTED', label: 'Rejected', color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-900/20', borderColor: 'border-rose-200 dark:border-rose-800', barColor: 'bg-rose-500 dark:bg-rose-400' },
  { value: 'SUSPENDED', label: 'Suspended', color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-900/20', borderColor: 'border-rose-200 dark:border-rose-800', barColor: 'bg-rose-500 dark:bg-rose-400' },
];

const CUSTOMER_STAT_CARDS: StatCardConfig[] = [
  { value: 'PENDING', label: 'Pending Approval', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', barColor: 'bg-amber-500 dark:bg-amber-400' },
  { value: 'APPROVED', label: 'Approved', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800', barColor: 'bg-emerald-500 dark:bg-emerald-400' },
  { value: 'REJECTED', label: 'Rejected', color: 'text-slate-600 dark:text-slate-300', bgColor: 'bg-slate-50 dark:bg-slate-800/50', borderColor: 'border-slate-200 dark:border-slate-700', barColor: 'bg-slate-400 dark:bg-slate-500' },
  { value: 'SUSPENDED', label: 'Suspended', color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-900/20', borderColor: 'border-rose-200 dark:border-rose-800', barColor: 'bg-rose-500 dark:bg-rose-400' },
];

// Admin lifecycle cards — values map onto the dedicated admin Status
// dropdown (ADMIN_ prefix; see ADMIN_STATUS_OPTIONS below). SUPER_ADMIN is
// the flag filter, mirroring the dropdown 1:1.
const ADMIN_STAT_CARDS: StatCardConfig[] = [
  { value: 'ACTIVE', label: 'Active', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800', barColor: 'bg-emerald-500 dark:bg-emerald-400' },
  { value: 'PENDING_INVITE', label: 'Pending invite', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', barColor: 'bg-amber-500 dark:bg-amber-400' },
  { value: 'INVITE_EXPIRED', label: 'Invite expired', color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-50 dark:bg-sky-900/20', borderColor: 'border-sky-200 dark:border-sky-800', barColor: 'bg-sky-500 dark:bg-sky-400' },
  { value: 'DISABLED', label: 'Disabled', color: 'text-slate-600 dark:text-slate-300', bgColor: 'bg-slate-50 dark:bg-slate-800/50', borderColor: 'border-slate-200 dark:border-slate-700', barColor: 'bg-slate-400 dark:bg-slate-500' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-900/20', borderColor: 'border-violet-200 dark:border-violet-800', barColor: 'bg-violet-500 dark:bg-violet-400' },
];

// ==================== ANIMATED NUMBER (count-up) ====================
// requestAnimationFrame count-up used by every stat card number. Ease-out
// cubic over 600ms; honors prefers-reduced-motion by jumping straight to
// the value. Self-cleaning: the rAF loop cancels on unmount/value change.
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(to);
      return;
    }

    const duration = 600;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <span className={cn('tabular-nums', className)}>{display}</span>;
}

/** One role stat card — ERP / finance-dashboard style.
 *  Header: role icon chip + role title (+ a dot marking "this role is the
 *  active table filter"). Hero: the role TOTAL as a big number — clicking it
 *  filters the table to that role with NO status filter (click again to
 *  clear). Body: one compact tile per lifecycle status — the count sits in
 *  the status's own color above a share-of-total bar; clicking a tile
 *  applies Role + Status (the original per-card behavior, untouched).
 *  Every number animates on the users:stats-changed socket refetch. */
function RoleStatCard({
  icon,
  accent,
  title,
  total,
  loading,
  configs,
  counts,
  isRoleFiltered,
  isRoleOnlyActive,
  isStatusActive,
  onRoleClick,
  onStatusClick,
}: {
  icon: React.ReactNode;
  /** Full literal Tailwind classes for the icon chip (bg/border/text). */
  accent: string;
  title: string;
  total: number;
  loading: boolean;
  configs: StatCardConfig[];
  counts: Record<string, number> | undefined;
  /** Role is part of the active table filter (any status). */
  isRoleFiltered: boolean;
  /** Role filter active with NO status — the hero number's pressed state. */
  isRoleOnlyActive: boolean;
  isStatusActive: (config: StatCardConfig) => boolean;
  onRoleClick: () => void;
  onStatusClick: (config: StatCardConfig) => void;
}) {
  return (
    <Card
      className={cn(
        'flex flex-col rounded-2xl p-3 transition-all duration-200',
        isRoleFiltered
          ? 'border-primary/40 shadow-md ring-2 ring-primary/30'
          : 'border-slate-200 hover:shadow-sm dark:border-slate-800'
      )}
    >
      {/* Header — icon chip + role name + filtered dot */}
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
            accent
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 text-[10px] font-bold uppercase leading-tight tracking-widest text-slate-400">
          {title}
        </div>
        <span
          aria-hidden
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full transition-opacity duration-200',
            isRoleFiltered ? 'bg-primary opacity-100' : 'opacity-0'
          )}
        />
      </div>

      {/* Hero — the role total. Click = filter to the role, all statuses.
          Second click clears. Kept as a real button (keyboard + a11y). */}
      <button
        type="button"
        onClick={onRoleClick}
        title={
          isRoleOnlyActive
            ? 'Click to clear the role filter'
            : `Show all ${title.toLowerCase()}`
        }
        aria-pressed={isRoleOnlyActive}
        className={cn(
          'group mt-2 w-full cursor-pointer select-none rounded-xl px-2.5 py-1.5 text-left transition-colors duration-200',
          isRoleOnlyActive
            ? 'bg-slate-100 dark:bg-slate-800/60'
            : 'hover:bg-slate-50 dark:hover:bg-slate-900'
        )}
      >
        <span className="block text-2xl font-black leading-none text-slate-900 dark:text-white">
          {loading ? '…' : <AnimatedNumber value={total} />}
        </span>
        {/* Caption only in the filtered state — the normal state saves the
            line so the card (and the whole row) stays short enough for the
            table to stay on screen. */}
        {isRoleOnlyActive && (
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Filtered · click to clear
          </span>
        )}
      </button>

      {/* Breakdown — per-status counts in their own colors, sized by share
          of the role total. Click = Role + Status (unchanged mechanism). */}
      <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
        {configs.map((config) => {
          const count = counts?.[config.value] ?? 0;
          const active = isStatusActive(config);
          const pct =
            total > 0 && count > 0 ? Math.max((count / total) * 100, 4) : 0;
          return (
            <button
              key={config.value}
              type="button"
              onClick={() => onStatusClick(config)}
              title={
                active
                  ? 'Click to clear filter'
                  : `Show ${config.label.toLowerCase()} ${title.toLowerCase()}`
              }
              aria-pressed={active}
              className={cn(
                'cursor-pointer select-none rounded-lg border border-transparent px-1.5 py-1 text-left transition-all duration-200',
                active
                  ? `${config.bgColor} ${config.borderColor} ring-1 ring-primary/40`
                  : 'hover:bg-slate-50 dark:hover:bg-slate-900'
              )}
            >
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span
                  className={cn('text-[13px] font-bold leading-none', config.color)}
                >
                  {loading ? '–' : <AnimatedNumber value={count} />}
                </span>
                <span className="truncate text-[9px] font-bold uppercase leading-none tracking-wider text-slate-400">
                  {config.label}
                </span>
              </div>
              {/* Share-of-total bar — dynamic width is inline style; the
                  color must stay a static literal class (Tailwind scanner). */}
              <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    config.barColor
                  )}
                  style={{ width: loading ? '0%' : `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ==================== DEEP-LINK FILTERS (dashboard urgent tiles) ====================
// The dashboard's urgent tiles link here WITH their filters in the URL:
//   New Dealer Signups (alert) → /admin-users?roles=BUSINESS_CUSTOMER&customerApprovalStatus=PENDING
//   Dealer approval pending    → /admin-users?customerType=BUSINESS&approvalStatus=PENDING
//   Driver approval pending    → /admin-users?status={"in":["WAITLISTED","INVITED","PENDING_APPROVAL"]}
// The table must land showing ONLY those rows — the reported bug was the
// page ignoring the params and rendering every user. Every spelling the
// dashboard emits is mapped onto the V2 filter state (Role + Status) and
// validated against the same option lists the dropdowns render, so an
// unknown value can never select itself into an invisible state.
// The {in:[...]} driver trio folds into Role=Driver + Status=Pending —
// the V2 endpoint expands PENDING back to exactly those three driver
// states, so the landing rows match the tile count 1:1.
const DRIVER_PENDING_TRIO = ['WAITLISTED', 'INVITED', 'PENDING_APPROVAL'];

function parseUsersDeepLink(
  params: Record<string, unknown>
): { role?: string; status?: string } {
  // Role: "roles"/"role" (alert spelling) first, then customerType
  // (Needs-Attention dealer spelling: BUSINESS/PRIVATE → user roles).
  let role: string | undefined;
  const rawRole = firstUrlParamValue(params.roles ?? params.role);
  if (rawRole && ROLE_OPTIONS.some((o) => o.value === rawRole)) {
    role = rawRole;
  } else {
    const customerType = firstUrlParamValue(params.customerType);
    if (customerType === 'BUSINESS' || customerType === 'PRIVATE') {
      role = customerType === 'BUSINESS' ? 'BUSINESS_CUSTOMER' : 'PRIVATE_CUSTOMER';
    }
  }

  // Status: the Needs-Attention driver card sends a Prisma-style
  // { in: [...] } object; the alert cards send flat strings.
  let status: string | undefined;
  if (
    params.status &&
    typeof params.status === 'object' &&
    !Array.isArray(params.status)
  ) {
    const inList = (params.status as { in?: unknown }).in;
    const vals = Array.isArray(inList)
      ? inList.filter((s): s is string => typeof s === 'string')
      : [];
    if (vals.length > 0 && vals.every((s) => DRIVER_PENDING_TRIO.includes(s))) {
      status = 'PENDING';
      // The trio only exists on drivers — without forcing the role,
      // "Pending" would also sweep in pending customers.
      role = role ?? 'DRIVER';
    }
  } else {
    status = firstUrlParamValue(
      params.customerApprovalStatus ?? params.approvalStatus ?? params.status
    );
  }

  // Keep only values the resolved role's dropdown actually renders.
  if (
    status &&
    !statusOptionsForRole(role ?? 'all').some((o) => o.value === status)
  ) {
    status = undefined;
  }

  return { role, status };
}

// ==================== FILTER PERSISTENCE (per browser tab) ====================
// The admin's filters survive navigation: leave the Users page, come back
// (menu, back button, another tile) and the same filter set is still
// applied to the table. Scope is deliberately sessionStorage — per tab,
// dies with the tab — so a filter chosen today can never leak into some
// future session's "why is my list empty" confusion. The ONLY things that
// clear it are the admin's own hand: fixing fields one by one or the
// Clear filters button — both just change state, and the mirror effect
// below persists exactly what the admin currently sees. Dashboard deep
// links still win on a fresh mount (an explicit tile click is a fresh
// intent), and page/pageSize are intentionally NOT persisted: a restored
// page number past a changed result count would read as a broken table.
const ADMIN_USERS_FILTERS_KEY = 'admin-users-filters-v1';

interface StoredAdminUserFilters {
  searchQuery: string;
  roleFilter: string;
  statusFilter: string;
  adminStatusFilter: string;
  zipFilter: string;
  zipRegion: string;
}

function readStoredAdminUserFilters(): Partial<StoredAdminUserFilters> | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_USERS_FILTERS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const source = parsed as Record<string, unknown>;
    const out: Partial<StoredAdminUserFilters> = {};
    for (const key of [
      'searchQuery',
      'roleFilter',
      'statusFilter',
      'adminStatusFilter',
      'zipFilter',
      'zipRegion',
    ] as const) {
      const value = source[key];
      if (typeof value === 'string') out[key] = value.slice(0, 200);
    }
    return out;
  } catch {
    // Private mode / quota / corrupt JSON — persistence is best-effort.
    return null;
  }
}

// Dedicated admin lifecycle dropdown — swaps in for the unified Status
// field when Role = Admin (same grid cell, identical UI, its own state).
// Values are sent with an ADMIN_ prefix, which the backend /admin/v2
// endpoint maps to the admin lifecycle: Active (email verified + not
// disabled), Pending invite / Invitation expired (unverified, with vs
// without a live invite token — decided server-side), Disabled
// (deactivated by an admin), Super Admin (isSuperAdmin flag).
const ADMIN_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_INVITE', label: 'Pending invite' },
  { value: 'INVITE_EXPIRED', label: 'Invitation expired' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

// Named California regions for the ZIP filter now come from the BACKEND
// (GET /api/users/admin/zip-regions — generated from real ZIP→county
// crosswalk data by backend/scripts/build-zip-regions.ts). Admins think
// in places ("LA", "San Diego"), not ZIP digits; the backend owns which
// ZIPs belong to each, so the frontend keeps zero geographic hardcoding.
// The manual prefix/range inputs stay available for anything finer (they
// flip the picker to "Custom").

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

// ServiceAreaBadge moved to @/components/admin/ServiceAreaBadge — the
// admin user-detail page renders the SAME badge, so colors and meanings
// can never drift apart. (green = in polygon, eligible for review only;
// gray = outside, NOT rejected; amber = no/unresolvable zip, flagged).

function StatusBadge({ isActive, disabledAt }: { isActive: boolean; disabledAt: string | null }) {
  if (disabledAt) {
    return (
      <Badge className="text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
        <Ban className="w-3 h-3 mr-1" />
        Disabled
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

// Lifecycle badge for ADMIN rows — mirrors the login rules exactly:
//   Active           → invite accepted (email verified); sign-in allowed
//   Pending invite   → invite link still valid; sign-in BLOCKED
//   Invitation expired → link expired unused; sign-in BLOCKED
//   Disabled         → deactivated by an admin; sign-in BLOCKED
// The server computes the status (it knows the invite token's expiry);
// effectiveAdminStatus falls back to a client approximation if absent.
function AdminStatusBadge({ status }: { status: AdminInviteStatus }) {
  if (status === 'DISABLED') {
    return (
      <Badge className="text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
        <Ban className="w-3 h-3 mr-1" />
        Disabled
      </Badge>
    );
  }
  if (status === 'PENDING_INVITE') {
    return (
      <Badge
        className="text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200"
        title="Invite sent but not accepted yet — this admin cannot sign in until they accept the invite."
      >
        <Send className="w-3 h-3 mr-1" />
        Pending invite
      </Badge>
    );
  }
  if (status === 'INVITE_EXPIRED') {
    return (
      <Badge
        className="text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200"
        title="The invite link expired without being accepted — resend the invite to let this admin set up their account."
      >
        <Clock className="w-3 h-3 mr-1" />
        Invitation expired
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
      <CheckCircle className="w-3 h-3 mr-1" />
      Active
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
  const Icon = status === 'APPROVED' ? CheckCircle : status === 'SUSPENDED' ? Ban : status === 'ON_HOLD' ? PauseCircle : Clock;

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

// Badge for users with role BUSINESS_CUSTOMER or PRIVATE_CUSTOMER but no
// Customer row attached. Two cases:
//   1. emailVerifiedAt = null → "Pending Verification" (amber) — the user
//      started a signup but hasn't verified their email with OTP yet.
//      This is the normal pending state with the new server-side storage.
//   2. emailVerifiedAt != null but no Customer → "Incomplete Signup"
//      (red) — an anomaly (the email was verified but the Customer row
//      was never created, e.g. a crash between OTP verification and
//      Customer creation). Admin should delete this row.
function IncompleteSignupBadge({ emailVerifiedAt }: { emailVerifiedAt?: string | null }) {
  if (!emailVerifiedAt) {
    // Pending email verification — normal state with the new signup flow
    return (
      <Badge
        className="text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
        title="User started a registration but hasn't verified their email yet. They can complete the signup by entering the OTP sent to their email."
      >
        <Clock className="w-3 h-3 mr-1" />
        Pending Verification
      </Badge>
    );
  }

  // Email verified but no Customer row — anomaly, truly failed signup
  return (
    <Badge
      className="text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
      title="Email was verified but the Customer record is missing — likely a failed signup. The user cannot retry with this email until this row is deleted."
    >
      <AlertCircle className="w-3 h-3 mr-1" />
      Incomplete Signup
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
  const queryClient = useQueryClient();

  const { actionItems, signOut } = useAdminActions();
  const actorUserId = getActorUserId();
  // Super-admin gate for the elevated row actions (Disable / Enable /
  // Make Super Admin / Downgrade) — source 1 of 2: the login payload.
  // It is a SNAPSHOT from sign-in time, so it is stale/absent when the
  // user signed in before the super-admin flag existed. Combined with
  // the freshly fetched users list below (source 2), which the server
  // stamps with isSuperAdmin on every row. The server re-verifies on
  // every request regardless — this only decides which buttons render.
  const loginSnapshotSuperAdmin = getUser()?.isSuperAdmin === true;
  const navigate = useNavigate();

  // Deep-link filters from the dashboard urgent tiles (see
  // parseUsersDeepLink above) — they seed the SAME state the dropdowns
  // drive, so the first fetch is already filtered and loosening a filter
  // afterwards behaves exactly like a hand-picked one.
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const deepLink = useMemo(() => parseUsersDeepLink(searchParams), [searchParams]);

  // ==================== FILTER STATE (V2 — simplified) ====================
  // Replaced the old 14 filter states with 5 clean ones.
  // The V2 backend endpoint handles the unified status mapping.
  // Restore-on-mount: filters come back from sessionStorage (read exactly
  // once per mount) so navigating away and back keeps the admin's working
  // set. Priority on a fresh mount: deep link > stored > defaults — an
  // explicit dashboard-tile click always means "show me that view NOW".
  // Every restored value is re-validated against the option lists this
  // page actually renders, so a stale stored value can never select
  // itself into an invisible state.
  const storedFilters = useMemo(readStoredAdminUserFilters, []);
  const storedRoleValid =
    storedFilters?.roleFilter !== undefined &&
    ROLE_OPTIONS.some((o) => o.value === storedFilters.roleFilter);
  const [searchQuery, setSearchQuery] = useState(storedFilters?.searchQuery ?? '');
  const [roleFilter, setRoleFilter] = useState(
    deepLink.role ??
      (storedRoleValid ? (storedFilters?.roleFilter as string) : 'all'),
  );
  const [statusFilter, setStatusFilter] = useState(() => {
    const initialRole =
      deepLink.role ??
      (storedRoleValid ? (storedFilters?.roleFilter as string) : 'all');
    const candidate = deepLink.status ?? storedFilters?.statusFilter ?? 'all';
    return candidate !== 'all' &&
      statusOptionsForRole(initialRole).some((o) => o.value === candidate)
      ? candidate
      : 'all';
  });
  // Dedicated ADMIN lifecycle status — only visible (and only sent) while
  // Role = Admin. Kept separate from statusFilter so each dropdown
  // remembers its own selection while the other one is hidden.
  const [adminStatusFilter, setAdminStatusFilter] = useState(
    storedFilters?.adminStatusFilter !== undefined &&
      ADMIN_STATUS_OPTIONS.some((o) => o.value === storedFilters.adminStatusFilter)
      ? storedFilters.adminStatusFilter
      : 'all',
  );
  // ZIP filters — drivers only. zipFilter is a prefix ("900" = all 900xx,
  // the LA metro area); the Region picker is an exact county-backed list
  // from the backend. The old From/To range is gone: exact region lists
  // + prefix cover every real query, and guessed bands are what produced
  // wrong memberships in the first place.
  const [zipFilter, setZipFilter] = useState(
    // Re-sanitize the stored value through the same digits-only/5-max rule
    // the input enforces, so a tampered storage entry can't smuggle
    // anything the field itself would never produce.
    (storedFilters?.zipFilter ?? '').replace(/\D/g, '').slice(0, 5),
  );
  // ZIP filtering is meaningful only for drivers — customers have NO ZIP
  // field in the database (the only ZIP column is Driver.residentialZip).
  // ZIP filters (Region + prefix) are hidden entirely until Role =
  // Driver — customers have no home ZIP. Typed values are kept in state
  // but NOT sent while hidden, so switching back to Driver restores them
  // instead of silently zeroing the result list.
  const zipEnabled = roleFilter === 'DRIVER';
  // Named-region picker for the ZIP filter: 'any' = no region filter,
  // a region value from the API = exact county-backed ZIP list applied
  // server-side, 'custom' = the admin hand-typed a ZIP prefix instead.
  // The list comes from the backend (generated from real ZIP→county
  // data) — nothing geographic is hardcoded in the frontend.
  const [zipRegion, setZipRegion] = useState(
    // 'any'/'custom' are this page's own reserved values; a stored region
    // id is restored as-is and sanity-checked against the backend list
    // once it loads (see the effect below) — region lists are generated
    // data and can change, and a dead id must never sit invisibly in the
    // picker.
    storedFilters?.zipRegion && storedFilters.zipRegion !== ''
      ? storedFilters.zipRegion
      : 'any',
  );
  const { data: zipRegionsData, isLoading: zipRegionsLoading } = useZipRegions();
  const zipRegionOptions = zipRegionsData?.regions ?? [];
  // Restored-region sanity: once the backend list is here, a stored region
  // id that no longer exists (generated data — regions can be renamed or
  // dropped between visits) falls back to 'any' instead of lingering as an
  // invisible value the picker can't render. Reserved values ('any',
  // 'custom') always pass.
  useEffect(() => {
    if (zipRegionsLoading) return;
    if (
      zipRegion !== 'any' &&
      zipRegion !== 'custom' &&
      !zipRegionOptions.some((o) => o.value === zipRegion)
    ) {
      setZipRegion('any');
    }
  }, [zipRegionsLoading, zipRegion, zipRegionOptions]);
  const handleZipRegionChange = (v: string) => {
    setZipRegion(v);
    setPage(1);
    // Picking a region REPLACES the typed prefix (an exact county-backed
    // list beats a digit guess, and the two must not fight); typing a
    // prefix flips the picker back to 'custom'.
    if (v !== 'any' && v !== 'custom') {
      setZipFilter('');
    }
  };
  // Typing a ZIP prefix means the admin is doing something finer than a
  // named region — the onChange handler flips the picker to "custom"
  // instead of silently keeping a region filter alongside it.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // The dashboard can navigate here with a NEW deep link while this page
  // is already mounted (same route → no remount → the state initializers
  // above never run again). Re-apply whenever the deep link changes;
  // picking a different tile is the only way it can change, and editing
  // filters on this page never rewrites the URL, so this never fights
  // the admin's hand.
  const deepLinkKey = JSON.stringify(deepLink);
  useEffect(() => {
    if (deepLink.role !== undefined) setRoleFilter(deepLink.role);
    if (deepLink.status !== undefined) setStatusFilter(deepLink.status);
    if (deepLink.role !== undefined || deepLink.status !== undefined) {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkKey]);

  // Mirror every filter change into sessionStorage. Writing unconditionally
  // means "clearing" needs no special path: fixing a field one by one or
  // hitting Clear filters just changes state, and what's stored always
  // equals what the admin currently sees. Storage failures (private mode,
  // quota) are swallowed — persistence is a convenience, never a feature
  // the table depends on.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        ADMIN_USERS_FILTERS_KEY,
        JSON.stringify({
          searchQuery,
          roleFilter,
          statusFilter,
          adminStatusFilter,
          zipFilter,
          zipRegion,
        }),
      );
    } catch {
      // best-effort only
    }
  }, [searchQuery, roleFilter, statusFilter, adminStatusFilter, zipFilter, zipRegion]);

  // ==================== DIALOG STATE ====================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve-customer' | 'reject-customer' | 'suspend-customer' | 'unsuspend-customer' | 'invite-driver' | 'resend-invite-driver' | 'approve-driver' | 'reject-driver' | 'suspend-driver' | 'unsuspend-driver' | 'resend-admin-invite' | 'disable-admin' | 'enable-admin' | 'promote-admin' | 'demote-admin'>('approve-customer');
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  // Invite Admin Dialog State
  const [inviteAdminDialogOpen, setInviteAdminDialogOpen] = useState(false);

  // ==================== QUERIES (V2 — single call) ====================

  const {
    data: v2Data,
    isLoading: usersLoading,
    isFetching: usersFetching,
    isError: usersError,
    refetch: refetchUsers,
  } = useAdminUsersV2({
    q: searchQuery || undefined,
    role: roleFilter !== 'all' ? roleFilter : undefined,
    status:
      roleFilter === 'ADMIN'
        // Admin lifecycle values go out prefixed — the backend recognizes
        // ADMIN_* and applies the admin conditions (incl. invite-token
        // liveness for Pending invite vs Invitation expired).
        ? (adminStatusFilter !== 'all' ? `ADMIN_${adminStatusFilter}` : undefined)
        : (statusFilter !== 'all' ? statusFilter : undefined),
    region:
      zipEnabled && zipRegion !== 'any' && zipRegion !== 'custom'
        ? zipRegion
        : undefined,
    zipPrefix: zipEnabled ? (zipFilter.trim() || undefined) : undefined,
    page,
    pageSize,
  });

  // V2 response combines summary + rows + pagination in one object
  const usersData = v2Data;
  const summary = v2Data?.summary;
  const summaryLoading = usersLoading;
  const refetchSummary = refetchUsers;

  // ── Status stat cards (dedicated global-stats endpoint) ──
  // Rows of small per-status count cards above the table: Drivers first,
  // then Business customers (dealers), then Private customers, then Admins.
  // Clicking a card applies Role + Status to the table below; clicking it
  // again clears. Counts come from GET /users/admin/status-stats — never
  // from the paginated users list — so they stay stable across pages/filters.
  const { data: statusStats, isLoading: statusStatsLoading } = useAdminUserStatusStats();

  // LIVE stats + LIVE table: the backend pings the admin-only staff:ops room
  // over the socket whenever any user/role row is created or changes status
  // (new signup, invite, approval, suspension, hold, ...). We invalidate the
  // stats query immediately (AnimatedNumber cards roll to the new values) and
  // coalesce a table refresh into one refetch per 600ms window so a burst of
  // pings (batch invite/import) costs ONE paginated query, not one per event.
  // The server stays the single source of truth for both surfaces. The
  // navbar's SupportNavBadge keeps the staff:ops room joined for the whole
  // app (reference-counted in socket.ts), so this listener needs no room
  // management of its own.
  const tableRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (tableRefreshTimer.current) clearTimeout(tableRefreshTimer.current);
    },
    []
  );
  useSocketEvent('users:stats-changed', () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users-status-stats'] });
    if (tableRefreshTimer.current) clearTimeout(tableRefreshTimer.current);
    tableRefreshTimer.current = setTimeout(() => {
      tableRefreshTimer.current = null;
      // Prefix key: matches every ['admin-users-v2', params] variant, so the
      // visible page (and any filter combination in React Query's cache)
      // refetches exactly once.
      queryClient.invalidateQueries({ queryKey: ['admin-users-v2'] });
    }, 600);
  });

  const handleStatusCardClick = useCallback(
    (role: 'DRIVER' | 'BUSINESS_CUSTOMER' | 'PRIVATE_CUSTOMER', status: string) => {
      const isActive = roleFilter === role && statusFilter === status;
      if (isActive) {
        setRoleFilter('all');
        setStatusFilter('all');
      } else {
        setRoleFilter(role);
        setStatusFilter(status);
        setAdminStatusFilter('all');
      }
      setPage(1);
    },
    [roleFilter, statusFilter, setRoleFilter, setStatusFilter, setAdminStatusFilter, setPage]
  );

  // Admin-row cards drive the SEPARATE admin lifecycle dropdown state
  // (ADMIN_ prefix — see ADMIN_STATUS_OPTIONS). Same click-twice-to-clear
  // contract as the role rows.
  const handleAdminCardClick = useCallback(
    (status: string) => {
      const adminValue = `ADMIN_${status}`;
      const isActive = roleFilter === 'ADMIN' && adminStatusFilter === adminValue;
      if (isActive) {
        setRoleFilter('all');
        setAdminStatusFilter('all');
      } else {
        setRoleFilter('ADMIN');
        setAdminStatusFilter(adminValue);
        setStatusFilter('all');
      }
      setPage(1);
    },
    [roleFilter, adminStatusFilter, setRoleFilter, setAdminStatusFilter, setStatusFilter, setPage]
  );

  // Hero (big total) click — filter to the ROLE with NO status filter.
  // Second click clears everything. Distinct from the per-status tiles
  // under the number, which keep the Role + Status behavior (and the
  // Admin row keeps driving its dedicated ADMIN_ lifecycle dropdown).
  const handleRoleCardClick = useCallback(
    (role: 'DRIVER' | 'BUSINESS_CUSTOMER' | 'PRIVATE_CUSTOMER' | 'ADMIN') => {
      const isRoleOnlyActive =
        roleFilter === role &&
        statusFilter === 'all' &&
        (role !== 'ADMIN' || adminStatusFilter === 'all');
      if (isRoleOnlyActive) {
        setRoleFilter('all');
        setStatusFilter('all');
        setAdminStatusFilter('all');
      } else {
        setRoleFilter(role);
        setStatusFilter('all');
        setAdminStatusFilter('all');
      }
      setPage(1);
    },
    [
      roleFilter,
      statusFilter,
      adminStatusFilter,
      setRoleFilter,
      setStatusFilter,
      setAdminStatusFilter,
      setPage,
    ]
  );

  const sumStats = (map?: Record<string, number>) =>
    map ? Object.values(map).reduce((a, b) => a + (b ?? 0), 0) : 0;

  // Derived values from the V2 response
  const users = v2Data?.rows ?? [];
  // Super-admin gate, source 2 of 2 (see loginSnapshotSuperAdmin): the
  // current user's own row in the freshly fetched list is server truth,
  // so the elevated buttons appear even when the stored login snapshot
  // predates the flag — no sign-out/in required.
  const isCurrentUserSuperAdmin =
    loginSnapshotSuperAdmin ||
    (actorUserId ? users.some((u) => u.id === actorUserId && u.isSuperAdmin) : false);
  const totalUsers = v2Data?.pagination?.totalRows ?? 0;
  const totalPages = v2Data?.pagination?.totalPages ?? 1;
  const roleAutoForced = v2Data?.filtersApplied?.roleAutoForced ?? false;

  // ==================== MUTATIONS ====================

  const approveCustomerMutation = useApproveCustomer();
  const rejectCustomerMutation = useRejectCustomer();
  const suspendCustomerMutation = useSuspendCustomer();
  const unsuspendCustomerMutation = useUnsuspendCustomer();
  const approveDriverMutation = useApproveDriver();
  const rejectDriverMutation = useRejectDriver();
  const suspendDriverMutation = useSuspendDriver();
  const unsuspendDriverMutation = useUnsuspendDriver();
  const inviteDriverMutation = useInviteDriver();
  const resendInviteDriverMutation = useResendInviteDriver();
  const inviteAdminMutation = useInviteAdminUser();
  const resendAdminInviteMutation = useResendAdminInvite();
  const disableAdminMutation = useDisableAdmin();
  const promoteAdminMutation = usePromoteAdmin();
  const demoteAdminMutation = useDemoteAdmin();
  const enableAdminMutation = useEnableAdmin();

  // ==================== FORMS ====================

  const suspendForm = useForm<SuspendFormData>({
    resolver: zodResolver(suspendSchema),
    defaultValues: { reason: '' },
  });

  const rejectForm = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });

  const inviteAdminForm = useForm<InviteAdminFormData>({
    resolver: zodResolver(inviteAdminSchema),
    defaultValues: {
      email: '',
      fullName: '',
      phone: '',
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

  const handleInviteDriver = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    inviteDriverMutation.mutate(
      { pathParams: { id: selectedUser.id }, actorUserId },
      {
        onSuccess: () => {
          toast.success('Driver invited successfully');
          closeDialog();
        },
        onError: () => toast.error('Failed to invite driver'),
      }
    );
  }, [selectedUser, actorUserId, inviteDriverMutation, closeDialog]);

  const handleResendInviteDriver = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    resendInviteDriverMutation.mutate(
      { pathParams: { id: selectedUser.id }, actorUserId },
      {
        onSuccess: () => {
          toast.success('Invite resent successfully');
          closeDialog();
        },
        onError: (error: any) =>
          toast.error('Failed to resend invite', {
            description: error?.message || 'Please try again.',
          }),
      }
    );
  }, [selectedUser, actorUserId, resendInviteDriverMutation, closeDialog]);

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

  const handleInviteAdmin = useCallback((data: InviteAdminFormData) => {
    if (!actorUserId) {
      toast.error('Unable to identify current user');
      return;
    }

    inviteAdminMutation.mutate({
      email: data.email,
      fullName: data.fullName,
      phone: data.phone || undefined,
      actorUserId,
    }, {
      onSuccess: () => {
        toast.success('Invite sent', {
          description: `${data.email} will receive an email with a link to set their own password.`,
        });
        setInviteAdminDialogOpen(false);
        inviteAdminForm.reset();
      },
      onError: (error: any) => {
        toast.error(error?.message || 'Failed to send admin invite');
      },
    });
  }, [actorUserId, inviteAdminMutation, inviteAdminForm]);

  const handleResendAdminInvite = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    resendAdminInviteMutation.mutate(
      { pathParams: { id: selectedUser.id }, actorUserId },
      {
        onSuccess: () => {
          toast.success('Invite resent successfully', {
            description: `A new setup link was sent to ${selectedUser.email}.`,
          });
          closeDialog();
        },
        onError: (error: any) =>
          toast.error('Failed to resend invite', {
            description: error?.message || 'Please try again.',
          }),
      }
    );
  }, [selectedUser, actorUserId, resendAdminInviteMutation, closeDialog]);

  const handleDisableAdmin = useCallback((data: SuspendFormData) => {
    if (!selectedUser || !actorUserId) return;
    disableAdminMutation.mutate(
      { pathParams: { id: selectedUser.id }, reason: data.reason, actorUserId },
      {
        onSuccess: () => {
          toast.success('Admin disabled', {
            description: `${selectedUser.email} was signed out immediately and can no longer sign in.`,
          });
          closeDialog();
        },
        onError: (error: any) =>
          toast.error('Failed to disable admin', {
            description: error?.message || 'Please try again.',
          }),
      }
    );
  }, [selectedUser, actorUserId, disableAdminMutation, closeDialog]);

  const handleEnableAdmin = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    enableAdminMutation.mutate(
      { pathParams: { id: selectedUser.id }, actorUserId },
      {
        onSuccess: () => {
          toast.success('Admin enabled', {
            description: `${selectedUser.email} can sign in again with their existing password.`,
          });
          closeDialog();
        },
        onError: (error: any) =>
          toast.error('Failed to enable admin', {
            description: error?.message || 'Please try again.',
          }),
      }
    );
  }, [selectedUser, actorUserId, enableAdminMutation, closeDialog]);

  const handlePromoteAdmin = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    promoteAdminMutation.mutate(
      { pathParams: { id: selectedUser.id }, actorUserId },
      {
        onSuccess: () => {
          toast.success('Promoted to super admin', {
            description: `${selectedUser.email} now holds the elevated actions: disabling admins and managing super admins.`,
          });
          closeDialog();
        },
        onError: (error: any) =>
          toast.error('Failed to promote admin', {
            description: error?.message || 'Please try again.',
          }),
      }
    );
  }, [selectedUser, actorUserId, promoteAdminMutation, closeDialog]);

  const handleDemoteAdmin = useCallback(() => {
    if (!selectedUser || !actorUserId) return;
    demoteAdminMutation.mutate(
      { pathParams: { id: selectedUser.id }, actorUserId },
      {
        onSuccess: () => {
          toast.success('Downgraded to admin', {
            description: `${selectedUser.email} is now a regular administrator.`,
          });
          closeDialog();
        },
        onError: (error: any) =>
          toast.error('Failed to downgrade super admin', {
            description: error?.message || 'Please try again.',
          }),
      }
    );
  }, [selectedUser, actorUserId, demoteAdminMutation, closeDialog]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setAdminStatusFilter('all');
    setZipFilter('');
    setZipRegion('any');
    setPage(1);
  }, []);

  // Only the VISIBLE dropdown counts — each status state is dormant while
  // the other one is on screen (Role = Admin swaps the Status field).
  // Extracted to its own const: comparing roleFilter inside the
  // hasActiveFilters expression AFTER `roleFilter !== 'all' ||` would let
  // control-flow narrowing shrink it to 'all' and flag a TS2367.
  const statusFilterActive =
    roleFilter === 'ADMIN' ? adminStatusFilter !== 'all' : statusFilter !== 'all';

  const hasActiveFilters =
    searchQuery ||
    roleFilter !== 'all' ||
    statusFilterActive ||
    (zipEnabled &&
      (zipRegion !== 'any' ||
        zipFilter.trim() !== ''));

  // ==================== RENDER ====================

  const pagination = v2Data?.pagination;

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
              onClick={() => setInviteAdminDialogOpen(true)}
              className="bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 rounded-xl"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Invite Admin
            </Button>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="rounded-xl">
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', usersFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </section>

        {/* Role stat cards — ONE row of four ERP/finance-style cards
            (Drivers / Business / Private / Admin). The BIG number filters
            the table to the role with no status; each colored count under
            it filters to that exact status (original behavior). Global
            counts from the dedicated stats endpoint. LIVE: refetches on
            the users:stats-changed socket ping and every number animates. */}
        <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RoleStatCard
            icon={<Truck className="h-3.5 w-3.5" />}
            accent="bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400"
            title="Drivers"
            total={sumStats(statusStats?.drivers)}
            loading={statusStatsLoading}
            configs={DRIVER_STAT_CARDS}
            counts={statusStats?.drivers}
            isRoleFiltered={roleFilter === 'DRIVER'}
            isRoleOnlyActive={roleFilter === 'DRIVER' && statusFilter === 'all'}
            isStatusActive={(c) => roleFilter === 'DRIVER' && statusFilter === c.value}
            onRoleClick={() => handleRoleCardClick('DRIVER')}
            onStatusClick={(c) => handleStatusCardClick('DRIVER', c.value)}
          />
          <RoleStatCard
            icon={<Store className="h-3.5 w-3.5" />}
            accent="bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400"
            title="Business Customers"
            total={sumStats(statusStats?.businessCustomers)}
            loading={statusStatsLoading}
            configs={CUSTOMER_STAT_CARDS}
            counts={statusStats?.businessCustomers}
            isRoleFiltered={roleFilter === 'BUSINESS_CUSTOMER'}
            isRoleOnlyActive={roleFilter === 'BUSINESS_CUSTOMER' && statusFilter === 'all'}
            isStatusActive={(c) => roleFilter === 'BUSINESS_CUSTOMER' && statusFilter === c.value}
            onRoleClick={() => handleRoleCardClick('BUSINESS_CUSTOMER')}
            onStatusClick={(c) => handleStatusCardClick('BUSINESS_CUSTOMER', c.value)}
          />
          <RoleStatCard
            icon={<User className="h-3.5 w-3.5" />}
            accent="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400"
            title="Private Customers"
            total={sumStats(statusStats?.privateCustomers)}
            loading={statusStatsLoading}
            configs={CUSTOMER_STAT_CARDS}
            counts={statusStats?.privateCustomers}
            isRoleFiltered={roleFilter === 'PRIVATE_CUSTOMER'}
            isRoleOnlyActive={roleFilter === 'PRIVATE_CUSTOMER' && statusFilter === 'all'}
            isStatusActive={(c) => roleFilter === 'PRIVATE_CUSTOMER' && statusFilter === c.value}
            onRoleClick={() => handleRoleCardClick('PRIVATE_CUSTOMER')}
            onStatusClick={(c) => handleStatusCardClick('PRIVATE_CUSTOMER', c.value)}
          />
          <RoleStatCard
            icon={<Shield className="h-3.5 w-3.5" />}
            accent="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
            title="Admins"
            total={statusStats?.adminsTotal ?? sumStats(statusStats?.admins)}
            loading={statusStatsLoading}
            configs={ADMIN_STAT_CARDS}
            counts={statusStats?.admins}
            isRoleFiltered={roleFilter === 'ADMIN'}
            isRoleOnlyActive={roleFilter === 'ADMIN' && adminStatusFilter === 'all'}
            isStatusActive={(c) => roleFilter === 'ADMIN' && adminStatusFilter === `ADMIN_${c.value}`}
            onRoleClick={() => handleRoleCardClick('ADMIN')}
            onStatusClick={(c) => handleAdminCardClick(c.value)}
          />
        </section>

        {/* V2 Filters — search/role/status + driver-only ZIP region & ZIP,
            with the ZIP From/To range sweep tucked under "More". */}
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 mb-4">
          <CardContent className="p-3">
            {/* Card actions — pinned to the top-right corner on their own
                line so they never sit inside the filter row. Clear only
                renders when a filter is active. Compact: the whole filter
                card was shortened so the table stays in the first screen. */}
            {hasActiveFilters && (
              <div className="flex items-center justify-end gap-1 mb-1">
                <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs text-red-500 hover:text-red-600" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              </div>
            )}

            {/* Primary Filters — responsive grid (1 col on phones, 2 on
                small tablets, 6 on desktop) so fields never overlap or
                squeeze at any width. Region + ZIP only render once
                Role = Driver is chosen (hidden, not disabled). */}
            <div className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-2 lg:grid-cols-6">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Name, email, username, phone..."
                    className="pl-9 rounded-xl h-9 w-full"
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</Label>
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    setRoleFilter(v);
                    setPage(1);
                    // The Status dropdown swaps its option list with the
                    // Role, so a selected-but-invisible value would be
                    // worse than none: if the new role's list doesn't
                    // offer the current selection, reset to All Status.
                    // Switching to Admin does NOT reset: the Status field
                    // swaps to the admin lifecycle dropdown and the
                    // unified selection stays dormant (it is not sent
                    // while hidden) and comes back intact when the admin
                    // switches away.
                    if (
                      v !== 'ADMIN' &&
                      statusFilter !== 'all' &&
                      !statusOptionsForRole(v).some(o => o.value === statusFilter)
                    ) {
                      setStatusFilter('all');
                    }
                  }}
                >
                  <SelectTrigger className="mt-1 rounded-xl h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter — ROLE-AWARE SWAP. The Status field swaps
                  BOTH its dropdown variant and its option list with the
                  Role: Role = Admin renders the admin-lifecycle options,
                  Role = Driver the driver-native statuses (Pending
                  Approval / Waitlisted / Invited / ...), customer roles
                  the customer approval statuses, and Role = All the
                  unified cross-role list. Every list only contains
                  statuses that exist on that role's rows, and labels
                  match the badges the rows show — so the filter result
                  always looks like the option that was picked. Identical
                  UI on purpose — nothing to relearn. */}
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</Label>
                {roleFilter === 'ADMIN' ? (
                  <Select
                    value={adminStatusFilter}
                    onValueChange={(v) => {
                      setAdminStatusFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="mt-1 rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADMIN_STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v);
                      setPage(1);
                      // Role = All + a driver-only status: only drivers
                      // can ever match, so switch Role to Driver (the
                      // server auto-forces it too). Driver/customer lists
                      // never offer driver-only-orphaned values, so no
                      // guard is needed there.
                      const isDriverOnly =
                        roleFilter === 'all' &&
                        V2_STATUS_OPTIONS.find(o => o.value === v)?.driverOnly;
                      if (isDriverOnly) {
                        toast.info('Showing drivers only', {
                          description: `${V2_STATUS_OPTIONS.find(o => o.value === v)?.label} only exists on driver profiles.`,
                        });
                        setRoleFilter('DRIVER');
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 rounded-xl h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptionsForRole(roleFilter).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* ZIP Region — named CA regions; fills the From/To range.
                  Hidden entirely until Role = Driver (customers have no
                  ZIP), per admin UX decision — not merely disabled.
                  min-w-0 on the cell + w-full on the trigger pin the
                  control to its grid column: long region names (e.g.
                  "Inland Empire (Riverside / San Bernardino)") ellipsize
                  inside the trigger instead of stretching it over the
                  ZIP field. The ! variants out-rank the trigger's built-in
                  w-fit / flex value styles so the clamp always applies. */}
              {zipEnabled && (
              <div className="min-w-0">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Region</Label>
                <Select
                  value={zipRegion}
                  onValueChange={handleZipRegionChange}
                >
                  <SelectTrigger className="mt-1 rounded-xl h-9 text-sm w-full min-w-0 [&_[data-slot=select-value]]:block! [&_[data-slot=select-value]]:max-w-full! [&_[data-slot=select-value]]:truncate!">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Region</SelectItem>
                    {zipRegionsLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading regions…
                      </SelectItem>
                    ) : (
                      zipRegionOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                    {zipRegion === 'custom' && (
                      <SelectItem value="custom">Custom (manual ZIPs)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              )}

              {/* ZIP Filter — driver home ZIP prefix. Hidden until Role =
                  Driver. Typing here flips the Region picker to Custom so
                  the two tools never fight (the backend would AND them). */}
              {zipEnabled && (
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ZIP</Label>
                <Input
                  value={zipFilter}
                  onChange={(e) => {
                      setZipFilter(e.target.value.replace(/\D/g, '').slice(0, 5));
                      setZipRegion('custom');
                      setPage(1);
                    }}
                  placeholder="e.g. 900"
                  inputMode="numeric"
                  className="mt-1 rounded-xl h-9 w-full"
                />
              </div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* V2: auto-forced role banner (shown when backend auto-switched to DRIVER) */}
        {roleAutoForced && (
          <div className="px-4 py-3 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-2xl mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="text-sm text-sky-700 dark:text-sky-300">
              Showing drivers only — this status only applies to drivers, not customers.
            </span>
          </div>
        )}

        {/* Fetch indicator — the query keeps previous rows visible while a
            filter/page change refetches, which read as "frozen". The
            payments/disputes pages show this same spinner next to their
            result counts; here it sits directly above the table. Hidden
            during the initial load, where the skeleton rows below speak. */}
        {usersFetching && !usersLoading && (
          <div className="flex items-center justify-end gap-2 mb-3">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-primary font-medium">Loading…</span>
          </div>
        )}

        {/* Table */}
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
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
                    {/* Loading state — first fetch for this filter combo has
                        no rows to keep, so without this the table renders as
                        a silent blank. Skeleton bars in a full-width cell
                        reuse the TableSkeleton defined below the page. */}
                    {usersLoading && (
                      <TableRow className="border-b border-slate-100 dark:border-slate-800">
                        <TableCell colSpan={7} className="px-0 py-0">
                          <TableSkeleton rows={6} />
                        </TableCell>
                      </TableRow>
                    )}
                    {!usersLoading && users.map((user) => (
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
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-sm">{user.fullName}</span>
                                {/* Super Admin badge — marks elevated administrators. Shown to
                                    everyone so regular admins understand why they have fewer
                                    actions on these rows. */}
                                {user.roles === 'ADMIN' && user.isSuperAdmin && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                                    title="This admin can disable admins and manage super admins"
                                  >
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    Super Admin
                                  </span>
                                )}
                                {/* On Hold badge — marks drivers parked as ON_HOLD
                                    (held without rejecting — e.g. driver oversupply in
                                    a region). Same name-chip pattern as Super Admin. */}
                                {user.roles === 'DRIVER' && user.driver?.status === 'ON_HOLD' && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                    title="This driver is on hold — held without rejection. Release Hold or Reject from their profile."
                                  >
                                    <PauseCircle className="w-2.5 h-2.5" />
                                    On Hold
                                  </span>
                                )}
                                {/* Referred badge — shown for drivers who were referred by another driver.
                                    Hover shows the referrer's name + the referral code used + the referral status.
                                    TooltipProvider wraps the badge so the tooltip works without a global provider. */}
                                {user.driver?.referredBy && (
                                  <TooltipProvider delayDuration={150}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className={cn(
                                            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border cursor-help',
                                            user.driver.referredBy.status === 'REWARD_PAID' && 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
                                            user.driver.referredBy.status === 'EXPIRED' && 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
                                            !['REWARD_PAID', 'EXPIRED'].includes(user.driver.referredBy.status) && 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
                                          )}
                                        >
                                          <Gift className="w-2.5 h-2.5" />
                                          Referred
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <div className="space-y-0.5">
                                          <div className="font-bold">
                                            {/* referrer is nullable (customer referrals, or the
                                                referring driver was deleted → ON DELETE SET NULL)
                                                — never assume it's there. */}
                                            Referred by {user.driver.referredBy.referrer?.user?.fullName || 'Unknown'}
                                          </div>
                                          <div className="text-[10px] opacity-80 font-mono">
                                            Code: {user.driver.referredBy.referralCode}
                                          </div>
                                          <div className="text-[10px] opacity-80">
                                            Status: {user.driver.referredBy.status}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <RoleBadge role={user.roles} />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {user.customer ? (
                            <CustomerStatusBadge status={user.customer.approvalStatus} />
                          ) : user.driver ? (
                            <DriverStatusBadge status={user.driver.status} />
                          ) : (user.roles === 'BUSINESS_CUSTOMER' || user.roles === 'PRIVATE_CUSTOMER') ? (
                            // Orphaned signup — User row exists but no Customer
                            // record. Previously this showed a misleading
                            // "PENDING" badge (the hardcoded fallback). The
                            // signup actually FAILED — show "Incomplete Signup"
                            // instead so admin knows this row is garbage and
                            // can be deleted.
                            <IncompleteSignupBadge emailVerifiedAt={user.emailVerifiedAt} />
                          ) : user.roles === 'ADMIN' ? (
                            // Admin lifecycle status — a single truthful badge
                            // instead of the old "Active + Invite pending hint"
                            // pair. Unverified admins read Pending invite or
                            // Invitation expired (server knows the token
                            // expiry) and can NEVER sign in; only verified,
                            // enabled admins show Active.
                            <AdminStatusBadge status={effectiveAdminStatus(user)} />
                          ) : (
                            <StatusBadge isActive={user.isActive} disabledAt={user.disabledAt} />
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {user.customer ? (
                            <div className="space-y-1">
                              <Badge variant="outline" className="text-[9px] font-bold">
                                {CUSTOMER_TYPE_LABELS[user.customer.customerType]}
                              </Badge>
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
                              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Driver</span>
                              {user.driver.residentialZip && (
                                <div className={cn(
                                  'text-xs',
                                  // Green ZIP = the driver's home ZIP sits
                                  // inside the service-area polygon (same
                                  // truth the badge below shows) — eligible
                                  // for review. Plain slate = everything else.
                                  user.driver.serviceAreaInArea === true
                                    ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500'
                                )}>
                                  ZIP {user.driver.residentialZip}
                                </div>
                              )}
                              {/* Service-area badge — DERIVED from the LA-metro
                                  polygon (point-in-polygon on the driver's zip).
                                  Green = in the service area (eligible for
                                  review ONLY — not approved to drive; status
                                  stays manual). Gray = outside. Amber = no zip
                                  or unresolvable zip, flagged for review. */}
                              <ServiceAreaBadge
                                inArea={user.driver.serviceAreaInArea ?? null}
                                flagged={user.driver.serviceAreaFlagged ?? false}
                              />
                              {/* Schedule-change requests count hidden per ops
                                  decision (always 0 today — nothing in the app
                                  creates ScheduleChangeRequests). Restore if the
                                  workflow ever gets a UI. */}
                              {/* <div className="text-xs text-slate-500">
                                {user._count.scheduleChangesRequested} schedule requests
                              </div> */}
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
                            {/* Driver invited - show Resend Invite */}
                            {!user.disabledAt && user.driver?.status === 'INVITED' && (
                              <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg" onClick={() => openDialog('resend-invite-driver', user)}>
                                <Send className="w-3.5 h-3.5 mr-1" /> Resend Invite
                              </Button>
                            )}
                            {/* Admin with pending OR expired invite - show Resend Invite
                                (resending is the fix for both states) */}
                            {!user.disabledAt && user.roles === 'ADMIN' && !user.emailVerifiedAt && (
                              <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg" onClick={() => openDialog('resend-admin-invite', user)}>
                                <Send className="w-3.5 h-3.5 mr-1" /> Resend Invite
                              </Button>
                            )}
                            {/* Admin ACTIVE (invite accepted) - show Disable for SUPER ADMINS ONLY.
                                Regular admins no longer see Disable at all — the server
                                rejects them with 403 even if they craft the request. Pending
                                and expired invites get no Disable — they can't sign in anyway;
                                the fix is resending the invite. Never on your own row. */}
                            {isCurrentUserSuperAdmin && !user.disabledAt && user.roles === 'ADMIN' && user.id !== actorUserId && effectiveAdminStatus(user) === 'ACTIVE' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="rounded-lg"
                                onClick={() => openDialog('disable-admin', user)}
                                title="Sign this admin out and block sign-in until re-enabled"
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" /> Disable
                              </Button>
                            )}
                            {/* Admin disabled - show Enable for SUPER ADMINS ONLY.
                                Only a super admin may undo a disable decision —
                                regular admins don't see the button, and the server
                                rejects them with 403 even if they craft the request. */}
                            {isCurrentUserSuperAdmin && user.disabledAt && user.roles === 'ADMIN' && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                onClick={() => openDialog('enable-admin', user)}
                                title="Restore this admin's access"
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Enable
                              </Button>
                            )}
                            {/* Super-admin hierarchy actions — visible to SUPER ADMINS only.
                                Promote: active, verified admins that aren't super admins yet
                                (never on your own row — you already hold the flag).
                                Demote: super admins other than yourself; the backend also
                                refuses to demote the last remaining super admin. */}
                            {isCurrentUserSuperAdmin && user.roles === 'ADMIN' && !user.isSuperAdmin && user.id !== actorUserId && effectiveAdminStatus(user) === 'ACTIVE' && (
                              <Button
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                                onClick={() => openDialog('promote-admin', user)}
                                title="Grant elevated powers: disable admins, manage super admins"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Make Super Admin
                              </Button>
                            )}
                            {isCurrentUserSuperAdmin && user.roles === 'ADMIN' && user.isSuperAdmin && user.id !== actorUserId && effectiveAdminStatus(user) === 'ACTIVE' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => openDialog('demote-admin', user)}
                                title="Remove elevated powers — this admin keeps regular admin access"
                              >
                                <ShieldOff className="w-3.5 h-3.5 mr-1" /> Downgrade
                              </Button>
                            )}
                            {/* Driver waitlisted - show Invite / Reject */}
                            {!user.disabledAt && user.driver?.status === 'WAITLISTED' && (
                              <>
                                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg" onClick={() => openDialog('invite-driver', user)}>
                                  <Send className="w-3.5 h-3.5 mr-1" /> Invite
                                </Button>
                                <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => openDialog('reject-driver', user)}>
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {/* Driver pending approval - show Approve/Reject */}
                            {!user.disabledAt && user.driver?.status === 'PENDING_APPROVAL' && (
                              <>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" onClick={() => openDialog('approve-driver', user)}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => openDialog('reject-driver', user)}>
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            {/* Driver rejected - show Approve button */}
                            {!user.disabledAt && user.driver?.status === 'REJECTED' && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" onClick={() => openDialog('approve-driver', user)}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reinstate
                              </Button>
                            )}
                            {/* Driver legacy pending - show badge */}
                            {!user.disabledAt && user.driver?.status === 'PENDING' && (
                              <Badge variant="outline" className="rounded-lg border-amber-200 text-amber-600 text-xs">Legacy Pending</Badge>
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
                    {/* Empty state — an unexplained blank table reads as a
                        broken filter (the "Disabled (0)" report). Say WHY
                        it's empty and offer the way out. Only after loading
                        completes: every filter change is a fresh query key,
                        so rows are [] mid-fetch too. */}
                    {!usersLoading && users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="px-4 py-14 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                              No users match the current filters
                            </p>
                            <p className="text-xs text-slate-400 max-w-sm">
                              The summary cards above always count everyone — the table only lists rows matching the filters. Try a different status or clear them.
                            </p>
                            {hasActiveFilters && (
                              <Button variant="outline" size="sm" className="mt-2 rounded-lg" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

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
          </CardContent>
        </Card>
      </main>

      {/* Action Dialog — customer/driver actions + admin invite resend.
          The four super-admin tier actions (disable / enable / promote /
          demote admin) render through the reusable ConfirmActionDialog
          below instead, so they are skipped here. */}
      <Dialog
        open={
          dialogOpen &&
          dialogAction !== 'disable-admin' &&
          dialogAction !== 'enable-admin' &&
          dialogAction !== 'promote-admin' &&
          dialogAction !== 'demote-admin'
        }
        onOpenChange={setDialogOpen}
      >
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {dialogAction === 'approve-customer' && 'Approve Customer'}
              {dialogAction === 'reject-customer' && 'Reject Customer'}
              {dialogAction === 'suspend-customer' && 'Suspend Customer'}
              {dialogAction === 'unsuspend-customer' && 'Unsuspend Customer'}
              {dialogAction === 'invite-driver' && 'Invite Driver'}
              {dialogAction === 'resend-invite-driver' && 'Resend Invite'}
              {dialogAction === 'resend-admin-invite' && 'Resend Admin Invite'}
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
              {dialogAction === 'invite-driver' && `Invite ${selectedUser?.fullName} to complete their driver application? They will receive an email with instructions.`}
              {dialogAction === 'resend-invite-driver' && `Resend the invitation email to ${selectedUser?.email}? A new onboarding link will be generated.`}
              {dialogAction === 'resend-admin-invite' && `Resend the setup link to ${selectedUser?.email}? The previous link will stop working and a new one (valid 48 hours) will be sent.`}
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

          {/* Invite Driver Confirmation */}
          {dialogAction === 'invite-driver' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
                <div className="text-sm text-sky-700 dark:text-sky-300">
                  This will send an email to {selectedUser?.email} with instructions to complete their driver application.
                  They will be moved from <b>Waitlisted</b> to <b>Invited</b> status.
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeDialog} className="rounded-2xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleInviteDriver}
                  disabled={inviteDriverMutation.isPending}
                  className="rounded-2xl bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {inviteDriverMutation.isPending ? 'Inviting...' : 'Send Invite'}
                </Button>
              </div>
            </div>
          )}

          {/* Resend Invite Driver Confirmation */}
          {dialogAction === 'resend-invite-driver' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
                <div className="text-sm text-sky-700 dark:text-sky-300">
                  A new onboarding link will be generated and sent to {selectedUser?.email}.
                  The previous link will no longer work.
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeDialog} className="rounded-2xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleResendInviteDriver}
                  disabled={resendInviteDriverMutation.isPending}
                  className="rounded-2xl bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {resendInviteDriverMutation.isPending ? 'Sending...' : 'Resend Invite'}
                </Button>
              </div>
            </div>
          )}

          {/* Resend Admin Invite Confirmation */}
          {dialogAction === 'resend-admin-invite' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
                <div className="text-sm text-sky-700 dark:text-sky-300">
                  A new single-use setup link will be emailed to {selectedUser?.email}.
                  The previous link will no longer work. The new admin will set their
                  own password — no password is shared by chat.
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeDialog} className="rounded-2xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleResendAdminInvite}
                  disabled={resendAdminInviteMutation.isPending}
                  className="rounded-2xl bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {resendAdminInviteMutation.isPending ? 'Sending...' : 'Resend Invite'}
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

      {/* Super-admin tier confirmations — rendered through the reusable
          ConfirmActionDialog (src/components/shared/ConfirmActionDialog.tsx)
          so any future page can confirm sensitive actions the same way. */}
      <ConfirmActionDialog
        open={dialogOpen && dialogAction === 'disable-admin'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Disable Admin"
        description={`Disable ${selectedUser?.fullName}'s administrator account? They will be signed out immediately and cannot sign in until a super admin re-enables them.`}
        tone="danger"
        message={
          <>
            <p>
              <b>{selectedUser?.email}</b> loses admin access immediately — their current
              session stops working and sign-in is blocked until re-enabled.
            </p>
            <p>
              The right action when an administrator leaves the team or must be paused.
              Their profile, history, and audit trail are kept.
            </p>
          </>
        }
        confirmLabel="Disable Admin"
        confirmingLabel="Disabling..."
        pending={disableAdminMutation.isPending}
        onConfirm={suspendForm.handleSubmit(handleDisableAdmin)}
      >
        <div>
          <Label className="text-sm font-medium">Reason for disabling</Label>
          <Textarea
            {...suspendForm.register('reason')}
            placeholder="e.g. Offboarding, extended leave..."
            className="mt-1.5 rounded-xl"
            rows={3}
          />
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialogOpen && dialogAction === 'enable-admin'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Enable Admin"
        description={`Restore ${selectedUser?.fullName}'s administrator account? They will be able to sign in again with their existing password.`}
        tone="positive"
        message={
          <>
            {selectedUser?.email} will be able to sign in again with their existing
            password. Nothing else changes — their role and profile are kept.
          </>
        }
        confirmLabel="Enable Admin"
        confirmingLabel="Enabling..."
        pending={enableAdminMutation.isPending}
        onConfirm={handleEnableAdmin}
      />

      <ConfirmActionDialog
        open={dialogOpen && dialogAction === 'promote-admin'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Make Super Admin"
        description={`Promote ${selectedUser?.fullName} to super admin? They will be able to disable administrators and manage the super-admin tier.`}
        tone="accent"
        message={
          <>
            <p>
              <b>{selectedUser?.email}</b> joins the super-admin tier: they will be able to
              disable administrators and promote or downgrade other super admins.
            </p>
            <p>
              Grant sparingly — every super admin can reshape the admin team. Their
              regular admin access is unchanged otherwise.
            </p>
          </>
        }
        confirmLabel="Make Super Admin"
        confirmingLabel="Promoting..."
        pending={promoteAdminMutation.isPending}
        onConfirm={handlePromoteAdmin}
      />

      <ConfirmActionDialog
        open={dialogOpen && dialogAction === 'demote-admin'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Downgrade to Admin"
        description={`Downgrade ${selectedUser?.fullName} to a regular admin? They keep full admin access but lose the elevated actions (disabling admins, managing super admins).`}
        tone="neutral"
        message={
          <>
            <p>
              <b>{selectedUser?.email}</b> loses the elevated actions (disabling admins,
              managing super admins) but keeps full regular administrator access.
            </p>
            <p>
              The system always keeps at least one super admin — the last remaining one
              cannot be downgraded.
            </p>
          </>
        }
        confirmLabel="Downgrade to Admin"
        confirmingLabel="Downgrading..."
        pending={demoteAdminMutation.isPending}
        onConfirm={handleDemoteAdmin}
      />

      {/* Invite Admin Dialog */}
      <Dialog open={inviteAdminDialogOpen} onOpenChange={setInviteAdminDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Invite Admin
            </DialogTitle>
            <DialogDescription>
              Invite a new administrator. They will receive an email with a
              single-use link to set their own password — you never handle or
              share a password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={inviteAdminForm.handleSubmit(handleInviteAdmin)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="md:col-span-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  {...inviteAdminForm.register('fullName')}
                  placeholder="John Doe"
                  className="mt-1.5 rounded-xl"
                />
                {inviteAdminForm.formState.errors.fullName && (
                  <p className="text-xs text-rose-500 mt-1">
                    {inviteAdminForm.formState.errors.fullName.message}
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
                  {...inviteAdminForm.register('email')}
                  type="email"
                  placeholder="admin@example.com"
                  className="mt-1.5 rounded-xl"
                />
                {inviteAdminForm.formState.errors.email && (
                  <p className="text-xs text-rose-500 mt-1">
                    {inviteAdminForm.formState.errors.email.message}
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
                  {...inviteAdminForm.register('phone')}
                  placeholder="+1 555 123 4567"
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <Shield className="w-4 h-4 inline mr-1" />
                This person will have full administrative access to the platform.
                The setup link expires in 48 hours and can be resent anytime.
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInviteAdminDialogOpen(false);
                  inviteAdminForm.reset();
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20"
                disabled={inviteAdminMutation.isPending}
              >
                {inviteAdminMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Sending Invite...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Send Invite
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
