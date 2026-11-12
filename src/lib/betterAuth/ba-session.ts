// ba-session — the Better Auth ↔ legacy frontend bridge (drivers).
//
// The existing app authenticates via localStorage cache + Bearer access
// tokens (src/lib/tanstack/dataQuery.ts). Better Auth drivers keep working
// through that same machinery:
//   • auth state  → mirrored into the SAME localStorage user cache, so
//     DriverRouteGuard needs zero changes;
//   • transport   → HTTP-only session cookie where the browser allows it,
//     plus the in-memory bearer token where it doesn't (Safari ITP /
//     iOS PWA) — the bearer plugin returns `token` in getSession responses;
//   • keep-alive  → the 10-minute proactive refresher calls THIS module's
//     context refresh instead of the legacy /auth/refresh-token endpoint
//     (registered via registerBetterAuthBridge — no import cycle).
//
// The session token itself is NEVER written to localStorage/sessionStorage
// (task security rule) — module memory only.

import { authClient, baAuthHeaders, getSessionToken, setSessionToken } from "./auth-client";
import {
  clearAuth,
  getAccessToken,
  getUser,
  registerBetterAuthBridge,
  setAccessToken,
  setUser,
  startSessionKeepAlive,
} from "@/lib/tanstack/dataQuery";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export interface BaDriverContext {
  id: string;
  profileId: string | null;
  username: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  driverStatus:
    | 'WAITLISTED'
    | 'INVITED'
    | 'PENDING'
    | 'PENDING_APPROVAL'
    | 'MEETING_REQUESTED'
    | 'APPROVED'
    | 'SUSPENDED'
    | 'REJECTED'
    | 'ON_HOLD'
    | null;
  onboardingCompleted: boolean;
  onboardingToken: string | null;
  isSuperAdmin: boolean;
  authSystem: "better-auth";
}

export function isBetterAuthSession(): boolean {
  return getUser()?.authSystem === "better-auth";
}

const SESSION_EXPIRED = "Session expired. Please login again.";

/**
 * Re-sync the Better Auth session into the legacy cache:
 * 1. authClient.getSession() — validates the cookie session (or bearer
 *    token) and returns the session token for the bearer header.
 * 2. GET /api/auth/ba/driver-context — the legacy UserInfo shape from the
 *    backend (roles/driverStatus/onboarding state), so the guard machinery
 *    and every existing query keep working unchanged.
 * Throws the canonical "Session expired" error (after clearAuth) on a dead
 * session — the same convergence path the legacy refresher uses.
 */
export async function refreshBetterAuthContext(): Promise<BaDriverContext> {
  const session = await authClient.getSession({
    query: {},
    fetchOptions: { throw: false },
  });
  if (session.error || !session.data) {
    clearAuth();
    throw new Error(SESSION_EXPIRED);
  }
  // The bearer() plugin appends `token` to getSession responses.
  setSessionToken((session.data as { token?: string }).token ?? null);

  const res = await fetchWithTimeout(
    `${import.meta.env.VITE_API_URL}/api/auth/ba/driver-context`,
    {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...baAuthHeaders() },
    }
  );
  if (!res.ok) {
    clearAuth();
    throw new Error(SESSION_EXPIRED);
  }
  const context = (await res.json()) as BaDriverContext;
  const prev = getUser();
  setUser({ ...prev, ...context });
  // Sentinel access token: truthy so isAuthenticated()/ensureAuth() pass;
  // the REAL bearer credential travels via baAuthHeaders().
  setAccessToken("better-auth");
  startSessionKeepAlive();
  return context;
}

/**
 * Where a freshly signed-in social user should land — the exact decision
 * tree DealerSignIn applies after email/password login, extended with the
 * "no driver profile yet" branch that routes to the social application form.
 */
export function driverLandingPathForContext(context: BaDriverContext): string {
  if (!context.profileId) return "/driver/social-application";
  if (context.onboardingCompleted) return "/driver/dashboard";
  if (context.onboardingToken) {
    return `/driver/onboarding-complete?token=${encodeURIComponent(context.onboardingToken)}`;
  }
  return "/driver-application-submitted";
}

// ── Bridge registration (no import cycle) ────────────────────────────────
// dataQuery.ts keeps a nullable bridge reference; ba-session registers on
// module load. Without a bridge, dataQuery behaves exactly as before.
export function registerBaBridge(): void {
  registerBetterAuthBridge({
    isSession: isBetterAuthSession,
    refresh: async () => {
      await refreshBetterAuthContext();
      return getAccessToken() ?? "better-auth";
    },
    sessionToken: getSessionToken,
  });
}
registerBaBridge();
