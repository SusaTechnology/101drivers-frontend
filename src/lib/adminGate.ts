/**
 * adminGate — the client half of the shared-secret door in front of the
 * admin UI (see backend/src/admin-gate for the server half).
 *
 * The backend validates a month-derived access key from `?key=…` links
 * and answers with a signed, httpOnly 30-day cookie. Because that cookie
 * is invisible to JavaScript (and some browsers refuse cross-site
 * cookies outright), the door proves it is open three ways, in order:
 *
 *   - `?key=` present  → POST /api/admin-gate/unlock { key }
 *                        (response also carries a signed token to store)
 *   - mirror cookie    → admin_gate_ok=1, same-origin only, no network
 *   - otherwise        → GET  /api/admin-gate/status — the API accepts
 *                        the httpOnly cookie OR an x-admin-gate-token
 *                        header with the stored token (cookie-blocked
 *                        browsers still get through)
 *
 * Both endpoints are public and return no admin data — they only open or
 * refuse the door. Any failure means "locked", and the router bounces to
 * the landing page before an admin screen ever renders.
 *
 * EARLY UNLOCK: the session layer (dataQuery/provider) can bounce a
 * sessionless visitor to the role login BEFORE the router's gate runs —
 * and that redirect drops the ?key= param. So the unlock is fired at
 * module-evaluation time, before anything else boots; the router just
 * awaits the same promise. The cookie lands no matter where the early
 * redirect sends the visitor.
 *
 * The unlocked flag lives in memory only: one probe per hard page load,
 * no probes during SPA navigation, and an expired cookie is caught on
 * the next reload.
 */

const API_BASE = import.meta.env.VITE_API_URL;
const UNLOCK_ENDPOINT = `${API_BASE}/api/admin-gate/unlock`;
const STATUS_ENDPOINT = `${API_BASE}/api/admin-gate/status`;

/** Admin URLs that sit behind the door — kept in sync with the gate's
 *  beforeLoad in routes/__root.tsx. NOTE: admin pages are dash-style
 *  (/admin-dashboard, /admin-user-detail, …) so a bare `/admin` prefix
 *  match is required — `/admin/` + slash would miss every admin page. */
const GATED_ADMIN_PREFIXES = ["/admin", "/auth/admin-signin"];

export function isAdminGatePath(pathname: string): boolean {
  return GATED_ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Paths that are NOT gated but whose ?key= should still open the door.
 * The admin invite email carries the current month's gate key on the
 * setup link, so the new admin's 30-day cookie lands on this very first
 * visit — before they ever reach a gated admin screen. The invite page
 * itself stays public (a visitor without the key can still look at it).
 */
const EARLY_UNLOCK_PREFIXES = ["/auth/accept-invite"];

function shouldEarlyUnlock(pathname: string): boolean {
  return (
    isAdminGatePath(pathname) ||
    EARLY_UNLOCK_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * Signed gate token — the fallback credential for browsers that block
 * the cross-site gate cookie (iOS PWA standalone, Safari ITP, third-
 * party cookies off). The unlock response returns the SAME signed value
 * the cookie carries; the API validates either, so the door stays open
 * across reloads even with zero cookies.
 */
const GATE_TOKEN_STORAGE_KEY = "admin_gate_token";

function storeGateToken(token: unknown): void {
  if (typeof token !== "string" || token.length === 0) return;
  try {
    window.localStorage.setItem(GATE_TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage unavailable (private mode…) — the cookie remains primary.
  }
}

function storedGateToken(): string | null {
  try {
    return window.localStorage.getItem(GATE_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearGateToken(): void {
  try {
    window.localStorage.removeItem(GATE_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Same-origin deployments also get a JS-readable mirror cookie next to
 * the httpOnly one — if it is present, the httpOnly one is too, and the
 * door is open without touching the network.
 */
function hasMirrorCookie(): boolean {
  return (
    typeof document !== "undefined" &&
    document.cookie
      .split(";")
      .some((entry) => entry.trim() === "admin_gate_ok=1")
  );
}

let unlocked = false;
let pendingUnlock: Promise<boolean> | null = null;

function postUnlock(key: string): Promise<boolean> {
  return fetch(UNLOCK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key }),
  })
    .then(async (response) => {
      if (response.ok) {
        try {
          const body = (await response.json()) as { gateToken?: unknown };
          storeGateToken(body.gateToken);
        } catch {
          // No JSON body — the cookie may still have landed.
        }
        unlocked = true;
        return true;
      }
      // Visible in DevTools for the owner: 502 = API down, 404 = the
      // backend predates the gate module, 401 = wrong/expired key. All
      // mean "locked" to a stranger — nothing sensitive is revealed.
      console.warn(`[admin-gate] unlock rejected (HTTP ${response.status})`);
      return false;
    })
    .catch((error: unknown) => {
      console.warn(
        "[admin-gate] unlock unreachable:",
        error instanceof Error ? error.message : error
      );
      return false;
    });
}

if (typeof window !== "undefined") {
  const key = new URLSearchParams(window.location.search).get("key");
  if (key && shouldEarlyUnlock(window.location.pathname)) {
    pendingUnlock = postUnlock(key);
  }
}

/** Is the door already open in this page session (no network call)? */
export function isAdminGateUnlocked(): boolean {
  return unlocked;
}

/**
 * Open the door with an access key, or check whether it already is.
 * Never throws — any network/HTTP failure means "locked".
 */
export async function ensureAdminGateUnlocked(
  accessKey?: string
): Promise<boolean> {
  if (unlocked) return true;

  if (accessKey) {
    // Reuse the early unlock for the same link instead of double-POSTing.
    if (pendingUnlock) {
      const ok = await pendingUnlock;
      pendingUnlock = null;
      return ok;
    }
    return postUnlock(accessKey);
  }

  if (pendingUnlock) {
    const ok = await pendingUnlock;
    pendingUnlock = null;
    if (ok) return true;
  }

  // Same-origin mirror cookie: door open without touching the network.
  if (hasMirrorCookie()) {
    unlocked = true;
    return true;
  }

  try {
    const headers: Record<string, string> = {};
    const token = storedGateToken();
    if (token) headers["x-admin-gate-token"] = token;
    const response = await fetch(STATUS_ENDPOINT, {
      credentials: "include",
      headers,
    });
    if (response.ok) {
      unlocked = true;
      return true;
    }
    if (response.status === 401) {
      // The server saw the token AND the cookie and rejected both — the
      // stored token is stale (expired / rotated secret). Drop it.
      clearGateToken();
    }
  } catch {
    // Network error — treat as locked.
  }
  return false;
}
