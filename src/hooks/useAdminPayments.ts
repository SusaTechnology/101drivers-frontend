// Hooks for admin payments API
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery';
import type { 
  AdminPaymentsResponse, 
  AdminPaymentsQueryParams,
  MarkInvoicedRequest,
  MarkInvoicedResponse,
  MarkPaidRequest,
  MarkPaidResponse,
  MarkPayoutPaidRequest,
  MarkPayoutPaidResponse,
} from '@/types/payment';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build query string from params
 */
function buildQueryString(params: AdminPaymentsQueryParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.status) searchParams.set('status', params.status);
  if (params.paymentType) searchParams.set('paymentType', params.paymentType);
  if (params.provider) searchParams.set('provider', params.provider);
  if (params.customerId) searchParams.set('customerId', params.customerId);
  if (params.deliveryId) searchParams.set('deliveryId', params.deliveryId);
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.invoicedOnly) searchParams.set('invoicedOnly', 'true');
  if (params.unpaidOnly) searchParams.set('unpaidOnly', 'true');
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Hook for fetching admin payments list
 */
export function useAdminPayments(params: AdminPaymentsQueryParams = {}) {
  const queryString = buildQueryString(params);
  
  // Use a stable key by serializing params
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<AdminPaymentsResponse>({
    apiEndPoint: `${API_BASE_URL}/api/payments/admin${queryString}`,
    noFilter: true,
    staleTime: 30 * 1000, // 30 seconds
    queryKey: ['admin-payments', paramsKey],
  });
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toFixed(2)}`;
}

/**
 * Format date for display
 */
export function formatPaymentDate(dateString: string | null | undefined): string {
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
  return formatPaymentDate(dateString);
}

/**
 * Get status color classes
 */
export function getPaymentStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'PAID':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'INVOICED':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
      };
    case 'AUTHORIZED':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-200 dark:border-indigo-800',
      };
    case 'CAPTURED':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
      };
    case 'VOIDED':
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-300 dark:border-slate-700',
      };
    case 'REFUNDED':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
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
 * Get payment type label
 */
export function getPaymentTypeLabel(type: string): string {
  switch (type) {
    case 'POSTPAID':
      return 'Postpaid';
    case 'PREPAID':
      return 'Prepaid';
    default:
      return type;
  }
}

/**
 * Get provider label
 */
export function getProviderLabel(provider: string): string {
  switch (provider) {
    case 'MANUAL':
      return 'Manual';
    case 'STRIPE':
      return 'Stripe';
    default:
      return provider;
  }
}

// ==================== ACTION MUTATION HOOKS ====================

/**
 * Hook for marking a payment as invoiced
 */
export function useMarkInvoiced(paymentId: string) {
  return useDataMutation<MarkInvoicedResponse, MarkInvoicedRequest>({
    apiEndPoint: `${API_BASE_URL}/api/payments/${paymentId}/mark-invoiced`,
    method: 'POST',
    successMessage: 'Payment marked as invoiced',
    invalidateQueryKey: [
      ['admin-payments'],
    ],
  });
}

/**
 * Hook for marking a payment as paid
 */
export function useMarkPaid(paymentId: string) {
  return useDataMutation<MarkPaidResponse, MarkPaidRequest>({
    apiEndPoint: `${API_BASE_URL}/api/payments/${paymentId}/mark-paid`,
    method: 'POST',
    successMessage: 'Payment marked as paid',
    invalidateQueryKey: [
      ['admin-payments'],
    ],
  });
}

/**
 * Hook for marking payout as paid
 */
export function useMarkPayoutPaid(paymentId: string) {
  return useDataMutation<MarkPayoutPaidResponse, MarkPayoutPaidRequest>({
    apiEndPoint: `${API_BASE_URL}/api/payments/${paymentId}/mark-payout-paid`,
    method: 'POST',
    successMessage: 'Payout marked as paid',
    invalidateQueryKey: [
      ['admin-payments'],
    ],
  });
}

/**
 * Combined hook that provides all payment action mutations
 */
export function usePaymentActions(paymentId: string, options?: {
  onSuccess?: (action: string) => void;
  onError?: (action: string, error: Error) => void;
}) {
  const markInvoiced = useMarkInvoiced(paymentId);
  const markPaid = useMarkPaid(paymentId);
  const markPayoutPaid = useMarkPayoutPaid(paymentId);

  return {
    markInvoiced: {
      mutate: markInvoiced.mutate,
      mutateAsync: markInvoiced.mutateAsync,
      isPending: markInvoiced.isPending,
      isError: markInvoiced.isError,
      error: markInvoiced.error,
      reset: markInvoiced.reset,
    },
    markPaid: {
      mutate: markPaid.mutate,
      mutateAsync: markPaid.mutateAsync,
      isPending: markPaid.isPending,
      isError: markPaid.isError,
      error: markPaid.error,
      reset: markPaid.reset,
    },
    markPayoutPaid: {
      mutate: markPayoutPaid.mutate,
      mutateAsync: markPayoutPaid.mutateAsync,
      isPending: markPayoutPaid.isPending,
      isError: markPayoutPaid.isError,
      error: markPayoutPaid.error,
      reset: markPayoutPaid.reset,
    },
    // Track if any action is in progress
    isAnyPending: 
      markInvoiced.isPending || 
      markPaid.isPending || 
      markPayoutPaid.isPending,
  };
}
