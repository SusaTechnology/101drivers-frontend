// lib/dashboardRoutes.ts
// Maps API action targets to actual TanStack Router routes

export const TARGET_ROUTE_MAP: Record<string, string> = {
  deliveries: '/admin-deliveries',
  drivers: '/admin-users',
  customers: '/admin-users',
  disputes: '/admin-disputes',
  payments: '/admin-payments',
  payouts: '/admin-payments',
  pricing: '/admin-pricing',
  'scheduling-policy': '/admin-scheduling-policy',
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
export function getNavigationPath(target: string, filters?: Record<string, any>): {
  to: string;
  search?: Record<string, any>;
} {
  const to = getRouteFromTarget(target);

  // Convert filters to search params format
  // Note: TanStack Router expects search params in a specific format
  const search = filters && Object.keys(filters).length > 0 ? filters : undefined;

  return { to, search };
}
