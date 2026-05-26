// Hooks for admin deliveries API
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery';
import type { 
  AdminDeliveriesResponse, 
  AdminDeliveryDetail,
  AdminDeliveriesQueryParams,
  AssignDriverRequest,
  AssignDriverResponse,
  ApproveComplianceRequest,
  ApproveComplianceResponse,
  ForceCancelRequest,
  ForceCancelResponse,
  LegalHoldRequest,
  LegalHoldResponse,
  OpenDisputeRequest,
  OpenDisputeResponse,
  DriverLookupItem,
  DeliveryLookupItem,
  UserLookupItem,
} from '@/types/delivery';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build query string from params
 */
function buildQueryString(params: AdminDeliveriesQueryParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.status) searchParams.set('status', params.status);
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.customerId) searchParams.set('customerId', params.customerId);
  if (params.customerType) searchParams.set('customerType', params.customerType);
  if (params.serviceType) searchParams.set('serviceType', params.serviceType);
  if (params.urgentOnly) searchParams.set('urgentOnly', 'true');
  if (params.disputedOnly) searchParams.set('disputedOnly', 'true');
  if (params.requiresOpsConfirmation) searchParams.set('requiresOpsConfirmation', 'true');
  if (params.withoutAssignment) searchParams.set('withoutAssignment', 'true');
  if (params.complianceMissing) searchParams.set('complianceMissing', 'true');
  if (params.activeWithoutTracking) searchParams.set('activeWithoutTracking', 'true');
  if (params.staleTracking) searchParams.set('staleTracking', 'true');
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.search) searchParams.set('search', params.search);
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Hook for fetching admin deliveries list
 */
export function useAdminDeliveries(params: AdminDeliveriesQueryParams = {}) {
  const queryString = buildQueryString(params);
  
  // Use a stable key by serializing params
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<AdminDeliveriesResponse>({
    apiEndPoint: `${API_BASE_URL}/api/deliveryRequests/admin${queryString}`,
    noFilter: true,
    staleTime: 30 * 1000, // 30 seconds
    queryKey: ['admin-deliveries', paramsKey],
  });
}

/**
 * Hook for fetching single delivery details
 */
export function useAdminDeliveryDetail(deliveryId: string | undefined) {
  return useDataQuery<AdminDeliveryDetail>({
    apiEndPoint: deliveryId 
      ? `${API_BASE_URL}/api/deliveryRequests/${deliveryId}/admin`
      : '',
    noFilter: true,
    enabled: !!deliveryId,
    staleTime: 60 * 1000, // 1 minute
    queryKey: ['admin-delivery-detail', deliveryId],
  });
}

/**
 * Hook for fetching driver lookup list (minimal)
 */
export function useDriverLookup() {
  return useDataQuery<DriverLookupItem[]>({
    apiEndPoint: `${API_BASE_URL}/api/drivers/lookup/minimal`,
    noFilter: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching delivery lookup list (minimal)
 */
export function useDeliveryLookup(options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options || {}; // 5 minutes

  return useDataQuery<DeliveryLookupItem[]>({
    apiEndPoint: `${API_BASE_URL}/api/deliveryRequests/lookup/minimal`,
    enabled,
    noFilter: true,
    staleTime,
  });
}

/**
 * Hook for fetching user lookup list (minimal)
 */
export function useUserLookup(options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options || {}; // 5 minutes

  return useDataQuery<UserLookupItem[]>({
    apiEndPoint: `${API_BASE_URL}/api/users/lookup/minimal`,
    enabled,
    noFilter: true,
    staleTime,
  });
}

/**
 * Format date for display
 */
export function formatDeliveryDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDeliveryDate(dateString);
}

/**
 * Get status color classes
 */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'ACTIVE':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-900/10',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
      };
    case 'BOOKED':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/10',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
      };
    case 'QUOTED':
      return {
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
      };
    case 'LISTED':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-900/10',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-200 dark:border-indigo-800',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-green-50 dark:bg-green-900/10',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'CANCELLED':
      return {
        bg: 'bg-slate-50 dark:bg-slate-900/50',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-300 dark:border-slate-700',
      };
    case 'DISPUTED':
      return {
        bg: 'bg-rose-50 dark:bg-rose-900/10',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800',
      };
    case 'EXPIRED':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/10',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
      };
  }
}

/**
 * Get service type display name
 */
export function getServiceTypeLabel(serviceType: string): string {
  switch (serviceType) {
    case 'HOME_DELIVERY':
      return 'Home Delivery';
    case 'BETWEEN_LOCATIONS':
      return 'Between Locations';
    case 'SERVICE_PICKUP_RETURN':
      return 'Service Pickup/Return';
    default:
      return serviceType;
  }
}

/**
 * Get tracking status label
 */
export function getTrackingStatusLabel(status: string): string {
  switch (status) {
    case 'NOT_STARTED':
      return 'Not Started';
    case 'STARTED':
      return 'In Progress';
    case 'STOPPED':
      return 'Completed';
    default:
      return status;
  }
}

