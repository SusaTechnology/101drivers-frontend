"use client";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

// ==================== TOKEN & USER MANAGEMENT ====================
const ACCESS_TOKEN_KEY = "accessToken";
const USER_KEY = "currentUser";

let currentAccessToken: string | null = null;
let refreshTokenPromise: Promise<string> | null = null;
let lastRefreshAttemptTime: number = 0;
const REFRESH_COOLDOWN_MS = 5000; // 5 seconds cooldown between refresh attempts

// User data (id, username, roles) from login response
let currentUser: {
  id: string;
  username: string;
  fullName?: string | null;
  profileId: string | null;
  roles: string[];
  // Approval status for customers and drivers
  customerApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  driverStatus?: 'PENDING' | 'APPROVED' | 'SUSPENDED';
  // Onboarding status for drivers
  onboardingCompleted?: boolean;
  onboardingToken?: string | null;
  // User active status
  isActive?: boolean;
} | null = null;

export function getAccessToken(): string | null {
  return currentAccessToken ?? localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  currentAccessToken = token;
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getUser() {
  if (!currentUser) {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) currentUser = JSON.parse(stored);
  }
  return currentUser;
}

export function setUser(user: typeof currentUser) {
  currentUser = user;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  currentAccessToken = null;
  currentUser = null;
  refreshTokenPromise = null;
  lastRefreshAttemptTime = 0; // Reset cooldown
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Check if user is currently authenticated
export function isAuthenticated(): boolean {
  return !!(getAccessToken() && getUser());
}

// ==================== PROACTIVE TOKEN REFRESH ====================
// Refresh token every 10 minutes to keep session alive (like WhatsApp)
const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

export function startSessionKeepAlive() {
  // Don't start if already running
  if (refreshIntervalId) return;
  
  // Only start if user is authenticated
  if (!isAuthenticated()) return;
  
  console.log('🔄 Starting session keep-alive...');
  
  refreshIntervalId = setInterval(async () => {
    // Check if still authenticated before refreshing
    if (!isAuthenticated()) {
      stopSessionKeepAlive();
      return;
    }
    
    try {
      console.log('🔄 Proactive token refresh...');
      if (!refreshTokenPromise) {
        refreshTokenPromise = refreshAccessToken();
      }
      await refreshTokenPromise;
      refreshTokenPromise = null;
    } catch (error) {
      console.error('Proactive refresh failed:', error);
      // Don't clear auth on proactive refresh failure
      // The next API call will handle it if needed
      refreshTokenPromise = null;
    }
  }, TOKEN_REFRESH_INTERVAL);
}

export function stopSessionKeepAlive() {
  if (refreshIntervalId) {
    console.log('🛑 Stopping session keep-alive');
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

// Initialize session keep-alive on page load if authenticated
if (typeof window !== 'undefined') {
  // Check on load
  if (isAuthenticated()) {
    startSessionKeepAlive();
  }
  
  // Also refresh token when tab becomes visible (user returns to app)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isAuthenticated()) {
      // Silently refresh token when user comes back to the tab
      refreshAccessToken().catch(() => {
        // Ignore errors - user might need to re-login on next action
      });
    }
  });
}

// ==================== TYPES ====================

export interface QueryParams<T> {
  apiEndPoint: string;
  columnFilters?: Record<string, any>;
  globalFilter?: string;
  sorting?: { id: string; desc: boolean }[];
  pagination?: { pageIndex: number; pageSize: number };
  refetchInterval?: number | false;
  enabled?: boolean;
  noFilter?: boolean;
  fetchWithoutRefresh?: boolean;
  /** If true, skip token refresh on 401. Use for public endpoints. */
  publicEndpoint?: boolean;
  queryKey?: QueryKey;
  select?: (data: any) => T;
  staleTime?: number;
}

