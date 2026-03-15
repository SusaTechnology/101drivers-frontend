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

// User data (id, username, roles) from login response
let currentUser: {
  id: string;
  username: string;
  profileId: string | null;
  roles: string[];
} | null = null;

export function getAccessToken(): string | null {
  return currentAccessToken ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);;
}

export function setAccessToken(token: string) {
  currentAccessToken = token;
    if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getUser() {
    if (!currentUser) {
    const stored = sessionStorage.getItem(USER_KEY);
    if (stored) currentUser = JSON.parse(stored);
  }
  return currentUser;
}

export function setUser(user: typeof currentUser) {
  currentUser = user;
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(USER_KEY);
}

export function clearAuth() {
  currentAccessToken = null;
  currentUser = null;
  refreshTokenPromise = null;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
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
    credentials: "include" as RequestCredentials,
  };

  const response = await fetch(url, finalOptions);

  // Handle 401/403 with token refresh
  if (response.status === 401 || response.status === 403) {
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
}

// ==================== REFRESH TOKEN ====================
// Refresh token function – will be implemented when backend provides refresh token
async function refreshAccessToken(): Promise<string> {
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
      clearAuth();
      throw new Error("Session expired. Please login again.");
    }

    const data = await response.json();
    const newAccessToken = data.accessToken;
    setAccessToken(newAccessToken);

    // If the refresh response includes user data (id, username, roles), update it
    if (data.id && data.username && data.roles && data.profileId) {
      console.log("here fjjrfs", data.profileId)
      setUser({
        id: data.id,
        username: data.username,
        profileId: data.profileId,
        roles: data.roles,
      });
    }

    return newAccessToken;
  } catch (error) {
    clearAuth();
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
  queryKey: passedQueryKey,
  select,
  staleTime = 5 * 60 * 1000, // 5 minutes default
}: QueryParams<T>) {
  const requiresAuth = !fetchWithoutRefresh;

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
  successMessage,
  errorMessage,
}: MutationParams<TData, TVariables>) {
  const queryClient = useQueryClient();
  const requiresAuth = !fetchWithoutRefresh;

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