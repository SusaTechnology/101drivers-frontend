"use client";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { socketConnect, socketDisconnect } from "@/lib/socket";

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
  driverStatus?: 'WAITLISTED' | 'INVITED' | 'PENDING' | 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
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
  // Connect WebSocket when user logs in
  socketConnect(token);
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

// Remember the last known roles so the session-expired redirect
// can send the user to the correct role-specific login page even after clearAuth().
let lastKnownRoles: string[] = [];

export function clearAuth() {
  // Snapshot roles before wiping — provider.tsx needs them for redirect
  if (currentUser?.roles) {
    lastKnownRoles = [...currentUser.roles];
  }
  currentAccessToken = null;
  currentUser = null;
  refreshTokenPromise = null;
  lastRefreshAttemptTime = 0;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Disconnect WebSocket when user logs out
  socketDisconnect();
}

/** Returns the last known roles even after clearAuth() wiped the user. */
export function getLastKnownRoles(): string[] {
  return lastKnownRoles;
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
      await refreshShared();
    } catch (error) {
      console.error('Proactive refresh failed:', error);
      // Don't clear auth on proactive refresh failure
      // The next API call will handle it if needed
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
    // Connect WebSocket on page load if already authenticated
    socketConnect(getAccessToken());
  }
  
  // Also refresh token when tab becomes visible (user returns to app)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isAuthenticated()) {
      // Silently refresh token when user comes back to the tab.
      // Goes through the shared helper so it deduplicates with any
      // in-flight reactive refresh instead of racing it.
      refreshShared().catch(() => {
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

/**
 * Run a single deduplicated token refresh.
 *
 * All refresh call sites (ensureAuth, 401 retry in baseFetch, file uploads,
 * authFetchRaw, keep-alive interval) go through this helper so that concurrent
 * callers share one in-flight request. The shared promise is ALWAYS cleared in
 * `finally` — previously a failed refresh left a rejected promise in
 * `refreshTokenPromise`, which poisoned every later caller with the stale
 * error even after the cooldown had passed.
 */
async function refreshShared(): Promise<string> {
  try {
    if (!refreshTokenPromise) {
      refreshTokenPromise = refreshAccessToken();
    }
    return await refreshTokenPromise;
  } finally {
    refreshTokenPromise = null;
  }
}

async function ensureAuth(): Promise<string | null> {
  let token = getAccessToken();
  const user = getUser();

  if (!token || !user) {
    token = await refreshShared();
  }

  return token;
}

async function baseFetch<T>(
  url: string,
  options: RequestInit,
  requiresAuth = true,
  skipTokenRefresh = false,
): Promise<T> {
  // Never force a JSON content-type on multipart bodies — the browser must
  // set `multipart/form-data; boundary=...` itself or the server cannot parse
  // the request (this is what previously forced uploads into useFileUpload).
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

    // Handle 401 with token refresh ONLY if not a public endpoint.
    // 401 = token expired/invalid → a fresh token can fix it.
    // 403 = authenticated but NOT ALLOWED (role/permission) — refreshing the
    // token cannot change that, and if the refresh cookie happens to be
    // missing/expired the 401 from the refresh endpoint would incorrectly log
    // the user out with "Session expired" instead of surfacing the real
    // permission error. So 403 is surfaced directly, never retried.
    if (response.status === 401 && !skipTokenRefresh) {
      const newToken = await refreshShared();

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

    // If the refresh response includes user data, refresh the stored user so
    // role/approval-status changes made server-side propagate into the UI.
    // NOTE: profileId is null for admins (resolveAuthMeta only resolves a
    // profile for customers/drivers), so it must NOT be required here —
    // the old strict `data.profileId` check silently skipped the user
    // refresh for every admin session. Merge over the previous user object
    // so nothing is lost, with the fresh backend values winning.
    if (data.id && data.username && data.roles) {
      const prev = getUser();
      setUser({
        ...prev,
        id: data.id,
        username: data.username,
        fullName: data.fullName ?? prev?.fullName ?? null,
        profileId: data.profileId ?? prev?.profileId ?? null,
        roles: data.roles,
        customerApprovalStatus: data.customerApprovalStatus ?? null,
        driverStatus: data.driverStatus ?? null,
        onboardingCompleted: data.onboardingCompleted ?? prev?.onboardingCompleted ?? false,
        onboardingToken: data.onboardingToken ?? null,
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

/**
 * Parsed error from a failed API response.
 *
 * Backend endpoints that throw NestJS `BadRequestException({ code, message,
 * details })` (e.g. `PricingEditException`) will produce a response body
 * like:
 *   {
 *     statusCode: 400,
 *     error: "Bad Request",
 *     code: "NO_SAVED_CARD",
 *     message: "You don't have a saved card...",
 *     details: { ... }
 *   }
 *
 * We preserve `code` and `details` on the thrown Error so callers (e.g. the
 * PricingEditErrorDialog) can switch on `err.code` to show the right
 * recovery button. Callers that only read `.message` are unaffected.
 */
export interface ParsedApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  status?: number;
}

async function parseError(response: Response): Promise<ParsedApiError> {
  let errorData: any;
  try {
    errorData = await response.json();
  } catch {
    const e = new Error(`Request failed with status ${response.status}`) as ParsedApiError;
    e.status = response.status;
    return e;
  }

  // Build the base error from the message field.
  let msg: string;
  if (errorData?.message) {
    msg = Array.isArray(errorData.message)
      ? errorData.message.join("; ")
      : String(errorData.message);
  } else if (errorData?.errors) {
    msg = Object.values(errorData.errors).flat().join(", ");
  } else {
    msg = `Request failed with status ${response.status}`;
  }

  const err = new Error(msg) as ParsedApiError;

  // Preserve structured fields from NestJS exception objects.
  // BadRequestException({ code, message, details }) puts `code` and
  // `details` at the top level of the response body (alongside `statusCode`
  // and `error`). Capture them so frontend dialogs can switch on `err.code`.
  if (errorData && typeof errorData.code === "string") {
    err.code = errorData.code;
  }
  if (errorData && errorData.details && typeof errorData.details === "object") {
    err.details = errorData.details;
  }
  err.status = response.status;

  return err;
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
      // Get valid token (handles refresh when token/user is missing)
      const token = await ensureAuth();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const doUpload = (authToken: string) =>
        fetch(apiEndPoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            // Do NOT set Content-Type – browser will set with boundary
          },
          body: formData,
          credentials: 'include',
        });

      let response = await doUpload(token);

      // Access token may have expired since it was issued (15 min TTL).
      // ensureAuth cannot detect that client-side, so handle the 401 here:
      // refresh once and retry, exactly like baseFetch does for JSON calls.
      if (response.status === 401) {
        const newToken = await refreshShared();
        response = await doUpload(newToken);
      }

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

// ==================== AUTHENTICATED FETCH HELPERS ====================
/**
 * Helper function for making authenticated fetch calls outside of React hooks.
 * Use this for imperative API calls (e.g., in event handlers that need immediate feedback).
 * Returns the parsed JSON body; on 401 the token is refreshed once and the
 * request retried before failing.
 */
export async function authFetch<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  return baseFetch<T>(url, options, true);
}

/**
 * Like authFetch, but returns the raw Response so callers can read headers
 * and consume the body themselves (blobs, CSV/XLSX/PDF downloads, etc.).
 * On 401 the token is refreshed once and the request retried.
 */
export async function authFetchRaw(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await ensureAuth();

  const buildInit = (authToken: string | null): RequestInit => {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string> | undefined) ?? {}),
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return {
      ...options,
      headers,
      credentials: options.credentials ?? (url.includes('/auth/') ? 'include' : 'omit'),
    };
  };

  let response = await fetch(url, buildInit(token));

  if (response.status === 401) {
    const newToken = await refreshShared();
    response = await fetch(url, buildInit(newToken));
  }

  return response;
}

/**
 * Best-effort server-side logout: asks the backend to clear the httpOnly
 * refresh-token cookie. Errors are swallowed — local cleanup must proceed
 * regardless. Used by every sign-out path so the 7-day refresh cookie does
 * not survive logout in the browser.
 */
export async function serverLogout(): Promise<void> {
  try {
    const token = getAccessToken();
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
  } catch {
    // Ignore — the local clearAuth() still runs.
  }
}