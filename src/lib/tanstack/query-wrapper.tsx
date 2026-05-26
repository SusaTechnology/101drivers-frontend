import {
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import type {
  UseQueryOptions,
  UseMutationOptions,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";

// import { sessionActions } from "@/lib/store/global-state/auth/auth-slice";
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
let dispatchRef: any;
export function initAuthDispatch(dispatch: any) {
  dispatchRef = dispatch;
}
function getToken() {
  return accessToken;
}
function setToken(token: string) {
  accessToken = token;
}

async function resolveResponse(res: Response) {
  if (res.status === 204) return null;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return res.json();
  if (type.includes("text/")) return res.text();
  if (type.includes("image/")) return res.blob();
  if (type.includes("application/pdf")) return res.blob();
  if (
    type.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) ||
    type.includes("application/vnd.ms-excel")
  ) {
    return res.blob();
  }
  return res.arrayBuffer();
}
async function baseFetch(
  request: {
    url: string;
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  },
  // tenantCode: string,
  token?: string | null
) {
  const res = await fetch(request.url, {
    method: request.method ?? "GET",
    body: request.body,
    credentials: "include",
    headers: {
      // "x-tenant-code": tenantCode,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...request.headers,
    },
  });
  if (!res.ok) {
    const error = await resolveResponse(res).catch(() => null);
    throw new Error(error?.message || res.statusText);
  }
  return resolveResponse(res);
}
async function refreshToken(tenantCode: string) {
  const res = await fetch(
    "https://api.techbee.et/api/auth/auth/refresh-token",
    {
      method: "GET",
      credentials: "include",
      headers: { "x-tenant-code": tenantCode },
    }
  );
  if (!res.ok) {
    // dispatchRef?.(sessionActions.clearSession());
    throw new Error("Unauthorized");
  }
  const data = await res.json();
  setToken(data.accessToken);
//   dispatchRef?.(
//     sessionActions.setSession({
//       loggedIn: true,
//       accessToken: data.accessToken,
//       user: data.user,
//       organization: data.organization,
//       permissions: data.permissions,
//       tenantCode,
//     })
//   );
  return data.accessToken;
}
async function fetchExecutor(
  request: {
    url: string;
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  },
  tenantCode: string,
  withoutRefresh?: boolean
) {
  if (withoutRefresh) return baseFetch(request, tenantCode, getToken());
  try {
    return await baseFetch(request, tenantCode, getToken());
  } catch {
    if (!refreshPromise) refreshPromise = refreshToken(tenantCode);
    const newToken = await refreshPromise;
    refreshPromise = null;
    return baseFetch(request, tenantCode, newToken);
  }
}
type QueryConfig<TData> = {
  fetchType: "query";
  fetchWithoutRefresh?: boolean;
  request: {
    url: string;
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  };
  mainQueryParams: UseQueryOptions<TData> & { queryKey: readonly unknown[] };
};
type MutationConfig<TData, TVariables> = {
  fetchType: "mutation";
  fetchWithoutRefresh?: boolean;
  request: {
    url: string;
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  };
  mainMutationParams?: UseMutationOptions<TData, unknown, TVariables>;
};
export type FetchWrapperConfig<TData = any, TVariables = any> =
  | QueryConfig<TData>
  | MutationConfig<TData, TVariables>;
type FetchWrapperReturn<T extends FetchWrapperConfig> = T extends QueryConfig<
  infer TData
>
  ? UseQueryResult<TData>
  : T extends MutationConfig<infer TData, infer TVariables>
  ? UseMutationResult<TData, unknown, TVariables>
  : never;
export function fetchWrapper<T extends FetchWrapperConfig>(
  config: T
): FetchWrapperReturn<T> {
  const tenantCode = getTenantCode();
  if (!tenantCode) throw new Error("Tenant code missing");
  if (config.fetchType === "query") {
    return useQuery({
      ...config.mainQueryParams,
      queryFn: () =>
        fetchExecutor(config.request, tenantCode, config.fetchWithoutRefresh),
    }) as FetchWrapperReturn<T>;
  }
  return useMutation({
    ...config.mainMutationParams,
    mutationFn: (variables) =>
      fetchExecutor(
        {
          ...config.request,

          body:
            variables instanceof FormData
              ? variables
              : Object.keys(variables).length !== 0
              ? JSON.stringify(variables)
              : undefined,
        },
        tenantCode,
        config.fetchWithoutRefresh
      ),
  }) as FetchWrapperReturn<T>;
}
