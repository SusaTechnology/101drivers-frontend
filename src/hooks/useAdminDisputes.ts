// Hooks for admin disputes API
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery';
import type {
  AdminDisputesResponse,
  AdminDisputesQueryParams,
  OpenDisputeRequest,
  OpenDisputeResponse,
  AddDisputeNoteRequest,
  AddDisputeNoteResponse,
  ChangeDisputeStatusRequest,
  ChangeDisputeStatusResponse,
  ResolveDisputeRequest,
  ResolveDisputeResponse,
  CloseDisputeRequest,
  CloseDisputeResponse,
  DisputeLegalHoldRequest,
  DisputeLegalHoldResponse,
  DisputeStatus,
} from '@/types/dispute';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build query string from params
 */
function buildQueryString(params: AdminDisputesQueryParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.status) {
    searchParams.set('status', params.status);
  }
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Hook for fetching admin disputes list
 */
export function useAdminDisputes(params: AdminDisputesQueryParams = {}) {
  const queryString = buildQueryString(params);
  
  // Use a stable key by serializing params
  const paramsKey = JSON.stringify(params);
  
  return useDataQuery<AdminDisputesResponse>({
    apiEndPoint: `${API_BASE_URL}/api/disputeCases/admin${queryString}`,
    noFilter: true,
    staleTime: 30 * 1000, // 30 seconds
    queryKey: ['admin-disputes', paramsKey],
  });
}

/**
 * Format date for display
 */
export function formatDisputeDate(dateString: string | null | undefined): string {
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
  return formatDisputeDate(dateString);
}

/**
 * Get status color classes
 */
export function getDisputeStatusColor(status: DisputeStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'OPEN':
      return {
        label: 'Open',
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800',
      };
    case 'UNDER_REVIEW':
      return {
        label: 'In Review',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
      };
    case 'RESOLVED':
      return {
        label: 'Resolved',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
      };
    case 'CLOSED':
      return {
        label: 'Closed',
        bg: 'bg-slate-50 dark:bg-slate-900/50',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-700',
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
      };
  }
}

// ==================== ACTION MUTATION HOOKS ====================

/**
 * Hook for opening a new dispute
 */
export function useOpenDispute() {
  return useDataMutation<OpenDisputeResponse, OpenDisputeRequest>({
    apiEndPoint: `${API_BASE_URL}/api/disputeCases/admin/open`,
    method: 'POST',
    successMessage: 'Dispute opened successfully',
    invalidateQueryKey: [
      ['admin-disputes'],
    ],
  });
}

/**
 * Hook for adding a note to a dispute
 */
export function useAddDisputeNote(disputeId: string) {
  return useDataMutation<AddDisputeNoteResponse, AddDisputeNoteRequest>({
    apiEndPoint: `${API_BASE_URL}/api/disputeCases/${disputeId}/admin-note`,
    method: 'POST',
    successMessage: 'Note added successfully',
    invalidateQueryKey: [
      ['admin-disputes'],
    ],
  });
}

/**
 * Hook for changing dispute status
 */
export function useChangeDisputeStatus(disputeId: string) {
  return useDataMutation<ChangeDisputeStatusResponse, ChangeDisputeStatusRequest>({
    apiEndPoint: `${API_BASE_URL}/api/disputeCases/${disputeId}/admin-status`,
    method: 'POST',
    successMessage: 'Status updated successfully',
    invalidateQueryKey: [
      ['admin-disputes'],
    ],
  });
}

/**
 * Hook for resolving a dispute
 */
export function useResolveDispute(disputeId: string) {
  return useDataMutation<ResolveDisputeResponse, ResolveDisputeRequest>({
    apiEndPoint: `${API_BASE_URL}/api/disputeCases/${disputeId}/admin-resolve`,
    method: 'POST',
    successMessage: 'Dispute resolved successfully',
    invalidateQueryKey: [
      ['admin-disputes'],
    ],
  });
}

/**
 * Hook for closing a dispute
 */
export function useCloseDispute(disputeId: string) {
  return useDataMutation<CloseDisputeResponse, CloseDisputeRequest>({
    apiEndPoint: `${API_BASE_URL}/api/disputeCases/${disputeId}/admin-close`,
    method: 'POST',
    successMessage: 'Dispute closed successfully',
    invalidateQueryKey: [
      ['admin-disputes'],
    ],
  });
}

/**
 * Hook for toggling legal hold on a dispute
 */
export function useDisputeLegalHold(disputeId: string) {
  return useDataMutation<DisputeLegalHoldResponse, DisputeLegalHoldRequest>({
    apiEndPoint: `${API_BASE_URL}/api/disputeCases/${disputeId}/admin-legal-hold`,
    method: 'POST',
    successMessage: 'Legal hold updated successfully',
    invalidateQueryKey: [
      ['admin-disputes'],
    ],
  });
}

/**
 * Combined hook that provides all dispute action mutations
 */
export function useDisputeActions(disputeId: string, options?: {
  onSuccess?: (action: string) => void;
  onError?: (action: string, error: Error) => void;
}) {
  const addNote = useAddDisputeNote(disputeId);
  const changeStatus = useChangeDisputeStatus(disputeId);
  const resolve = useResolveDispute(disputeId);
  const close = useCloseDispute(disputeId);
  const legalHold = useDisputeLegalHold(disputeId);

  return {
    addNote: {
      mutate: addNote.mutate,
      mutateAsync: addNote.mutateAsync,
      isPending: addNote.isPending,
      isError: addNote.isError,
      error: addNote.error,
      reset: addNote.reset,
    },
    changeStatus: {
      mutate: changeStatus.mutate,
      mutateAsync: changeStatus.mutateAsync,
      isPending: changeStatus.isPending,
      isError: changeStatus.isError,
      error: changeStatus.error,
      reset: changeStatus.reset,
    },
    resolve: {
      mutate: resolve.mutate,
      mutateAsync: resolve.mutateAsync,
      isPending: resolve.isPending,
      isError: resolve.isError,
      error: resolve.error,
      reset: resolve.reset,
    },
    close: {
      mutate: close.mutate,
      mutateAsync: close.mutateAsync,
      isPending: close.isPending,
      isError: close.isError,
      error: close.error,
      reset: close.reset,
    },
    legalHold: {
      mutate: legalHold.mutate,
      mutateAsync: legalHold.mutateAsync,
      isPending: legalHold.isPending,
      isError: legalHold.isError,
      error: legalHold.error,
      reset: legalHold.reset,
    },
    // Track if any action is in progress
    isAnyPending:
      addNote.isPending ||
      changeStatus.isPending ||
      resolve.isPending ||
      close.isPending ||
      legalHold.isPending,
  };
}
