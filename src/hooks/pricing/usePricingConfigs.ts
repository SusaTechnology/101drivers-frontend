// hooks/pricing/usePricingConfigs.ts
import { useDataMutation, useDataQuery, getUser } from '@/lib/tanstack/dataQuery';
import type {
  PricingConfig,
  PricingConfigPayload,
  PricingConfigFormData,
  PricingConfigListResponse,
  PricingConfigResponse,
} from '@/types/pricing';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Transform form data to API payload
function transformToPayload(data: PricingConfigFormData): PricingConfigPayload {
  const user = getUser();
  const actorUserId = user?.id || 'admin_user';

  return {
    id: data.id || null,
    name: data.name,
    description: data.description || '',
    pricingMode: data.pricingMode,
    baseFee: data.baseFee,
    perMileRate: data.pricingMode === 'PER_MILE' ? data.perMileRate : null,
    insuranceFee: data.insuranceFee,
    transactionFeePct: data.transactionFeePct,
    transactionFeeFixed: data.transactionFeeFixed,
    feePassThrough: data.feePassThrough,
    driverSharePct: data.driverSharePct,
    active: data.active,
    activateAsDefault: data.activateAsDefault,
    tiers: data.pricingMode === 'FLAT_TIER' ? data.tiers : [],
    categoryRules: data.pricingMode === 'CATEGORY_ABC' ? data.categoryRules : [],
    actorUserId,
  };
}

// Hook to fetch all pricing configs
export function usePricingConfigs(options?: {
  pagination?: { pageIndex: number; pageSize: number };
  globalFilter?: string;
  enabled?: boolean;
}) {
  const { pagination = { pageIndex: 0, pageSize: 20 }, globalFilter = '', enabled = true } = options || {};

  return useDataQuery<PricingConfigListResponse>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs`,
    pagination,
    globalFilter,
    enabled,
    noFilter: false,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook to fetch a single pricing config by ID
export function usePricingConfig(id: string | undefined, enabled = true) {
  return useDataQuery<PricingConfigResponse>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/${id}`,
    enabled: !!id && enabled,
    noFilter: true,
  });
}

// Hook to save (create or update) a pricing config
export function useSavePricingConfig(options?: {
  onSuccess?: (data: PricingConfigResponse) => void;
  onError?: (error: unknown) => void;
}) {
  return useDataMutation<PricingConfigResponse, PricingConfigPayload>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/admin-save`,
    method: 'POST',
    successMessage: 'Pricing configuration saved successfully',
    errorMessage: 'Failed to save pricing configuration',
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

// Hook to delete a pricing config
export function useDeletePricingConfig(options?: {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}) {
  return useDataMutation<{ success: boolean; message: string }, { id: string }>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/:id`,
    method: 'DELETE',
    successMessage: 'Pricing configuration deleted successfully',
    errorMessage: 'Failed to delete pricing configuration',
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

// Hook to toggle pricing config active status
export function useTogglePricingConfigStatus(options?: {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}) {
  return useDataMutation<PricingConfigResponse, { id: string; active: boolean; actorUserId: string }>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/:id/status`,
    method: 'PATCH',
    successMessage: 'Pricing configuration status updated',
    errorMessage: 'Failed to update status',
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

// Hook to set a pricing config as default
export function useSetDefaultPricingConfig(options?: {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}) {
  return useDataMutation<PricingConfigResponse, { id: string; actorUserId: string }>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/:id/set-default`,
    method: 'PATCH',
    successMessage: 'Pricing configuration set as default',
    errorMessage: 'Failed to set as default',
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

// Export transform function for direct use
export { transformToPayload };
