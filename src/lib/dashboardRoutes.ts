// lib/dashboardRoutes.ts
// Maps API action targets to actual TanStack Router routes

import type { AdminDashboardAction } from '@/types/dashboard';

export const TARGET_ROUTE_MAP: Record<string, string> = {
  deliveries: '/admin-deliveries',
  drivers: '/admin-users',
  customers: '/admin-users',
  disputes: '/admin-disputes',
  payments: '/admin-payments',
  payouts: '/admin-payments',
  pricing: '/admin-pricing-config',
  'scheduling-policy': '/admin-scheduling-policy',
  'insurance-reporting': '/admin-insurance-reporting',
  reports: '/admin-reports',
  config: '/admin-config',
  users: '/admin-users',
};

/**
 * Converts API action target to actual route path
 * @param target - The target from API (e.g., "deliveries", "drivers")
 * @returns The actual route path (e.g., "/admin-deliveries")
 */
export function getRouteFromTarget(target: string): string {
  return TARGET_ROUTE_MAP[target] || `/${target}`;
}

/**
 * Gets route with optional filter params for navigation
 */
export function getNavigationPath(
  target: string,
  filters?: Record<string, unknown> | null
): {
  to: string;
  search?: Record<string, unknown>;
} {
  const to = getRouteFromTarget(target);

  // Convert filters to search params format
  // Note: TanStack Router expects search params in a specific format
  const search = filters && Object.keys(filters).length > 0 ? filters : undefined;

  return { to, search };
}

/**
 * Resolves a dashboard action to navigation props
 * Returns an object with `to` and `search` for TanStack Router Link
 */
export function resolveAction(action: AdminDashboardAction | null | undefined): {
  to: string;
  search?: Record<string, unknown>;
} | null {
  if (!action || action.type !== 'NAVIGATE') {
    return null;
  }

  return getNavigationPath(action.target, action.filters);
}

/**
 * Get filter query string from filters object
 */
export function getFilterQueryString(filters?: Record<string, unknown> | null): string {
  if (!filters || Object.keys(filters).length === 0) {
    return '';
  }

  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach(item => params.append(key, String(item)));
    } else if (typeof value === 'boolean') {
      params.set(key, String(value));
    } else if (typeof value === 'object') {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================
// Deep-link readers — the landing side of the filters above.
//
// Dashboard urgent tiles (NeedsAttention / AlertsStrip) navigate to the
// admin lists WITH the same filter objects serialized into the URL
// (e.g. /admin-users?roles=BUSINESS_CUSTOMER&customerApprovalStatus=PENDING).
// The list pages call these helpers to turn those params back into their
// own filter state, so tapping "2 urgent" lands on exactly those 2 rows
// instead of the unfiltered list.
//
// TanStack Router's serializer round-trips arrays and nested objects as
// JSON (statuses=["ACTIVE"], status={"in":[...]}), while a hand-typed or
// shared URL carries plain strings — the readers accept every shape.
// ============================================================

/**
 * First usable value from a URL search param. Accepts a plain string
 * ("ACTIVE"), a comma-separated string ("OPEN,UNDER_REVIEW"), or the
 * router-parsed array form (["ACTIVE"]) — and returns the first token,
 * which is all the single-select dropdowns on the list pages need.
 */
export function firstUrlParamValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const first = value.split(',')[0].trim();
    return first || undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const v = firstUrlParamValue(item);
      if (v) return v;
    }
  }
  return undefined;
}

/**
 * URL truthiness for boolean deep-link flags ("?complianceMissing=true").
 * The dashboard serializes booleans as "true"/"false" strings; only an
 * explicit true counts — absent, "false", or anything else means off.
 */
export function isTrueParam(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (Array.isArray(value)) return value.some(isTrueParam);
  return false;
}

/**
 * Get status badge color class
 */
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Delivery statuses
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    QUOTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    LISTED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    BOOKED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    EXPIRED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    DISPUTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    
    // Approval statuses
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    SUSPENDED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    
    // Tracking statuses
    STARTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    STOPPED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    
    // Payment statuses
    AUTHORIZED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    CAPTURED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    REFUNDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    
    // Dispute statuses
    OPEN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    UNDER_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    CLOSED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    
    // Alert severities
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return statusColors[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
}

/**
 * Get severity styling for alerts
 */
export function getSeverityStyle(severity: 'CRITICAL' | 'WARNING'): {
  icon: string;
  bg: string;
  border: string;
  text: string;
} {
  return severity === 'CRITICAL'
    ? {
        icon: 'text-red-500',
        bg: 'bg-red-50 dark:bg-red-900/10',
        border: 'border-red-200 dark:border-red-900/30',
        text: 'text-red-700 dark:text-red-300',
      }
    : {
        icon: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-900/10',
        border: 'border-amber-200 dark:border-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
      };
}

/**
 * Get issue type priority level
 */
export function getIssuePriority(issueType: string): 'high' | 'medium' | 'low' {
  const highPriority = ['PAYMENT_FAILED', 'ACTIVE_WITHOUT_TRACKING', 'OPEN_DISPUTE', 'STALE_TRACKING'];
  const mediumPriority = [
    'DELIVERY_COMPLIANCE_MISSING',
    'LISTED_WITHOUT_ASSIGNMENT',
    'OPS_CONFIRMATION_REQUIRED',
    'PAYOUT_ELIGIBLE',
  ];
  
  if (highPriority.includes(issueType)) return 'high';
  if (mediumPriority.includes(issueType)) return 'medium';
  return 'low';
}
