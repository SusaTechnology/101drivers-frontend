// classifyApiError — turn any thrown request error into a small,
// human-facing classification so the UI can show a CAUSE-SPECIFIC card
// instead of one generic "Something went wrong" for every failure.
//
// Detection sources, in order of reliability:
//   1. error.status — dataQuery's parseError attaches the numeric HTTP
//      status to every thrown API error (ParsedApiError).
//   2. navigator.onLine + browser network signatures — transport failures
//      surface as TypeError with browser-specific wording:
//        Chrome:  "Failed to fetch"
//        Safari:  "Load failed" / "The Internet connection appears to be
//                 offline" / "The network connection was lost"
//        Firefox: "NetworkError when attempting to fetch resource."
//   3. Message keywords — some layers rethrow without the status but keep
//      the server's message ("Unauthorized", statusText, timeout words).
//
// DESIGN RULES (agreed with product):
//   • NEVER auto-logout / auto-redirect on 401. authFetch already refreshed
//     the token and retried before a 401 reaches the UI, so a surfaced 401
//     means the session is genuinely dead — the UI offers a "Sign in
//     again" BUTTON instead of forcing navigation.
//   • Retryable = a manual/auto retry can plausibly succeed (offline,
//     server 5xx, transport). Permanent kinds (403, 404, dead session)
//     don't offer Retry so users don't hammer a wall.

export type ApiErrorKind =
  | 'offline'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'server'
  | 'network'
  | 'unknown'

export interface ClassifiedApiError {
  kind: ApiErrorKind
  /** Short headline for the error card. */
  title: string
  /** One-sentence, non-technical explanation with guidance. */
  description: string
  /** Whether a retry can plausibly succeed. */
  retryable: boolean
  /** True when the session is truly dead — UI shows a "Sign in again"
      button (never an automatic redirect). */
  signInAgain: boolean
}

const NETWORK_SIGNATURES = [
  'failed to fetch',
  'load failed',
  'networkerror',
  'network request failed',
  'fetch failed',
  'err_network',
  'timed out',
  'timeout',
]

// Offline-specific wording — matched separately because offline gets its
// own card with auto-retry-on-reconnect.
const OFFLINE_SIGNATURES = [
  'internet connection appears to be offline',
  'network connection was lost',
  'err_internet',
]

const UNAUTHORIZED_SIGNATURES = [
  'unauthorized',
  'session expired',
  'token expired',
  'invalid token',
  'missing token',
  'not authenticated',
]

const SERVER_SIGNATURES = [
  'internal server error',
  'server error',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
]

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase()
  return String(error ?? '').toLowerCase()
}

function statusOf(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const n = Number((error as { status?: unknown }).status)
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

export function classifyApiError(error: unknown): ClassifiedApiError {
  const status = statusOf(error)
  const message = messageOf(error)
  const has = (needle: string) => message.includes(needle)
  const hasCode = (code: number) => new RegExp(`\\b${code}\\b`).test(message)

  // Offline first — it beats every HTTP classification, and retrying while
  // offline is pointless (the card auto-retries on reconnect instead).
  if (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    OFFLINE_SIGNATURES.some(has)
  ) {
    return {
      kind: 'offline',
      title: "You're offline",
      description:
        "Check your connection — we'll retry automatically as soon as you're back online.",
      retryable: true,
      signInAgain: false,
    }
  }

  // 401 — token refresh + retry already happened inside authFetch, so a
  // surfaced 401 means the session is really gone. Offer the button; do
  // NOT log the user out or navigate automatically.
  if (
    status === 401 ||
    hasCode(401) ||
    UNAUTHORIZED_SIGNATURES.some(has)
  ) {
    return {
      kind: 'unauthorized',
      title: 'Your session expired',
      description:
        'For your security, sign in again to continue. Nothing you did was lost.',
      retryable: false,
      signInAgain: true,
    }
  }

  if (status === 403 || hasCode(403) || has('forbidden')) {
    return {
      kind: 'forbidden',
      title: 'No access',
      description:
        "Your account doesn't have permission for this. Contact support if you think this is a mistake.",
      retryable: false,
      signInAgain: false,
    }
  }

  if (status === 404 || hasCode(404) || has('not found')) {
    return {
      kind: 'notFound',
      title: 'Not found',
      description:
        'This item may have been removed, or the link is out of date.',
      retryable: false,
      signInAgain: false,
    }
  }

  if ((Number.isFinite(status) && status >= 500) || SERVER_SIGNATURES.some(has)) {
    return {
      kind: 'server',
      title: 'Our server had a problem',
      description: "This one's on our side — please try again in a moment.",
      retryable: true,
      signInAgain: false,
    }
  }

  if (NETWORK_SIGNATURES.some(has)) {
    return {
      kind: 'network',
      title: 'Connection problem',
      description: "We couldn't reach the server. Retrying usually fixes this.",
      retryable: true,
      signInAgain: false,
    }
  }

  return {
    kind: 'unknown',
    title: 'Something went wrong',
    description:
      'An unexpected error occurred while loading this. Retrying usually fixes it.',
    retryable: true,
    signInAgain: false,
  }
}
