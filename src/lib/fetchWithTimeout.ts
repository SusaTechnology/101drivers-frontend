/**
 * fetch() with a hard deadline.
 *
 * WHY THIS EXISTS
 * A `fetch()` on a half-open connection — the classic state after an iOS
 * suspension kills the radio, or after a Wi-Fi↔cellular flap — can hang for
 * MINUTES until the OS TCP stack gives up. During that time every query
 * waiting on it shows a spinner, the user assumes the app is broken, and
 * React Query cannot even start its retry cycle because the promise never
 * settles. This is exactly the "app froze after hours idle" failure class.
 *
 * CONTRACT
 *  - Resolves with the SAME Response fetch would return (status handling,
 *    401 refresh logic, JSON parsing in dataQuery.ts are all untouched).
 *  - On deadline, rejects with ApiTimeoutError — deliberately with NO
 *    `status` field, so provider.tsx's shouldRetryQuery treats it exactly
 *    like a network failure: queries retry with backoff (the retry usually
 *    rides the revived radio and succeeds), mutations fail fast with a
 *    readable message instead of hanging forever.
 *  - `timeoutMs = 0/null/undefined` → behaves exactly like fetch() (used for
 *    multipart uploads and large downloads, which own their failure UX).
 *  - If the caller passes their own `signal`, they own the abort lifecycle —
 *    we never override it and no deadline is installed.
 *  - Browsers without AbortController (ancient webviews) → plain fetch().
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export class ApiTimeoutError extends Error {
  /** Marker for callers that want to branch on "was this a deadline hit?" */
  readonly timedOut = true as const;

  constructor(timeoutMs: number) {
    super(
      `Request timed out after ${timeoutMs} ms — the server did not respond (network too slow, connection dropped, or server unreachable).`,
    );
    this.name = "ApiTimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number | null | undefined = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  // No deadline requested (uploads, blob downloads) or no way to enforce one.
  if (!timeoutMs || timeoutMs <= 0 || typeof AbortController === "undefined") {
    return fetch(url, options);
  }

  // Caller-supplied signal wins — they own the abort lifecycle.
  if (options.signal) {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    // We installed the ONLY signal, so "aborted" here can only mean our
    // timer fired. Translating to ApiTimeoutError (instead of leaking the
    // browser's generic AbortError DOMException) gives the retry policy and
    // error toasts an honest, self-describing error.
    if (controller.signal.aborted) {
      throw new ApiTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    // Always clear — a dangling timer on an early-resolved request would
    // abort nothing (fetch already settled) but would keep Node/hidden
    // timers alive and burn a tick on every device going to sleep.
    clearTimeout(timer);
  }
}
