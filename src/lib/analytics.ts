// Product analytics client (Task 72) — silent-fail page-view ping.
//
// One PAGE_VIEW per SPA navigation, sent to POST /api/analytics/events
// (public, PAGE_VIEW-only, IP-budgeted server-side). This client must
// NEVER be able to affect the app: every call is wrapped, every failure
// is swallowed, nothing is ever awaited by callers.

import { getAccessToken } from '@/lib/tanstack/dataQuery';

const SESSION_KEY = 'analytics:session-id';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/** Sticky per-tab session id so the ledger can group a visit's paths. */
function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // private mode / storage blocked — the ping still works, just anonymous
    return 'no-session';
  }
}

// SPA safety: the same path can fire twice in quick succession (guard
// redirects, param-only changes). Dedupe identical paths within 2 seconds.
let lastTrackedPath: string | null = null;
let lastTrackedAt = 0;

export function trackPageView(path: string): void {
  try {
    const now = Date.now();
    if (path === lastTrackedPath && now - lastTrackedAt < 2000) return;
    lastTrackedPath = path;
    lastTrackedAt = now;

    const token = getAccessToken();
    const body = JSON.stringify({
      type: 'PAGE_VIEW',
      path,
      referrer: document.referrer || undefined,
      sessionId: getSessionId(),
    });

    // keepalive lets the request survive page unload; the Bearer header
    // (when a session exists) lets the server attribute the visit.
    void fetch(`${API_BASE_URL}/api/analytics/events`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    }).catch(() => {
      /* analytics must never surface an error */
    });
  } catch {
    /* analytics must never break the app */
  }
}