/**
 * Format miles driven
 */
export function formatMiles(miles: number | null | undefined): string {
  if (miles === null || miles === undefined) return '—';
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toFixed(2)}`;
}

// ==================== ACTION MUTATION HOOKS ====================

/**
 * Hook for assigning a driver to a delivery
 */
export function useAssignDriver(deliveryId: string) {
  return useDataMutation<AssignDriverResponse, AssignDriverRequest>({
    apiEndPoint: `${API_BASE_URL}/api/deliveryRequests/${deliveryId}/assign-driver`,
    method: 'POST',
    successMessage: 'Driver assigned successfully',
    invalidateQueryKey: [
      ['admin-deliveries'],
      ['admin-delivery-detail', deliveryId],
    ],
  });
}

/**
 * Hook for approving compliance on a delivery
 */
export function useApproveCompliance(deliveryId: string) {
  return useDataMutation<ApproveComplianceResponse, ApproveComplianceRequest>({
    apiEndPoint: `${API_BASE_URL}/api/deliveryRequests/${deliveryId}/approve-compliance`,
    method: 'POST',
    successMessage: 'Compliance approved successfully',
    invalidateQueryKey: [
      ['admin-deliveries'],
      ['admin-delivery-detail', deliveryId],
    ],
  });
}

/**
 * Hook for force-cancelling a delivery
 */
export function useForceCancel(deliveryId: string) {
  return useDataMutation<ForceCancelResponse, ForceCancelRequest>({
    apiEndPoint: `${API_BASE_URL}/api/deliveryRequests/${deliveryId}/force-cancel`,
    method: 'POST',
    successMessage: 'Delivery cancelled successfully',
    invalidateQueryKey: [
      ['admin-deliveries'],
      ['admin-delivery-detail', deliveryId],
    ],
  });
}

/**
 * Hook for applying/removing legal hold on a delivery
 */
export function useLegalHold(deliveryId: string) {
  return useDataMutation<LegalHoldResponse, LegalHoldRequest>({
    apiEndPoint: `${API_BASE_URL}/api/deliveryRequests/${deliveryId}/legal-hold`,
    method: 'POST',
    successMessage: 'Legal hold updated successfully',
    invalidateQueryKey: [
      ['admin-deliveries'],
      ['admin-delivery-detail', deliveryId],
    ],
  });
}

/**
 * Hook for opening a dispute on a delivery
 */
export function useOpenDispute(deliveryId: string) {
  return useDataMutation<OpenDisputeResponse, OpenDisputeRequest>({
    apiEndPoint: `${API_BASE_URL}/api/deliveryRequests/${deliveryId}/open-dispute`,
    method: 'POST',
    successMessage: 'Dispute opened successfully',
    invalidateQueryKey: [
      ['admin-deliveries'],
      ['admin-delivery-detail', deliveryId],
    ],
  });
}

/**
 * Combined hook that provides all delivery action mutations
 */
export function useDeliveryActions(deliveryId: string, options?: {
  onSuccess?: (action: string) => void;
  onError?: (action: string, error: Error) => void;
}) {
  const assignDriver = useAssignDriver(deliveryId);
  const approveCompliance = useApproveCompliance(deliveryId);
  const forceCancel = useForceCancel(deliveryId);
  const legalHold = useLegalHold(deliveryId);
  const openDispute = useOpenDispute(deliveryId);

  return {
    assignDriver: {
      mutate: assignDriver.mutate,
      mutateAsync: assignDriver.mutateAsync,
      isPending: assignDriver.isPending,
      isError: assignDriver.isError,
      error: assignDriver.error,
      reset: assignDriver.reset,
    },
    approveCompliance: {
      mutate: approveCompliance.mutate,
      mutateAsync: approveCompliance.mutateAsync,
      isPending: approveCompliance.isPending,
      isError: approveCompliance.isError,
      error: approveCompliance.error,
      reset: approveCompliance.reset,
    },
    forceCancel: {
      mutate: forceCancel.mutate,
      mutateAsync: forceCancel.mutateAsync,
      isPending: forceCancel.isPending,
      isError: forceCancel.isError,
      error: forceCancel.error,
      reset: forceCancel.reset,
    },
    legalHold: {
      mutate: legalHold.mutate,
      mutateAsync: legalHold.mutateAsync,
      isPending: legalHold.isPending,
      isError: legalHold.isError,
      error: legalHold.error,
      reset: legalHold.reset,
    },
    openDispute: {
      mutate: openDispute.mutate,
      mutateAsync: openDispute.mutateAsync,
      isPending: openDispute.isPending,
      isError: openDispute.isError,
      error: openDispute.error,
      reset: openDispute.reset,
    },
    // Track if any action is in progress
    isAnyPending: 
      assignDriver.isPending || 
      approveCompliance.isPending || 
      forceCancel.isPending || 
      legalHold.isPending ||
      openDispute.isPending,
  };
}
