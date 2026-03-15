// hooks/pricing/usePricingConfigs.ts
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery';
import type {
  PricingConfig,
  PricingConfigFormData,
  PricingConfigListResponse,
  PricingConfigResponse,
} from '@/types/pricing';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Hook to fetch all pricing configs
export function usePricingConfigs(options?: {
  page?: number;
  limit?: number;
  search?: string;
  enabled?: boolean;
}) {
  const { page = 1, limit = 10, search = '', enabled = true } = options || {};

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) {
    queryParams.set('search', search);
  }

  return useDataQuery<PricingConfigListResponse>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs?${queryParams.toString()}`,
    enabled,
    noFilter: true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook to fetch a single pricing config by ID
export function usePricingConfig(id: string | undefined, enabled = true) {
  return useDataQuery<PricingConfigResponse>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/${id}`,
    enabled: !!id && enabled,
    noFilter: true,
    queryKey: ['pricingConfig', id],
  });
}

// Hook to save (create or update) a pricing config
export function useSavePricingConfig(options?: {
  onSuccess?: (data: PricingConfigResponse) => void;
  onError?: (error: Error) => void;
}) {
  return useDataMutation<PricingConfigResponse, PricingConfigFormData>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/admin-save`,
    method: 'POST',
    successMessage: 'Pricing configuration saved successfully',
    invalidateQueryKey: [['pricingConfigs'], ['data', `${API_BASE_URL}/api/pricingConfigs`]],
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

// Hook to delete a pricing config
export function useDeletePricingConfig(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useDataMutation<{ success: boolean }, { id: string }>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/:id`,
    method: 'DELETE',
    successMessage: 'Pricing configuration deleted successfully',
    invalidateQueryKey: [['pricingConfigs']],
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

// Hook to toggle pricing config active status
export function useTogglePricingConfigStatus(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useDataMutation<PricingConfigResponse, { id: string; isActive: boolean }>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/:id/toggle-status`,
    method: 'PATCH',
    successMessage: 'Pricing configuration status updated',
    invalidateQueryKey: [['pricingConfigs']],
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}