export interface MutationParams<TData = any, TVariables = any> {
  apiEndPoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  onSuccessInvalidate?: boolean;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
  getBody?: (variables: TVariables) => BodyInit | null | undefined;
  invalidateQueryKey?: QueryKey[];
  fetchWithoutRefresh?: boolean;
  /** If true, skip all auth logic including token refresh on 401. Use for public endpoints like login. */
  publicEndpoint?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

// ==================== BASE FETCH ====================

async function ensureAuth(): Promise<string | null> {
  let token = getAccessToken();
  const user = getUser();

  if (!token || !user) {
    if (!refreshTokenPromise) {
      refreshTokenPromise = refreshAccessToken();
    }
    token = await refreshTokenPromise;
    refreshTokenPromise = null;
  }

  return token;
}

async function baseFetch<T>(
  url: string,
  options: RequestInit,
  requiresAuth = true,
  skipTokenRefresh = false,
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add authorization if required
  if (requiresAuth) {
    const token = await ensureAuth();
    if (token) {
      if (Array.isArray(headers)) {
        headers.push(["Authorization", `Bearer ${token}`]);
      } else if (headers instanceof Headers) {
        headers.set("Authorization", `Bearer ${token}`);
      } else {
        // @ts-ignore
        headers.Authorization = `Bearer ${token}`;
      }
    }
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
    // Include cookies for auth endpoints (login, refresh-token, logout)
    // These endpoints need to set/read the httpOnly refresh token cookie
    credentials: url.includes('/auth/') ? "include" : "omit" as RequestCredentials,
  };

  try {
    const response = await fetch(url, finalOptions);

    // Handle 401/403 with token refresh ONLY if not a public endpoint
    if ((response.status === 401 || response.status === 403) && !skipTokenRefresh) {
      try {
        if (!refreshTokenPromise) {
          refreshTokenPromise = refreshAccessToken();
        }

        const newToken = await refreshTokenPromise;
        refreshTokenPromise = null;

        // Retry with new token
        //@ts-ignore
        headers.Authorization = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          ...finalOptions,
          headers,
        });

        if (!retryResponse.ok) {
          throw await parseError(retryResponse);
        }

        // Handle 204 No Content
        if (retryResponse.status === 204) {
          return null as T;
        }

        return retryResponse.json();
      } catch (refreshError) {
        refreshTokenPromise = null;
        throw refreshError;
      }
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  } catch (error) {
    // Re-throw any errors (network errors, parse errors, etc.)
    throw error;
  }
}

