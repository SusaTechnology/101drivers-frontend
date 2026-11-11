// Better Auth React client (drivers identity).
// Docs: better-auth.com — official React client ("better-auth/react").
// The backend handler is mounted at /api/better-auth (see
// backend/src/better-auth/). Cookies are HTTP-only; the bearer() plugin lets
// the client pick up the session token returned by /get-session so requests
// can also travel via the Authorization header on browsers that block
// cross-site cookies (iOS PWA standalone mode, Safari ITP) — mirroring the
// legacy x-refresh-token fallback design.

import { createAuthClient } from "better-auth/react";
import { bearer } from "better-auth/plugins/bearer";

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_URL}/api/better-auth`,
  fetchOptions: { credentials: "include" },
  plugins: [bearer()],
});

// ── In-memory session token (NEVER persisted to storage) ────────────────
// Captured from getSession() responses (the bearer plugin adds `token`).
// Module-scope only: a page reload drops it and the session falls back to
// the HTTP-only cookie; refreshBetterAuthContext() re-captures it.
let sessionToken: string | null = null;

export function setSessionToken(token: string | null | undefined): void {
  sessionToken = token || null;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export function baAuthHeaders(): Record<string, string> {
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}
