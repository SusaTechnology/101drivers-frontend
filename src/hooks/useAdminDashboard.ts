// hooks/useAdminDashboard.ts
import { useDataQuery } from '@/lib/tanstack/dataQuery';
import type {
  AdminDashboardOverview,
  DashboardQueryParams,
  DeliveryStatus,
  CustomerType,
  ServiceType,
  DatePreset,
  CustomerLookupItem,
} from '@/types/dashboard';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build query string from filter params
 */
function buildQueryString(params: DashboardQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.datePreset) searchParams.set('datePreset', params.datePreset);
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.customerId) searchParams.set('customerId', params.customerId);
  if (params.customerType) searchParams.set('customerType', params.customerType);
  if (params.createdByRole) searchParams.set('createdByRole', params.createdByRole);
  if (params.serviceType) searchParams.set('serviceType', params.serviceType);
  if (params.requiresOpsConfirmation !== undefined) {
    searchParams.set('requiresOpsConfirmation', String(params.requiresOpsConfirmation));
  }
  if (params.urgentOnly !== undefined) {
    searchParams.set('urgentOnly', String(params.urgentOnly));
  }
  if (params.disputedOnly !== undefined) {
    searchParams.set('disputedOnly', String(params.disputedOnly));
  }
  if (params.statuses && params.statuses.length > 0) {
    params.statuses.forEach(status => searchParams.append('statuses', status));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Hook to fetch admin dashboard overview data
 * @param params - Optional filter parameters
 * @param options - Additional query options
 */
export function useAdminDashboard(
  params?: DashboardQueryParams,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
    staleTime?: number;
  }
) {
  const { enabled = true, refetchInterval, staleTime = 30 * 1000 } = options || {};

  const queryString = params ? buildQueryString(params) : '';
  const endpoint = `${API_BASE_URL}/api/adminDashboard/overview${queryString}`;

  return useDataQuery<AdminDashboardOverview>({
    apiEndPoint: endpoint,
    enabled,
    noFilter: true,
    refetchInterval,
    staleTime,
  });
}

/**
 * Hook to fetch dashboard data with date range
 */
export function useAdminDashboardWithDateRange(
  from: Date | null,
  to: Date | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  const params: DashboardQueryParams = {};

  if (from) {
    params.from = from.toISOString();
  }
  if (to) {
    params.to = to.toISOString();
  }

  return useAdminDashboard(params, options);
}

/**
 * Hook to fetch dashboard data filtered by status
 */
export function useAdminDashboardByStatus(
  statuses: DeliveryStatus[],
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useAdminDashboard({ statuses }, options);
}

/**
 * Hook to fetch dashboard data with date preset
 */
export function useAdminDashboardWithPreset(
  preset: DatePreset,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useAdminDashboard({ datePreset: preset }, options);
}

/**
 * Hook to fetch dashboard data for urgent deliveries
 */
export function useAdminDashboardUrgent(
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useAdminDashboard({ urgentOnly: true }, options);
}

/**
 * Hook to fetch dashboard data for disputed deliveries
 */
export function useAdminDashboardDisputed(
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useAdminDashboard({ disputedOnly: true }, options);
}

/**
 * Get default date range for presets
 */
export function getDateRangeForPreset(preset: DatePreset): { from: Date; to: Date } | null {
  const now = new Date();

  switch (preset) {
    case 'TODAY':
      return {
        from: new Date(now.setHours(0, 0, 0, 0)),
        to: new Date(now.setHours(23, 59, 59, 999)),
      };
    case 'LAST_7_DAYS':
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return {
        from: sevenDaysAgo,
        to: new Date(),
      };
    case 'LAST_30_DAYS':
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        from: thirtyDaysAgo,
        to: new Date(),
      };
    case 'THIS_MONTH':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case 'CUSTOM':
    default:
      return null;
  }
}

/**
 * Format date for display
 */
export function formatDashboardDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format datetime for display
 */
export function formatDashboardDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format currency for display
 */
export function formatDashboardCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format miles for display
 */
export function formatDashboardMiles(miles: number | null | undefined, decimals: number = 1): string {
  if (miles === null || miles === undefined) return '0 mi';
  return `${miles.toFixed(decimals)} mi`;
}

/**
 * Format percentage for display
 */
export function formatDashboardPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Hook to fetch customer lookup list for filters
 */
export function useCustomerLookup(options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options || {}; // 5 minutes stale time

  return useDataQuery<CustomerLookupItem[]>({
    apiEndPoint: `${API_BASE_URL}/customers/lookup/minimal`,
    enabled,
    noFilter: true,
    staleTime,
  });
}
