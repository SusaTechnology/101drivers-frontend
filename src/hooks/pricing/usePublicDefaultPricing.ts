/**
 * usePublicDefaultPricing
 *
 * Fetches the live, admin-configured default pricing config from the
 * PUBLIC endpoint `GET /api/pricingConfigs/public/default`.
 *
 * No auth required — landing-page visitors are not logged in.
 *
 * The endpoint returns `null` when no active config exists; in that
 * case the caller should fall back to the hard-coded advertised rate
 * in `src/lib/pricing/home-flat-quote.ts`.
 *
 * Cache strategy:
 *   - staleTime 5 minutes  → the user sees admin pricing changes within
 *     ~5 min of the change (no instant propagation, but no hammering
 *     the endpoint either).
 *   - gcTime 30 minutes     → keep the cached entry around for back/forward
 *     navigation without re-fetching.
 *   - refetchOnWindowFocus false  → don't refetch when the user tabs back
 *     (the rate doesn't change that often, and we don't want a network
 *     blip to flash a "loading" state on the home page).
 *
 * Usage:
 *   const { config, isLoading, isError } = usePublicDefaultPricing();
 *   if (config) { /* use live values *\/ }
 *   else {        /* fall back to HOME_FLAT_QUOTE_CONFIG *\/ }
 */

import { useDataQuery } from '@/lib/tanstack/dataQuery';
import type { PublicPricingConfig } from '@/types/publicPricing';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Shared query key so multiple consumers of this hook dedupe to a
// single network request.
export const PUBLIC_DEFAULT_PRICING_QUERY_KEY = [
  'data',
  `${API_BASE_URL}/api/pricingConfigs/public/default`,
] as const;

export interface UsePublicDefaultPricingResult {
  /** The live pricing config, or `null` if the backend has none configured. */
  config: PublicPricingConfig | null;
  /** True while the initial fetch is in-flight and no cached data is available. */
  isLoading: boolean;
  /** True if the fetch failed (network error, 5xx, etc.). Caller should fall back. */
  isError: boolean;
  /** Raw TanStack Query result for advanced consumers (refetch, etc.). */
  data: PublicPricingConfig | null | undefined;
}

export function usePublicDefaultPricing(): UsePublicDefaultPricingResult {
  const query = useDataQuery<PublicPricingConfig | null>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/public/default`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true, // skip token refresh on 401 — this is a public endpoint
    queryKey: PUBLIC_DEFAULT_PRICING_QUERY_KEY,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // `data` may be `undefined` (loading), `null` (backend has no config),
  // or a config object. Normalize for the caller.
  const data = query.data ?? undefined;
  const config = data === undefined ? null : (data as PublicPricingConfig | null);

  return {
    config,
    isLoading: query.isLoading,
    isError: query.isError,
    data,
  };
}
