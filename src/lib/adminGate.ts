/**
 * adminGate — the client half of the shared-secret door in front of the
 * admin UI (see backend/src/admin-gate for the server half).
 *
 * The backend validates a month-derived access key from `?key=…` links
 * and answers with a signed, httpOnly 30-day cookie. Because that cookie
 * is invisible to JavaScript (and, cross-origin, so is any mirror), the
 * router asks the API once per page load whether the door is open:
 *
 *   - `?key=` present  → POST /api/admin-gate/unlock { key }
 *   - otherwise        → GET  /api/admin-gate/status
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

let unlocked = false;
let pendingUnlock: Promise<boolean> | null = null;

function postUnlock(key: string): Promise<boolean> {
  return fetch(UNLOCK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key }),
  })
    .then((response) => {
      if (response.ok) {
        unlocked = true;
        return true;
      }
      return false;
    })
    .catch(() => false);
}

if (typeof window !== "undefined") {
  const key = new URLSearchParams(window.location.search).get("key");
  if (key && isAdminGatePath(window.location.pathname)) {
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

  try {
    const response = await fetch(STATUS_ENDPOINT, {
      credentials: "include",
    });
    if (response.ok) {
      unlocked = true;
      return true;
    }
  } catch {
    // Network error — treat as locked.
  }
  return false;
}