// ==================== REFRESH TOKEN ====================
// Refresh token function – will be implemented when backend provides refresh token
async function refreshAccessToken(): Promise<string> {
  // Check cooldown to prevent rapid refresh attempts
  const now = Date.now();
  if (now - lastRefreshAttemptTime < REFRESH_COOLDOWN_MS) {
    console.log('⏳ Refresh on cooldown, waiting...');
    throw new Error('Token refresh on cooldown - please wait');
  }
  
  lastRefreshAttemptTime = now;
  console.log('🔄 Refreshing token...');
  
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/refresh-token`,
      {
        method: "GET", // adjust to POST if needed
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      // Only clear auth if refresh token is explicitly rejected (401)
      // Other errors (500, network issues) should NOT clear auth
      if (response.status === 401) {
        console.error('Refresh token rejected - session truly expired');
        clearAuth();
        throw new Error("Session expired. Please login again.");
      }
      // For other errors, throw without clearing auth - it might be temporary
      throw new Error(`Token refresh failed with status ${response.status}`);
    }

    const data = await response.json();
    const newAccessToken = data.accessToken;
    setAccessToken(newAccessToken);

    // If the refresh response includes user data (id, username, roles), update it
    if (data.id && data.username && data.roles && data.profileId) {
      setUser({
        id: data.id,
        username: data.username,
        fullName: data.fullName,
        profileId: data.profileId,
        roles: data.roles,
        customerApprovalStatus: data.customerApprovalStatus,
        driverStatus: data.driverStatus,
        onboardingCompleted: data.onboardingCompleted,
        onboardingToken: data.onboardingToken,
        isActive: data.isActive,
      });
    }

    return newAccessToken;
  } catch (error) {
    // Don't clear auth on network errors or temporary failures
    // Only re-throw the error - the calling code will handle it
    console.error('Token refresh error:', error);
    throw error;
  }
  
}

// ==================== ERROR PARSING ====================

async function parseError(response: Response): Promise<Error> {
  let errorData;
  try {
    errorData = await response.json();
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }

  // Handle structured error response
  if (errorData?.message) {
    return new Error(errorData.message);
  }

  if (errorData?.errors) {
    const messages = Object.values(errorData.errors).flat().join(", ");
    return new Error(messages);
  }

  return new Error(`Request failed with status ${response.status}`);
}

// ==================== QUERY HOOK ====================

export function useDataQuery<T = any>({
  apiEndPoint,
  refetchInterval,
  columnFilters = {},
  globalFilter = "",
  sorting = [],
  pagination = { pageIndex: 0, pageSize: 10 },
  enabled = true,
  noFilter = false,
  fetchWithoutRefresh = false,
  publicEndpoint = false,
  queryKey: passedQueryKey,
  select,
  staleTime = 5 * 60 * 1000, // 5 minutes default
}: QueryParams<T>) {
  const requiresAuth = !fetchWithoutRefresh;
  const skipTokenRefresh = publicEndpoint;

  const baseKey: QueryKey = passedQueryKey || ["data", apiEndPoint];

  // Build query key with dependencies
  const queryKey: QueryKey = [
    ...(Array.isArray(baseKey) ? baseKey : [baseKey]),
    {
      globalFilter,
      noFilter,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      columnFilters,
      sorting,
    },
  ];

  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      const url = new URL(apiEndPoint, window.location.origin);

      // Add query params for filtered endpoints
      if (!noFilter) {
        url.searchParams.set("page", String(pagination.pageIndex + 1));
        url.searchParams.set("limit", String(pagination.pageSize));

        if (globalFilter) {
          url.searchParams.set("search", globalFilter);
        }

        if (Object.keys(columnFilters).length > 0) {
          Object.entries(columnFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              url.searchParams.set(key, String(value));
            }
          });
        }

        if (sorting.length > 0) {
          const sortParam = sorting
            .map((sort) => `${sort.id}:${sort.desc ? "desc" : "asc"}`)
            .join(",");
          url.searchParams.set("sort", sortParam);
        }
      }

      return baseFetch<T>(
        url.toString(),
        {
          method: "GET",
        },
        requiresAuth,
        skipTokenRefresh,
      );
    },
    placeholderData: keepPreviousData,
    refetchInterval,
    enabled,
    select,
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
  });
}

// ==================== MUTATION HOOK ====================

export function useDataMutation<TData = any, TVariables = any>({
  apiEndPoint,
  method = "POST",
  onSuccessInvalidate = true,
  onSuccess,
  onError,
  onSettled,
  getBody = (variables) => JSON.stringify(variables),
  invalidateQueryKey,
  fetchWithoutRefresh = false,
  publicEndpoint = false,
  successMessage,
  errorMessage,
}: MutationParams<TData, TVariables>) {
  const queryClient = useQueryClient();
  const requiresAuth = !fetchWithoutRefresh;
  const skipTokenRefresh = publicEndpoint;

  return useMutation<
    TData,
    Error,
    TVariables & { pathParams?: Record<string, string | number> }
  >({
    mutationFn: async (variables) => {
      const { pathParams, ...cleanVariables } = variables || {};

      // Replace path parameters in endpoint
      let finalEndpoint = apiEndPoint;
      if (pathParams) {
        Object.entries(pathParams).forEach(([key, value]) => {
          finalEndpoint = finalEndpoint.replace(
            `:${key}`,
            encodeURIComponent(String(value)),
          );
        });
      }

      const body =
        method === "DELETE" && !getBody
          ? undefined
          : getBody(cleanVariables as TVariables);

      return baseFetch<TData>(
        finalEndpoint,
        {
          method,
          body,
        },
        requiresAuth,
        skipTokenRefresh,
      );
    },
    onSuccess: (data, variables) => {
      // Show success toast if configured
      if (successMessage) {
        // You can integrate with your toast library here
        console.log("Success:", successMessage);
      }

      // Invalidate relevant queries
      if (onSuccessInvalidate) {
        const keysToInvalidate = invalidateQueryKey?.length
          ? invalidateQueryKey
          : [["data", apiEndPoint]];

        keysToInvalidate.forEach((key) => {
          queryClient.invalidateQueries({
            queryKey: key,
            refetchType: "active", // Only refetch active queries
          });
        });
      }

      // Custom success handler
      onSuccess?.(data, variables);
    },
    onError: (error) => {
      // Show error toast if configured
      if (errorMessage) {
        console.error("Error:", errorMessage, error);
      } else {
        console.error("Mutation error:", error.message);
      }

      // Custom error handler
      onError?.(error);
    },
    onSettled: () => {
      onSettled?.();
    },
  });
}

// ==================== COMMON MUTATION SHORTCUTS ====================

export function useCreate<TData = any, TVariables = any>(
  apiEndPoint: string,
  options?: Omit<MutationParams<TData, TVariables>, "apiEndPoint" | "method">,
) {
  return useDataMutation<TData, TVariables>({
    apiEndPoint,
    method: "POST",
    successMessage: "Created successfully",
    ...options,
  });
}

export function useUpdate<TData = any, TVariables = any>(
  apiEndPoint: string,
  options?: Omit<MutationParams<TData, TVariables>, "apiEndPoint" | "method">,
) {
  return useDataMutation<TData, TVariables>({
    apiEndPoint,
    method: "PUT",
    successMessage: "Updated successfully",
    ...options,
  });
}

export function usePatch<TData = any, TVariables = any>(
  apiEndPoint: string,
  options?: Omit<MutationParams<TData, TVariables>, "apiEndPoint" | "method">,
) {
  return useDataMutation<TData, TVariables>({
    apiEndPoint,
    method: "PATCH",
    successMessage: "Updated successfully",
    ...options,
  });
}

export function useDelete<TData = any, TVariables = any>(
  apiEndPoint: string,
  options?: Omit<MutationParams<TData, TVariables>, "apiEndPoint" | "method">,
) {
  return useDataMutation<TData, TVariables>({
    apiEndPoint,
    method: "DELETE",
    successMessage: "Deleted successfully",
    ...options,
  });
}

// ==================== FILE UPLOAD HOOK ====================
/**
 * Specialized hook for file uploads (multipart/form-data).
 * Uses the same authentication flow as other hooks.
 */
export function useFileUpload<TData = any>(
  apiEndPoint: string,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    onSettled?: () => void;
    invalidateQueryKey?: QueryKey[];
    successMessage?: string;
    errorMessage?: string;
  }
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, FormData>({
    mutationFn: async (formData) => {
      // Get valid token (handles refresh)
      const token = await ensureAuth();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(apiEndPoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type – browser will set with boundary
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as TData;
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (options?.successMessage) {
        console.log('Success:', options.successMessage);
      }
      if (options?.invalidateQueryKey) {
        options.invalidateQueryKey.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      if (options?.errorMessage) {
        console.error('Error:', options.errorMessage, error);
      } else {
        console.error('File upload error:', error.message);
      }
      options?.onError?.(error);
    },
    onSettled: options?.onSettled,
  });
}

// ==================== AUTHENTICATED FETCH HELPER ====================
/**
 * Helper function for making authenticated fetch calls outside of React hooks.
 * Use this for imperative API calls (e.g., in event handlers that need immediate feedback).
 */
export async function authFetch<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  return baseFetch<T>(url, options, true);
}