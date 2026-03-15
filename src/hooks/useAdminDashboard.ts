// hooks/useAdminDashboard.ts
import { useDataQuery } from '@/lib/tanstack/dataQuery';
import type { AdminDashboardOverview, DashboardQueryParams } from '@/types/dashboard';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build query string from filter params
 */
function buildQueryString(params: DashboardQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.datePreset) searchParams.set('datePreset', params.datePreset);
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
  const { enabled = true, refetchInterval, staleTime = 60 * 1000 } = options || {};

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
  statuses: string[],
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useAdminDashboard({ statuses }, options);
}
