import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw, WifiOff } from 'lucide-react'

/**
 * Global crash screen for the router.
 *
 * WHY THIS EXISTS
 * Every page is rendered inside TanStack Router's CatchBoundary. When a
 * component throws (or a lazy route chunk fails to import — the classic
 * "missing file after deploy" case), the router swaps the ENTIRE page for
 * its built-in default screen. This component replaces that default with
 * a branded, actionable screen.
 *
 * WHAT USERS ACTUALLY SEE (the important part — owner requirement: users
 * must NEVER catch a flashing "Something went wrong" during login or page
 * changes, and must never see the app "freak them out"):
 *
 *   1. QUIET FIRST, ALWAYS. For the first QUIET_MS the crash renders the
 *      exact RoutePending spinner — the same ring the app shows on every
 *      normal page load. Transient errors (a route loader that lost the
 *      network race, a query retried by React Query, a chunk that lands a
 *      beat late) recover and unmount INSIDE this window, so the user
 *      never sees any error at all — this is what killed the reported
 *      "it flashes and goes away too fast" dialogs.
 *
 *   2. ONE SILENT AUTO-RETRY. Non-stale errors get a single reset() after
 *      AUTO_RESET_MS (guarded by a module-level 30s spacing so a truly
 *      broken page cannot loop). If the retry succeeds, the user saw only
 *      a normal-looking spinner. Most login/page-change failures are
 *      exactly this class.
 *
 *   3. ONLY a failure that survived the silent retry paints the full card
 *      — after QUIET_MS, so it can never flash.
 *
 *   4. Stale-chunk errors (deploy replaced hashed files under an open
 *      tab, or the first chunk fetch after waking from idle lost the race
 *      against the reconnecting network) NEVER paint the card at all —
 *      they show a quiet "Updating the app…" shell while the automatic
 *      one-shot reload runs. If the reload is guard-blocked (a reload
 *      already happened within the last 30s — possible sign of a
 *      genuinely broken deploy), the full card still appears so the user
 *      can act manually.
 *
 *   The underlying error message is kept in a collapsible block so
 *   support can still see the real cause.
 */

/** Error signatures that mean "the JS bundle on the server changed under us". */
const STALE_CHUNK_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'unable to preload',
  'dynamically imported module',
  'vite:preloaderror',
  'chunkloaderror',
  'loading chunk',
  // React.lazy resolution failures. When a session resumes (PWA reopened
  // after days) and a lazy route chunk resolves WITHOUT a module namespace
  // — stale build after a deploy, or the wake-from-idle network race —
  // React's minified internals throw on `X._result.default`:
  //   Safari: "undefined is not an object (evaluating 'E._result.default')"
  //   Chrome: "Cannot read properties of undefined (reading 'default')"
  // One reload fixes these, so treat them exactly like stale chunks and
  // take the quiet auto-reload path instead of the scary card.
  '_result.default',
  "reading 'default'",
]

function isStaleChunkError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${error.message} ${error.stack ?? ''}`
      : String(error ?? '')
  const lowered = raw.toLowerCase()
  return STALE_CHUNK_PATTERNS.some((p) => lowered.includes(p))
}

const RELOAD_GUARD_KEY = 'route-error:auto-reload-at'
const RELOAD_GUARD_MS = 30_000

/** How long a crash stays as the quiet RoutePending spinner before the
 * card is allowed to paint. Transient errors unmount inside this window
 * and are never seen. */
const QUIET_MS = 1_400

/** When the single silent auto-retry fires. */
const AUTO_RESET_MS = 900

/** Minimum spacing between silent auto-retries across remounts — prevents
 * a persistently-throwing route from looping reset() forever. */
const AUTO_RESET_SPACING_MS = 30_000

/** Module-level memory of the last silent retry. Survives remounts of the
 * error component (TanStack Router re-creates it on every re-catch). */
let lastAutoResetAt = 0

/**
 * The quiet recovery shell — pixel-identical to RoutePending (and to the
 * index.html boot shell): slate background, 40px lime ring, one small
 * bold label. Every "the app hit a bump" state reads as ONE spinner.
 */
function QuietShell({ text = 'Loading…' }: { text?: string }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400"
      role="status"
      aria-live="polite"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-lime-500" />
      <p className="text-sm font-bold">{text}</p>
    </div>
  )
}

/**
 * Hard-reload the tab at most once per RELOAD_GUARD_MS window.
 * Used by both the error screen (auto) and the vite:preloadError listener
 * so a transient failure recovers silently but a persistent one doesn't
 * loop forever.
 */
export function reloadOnceForStaleBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_GUARD_MS) {
      return false
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    // sessionStorage unavailable (private mode / storage disabled) —
    // still reload; the guard just can't protect against a loop here.
  }
  window.location.reload()
  return true
}

export function RouteErrorScreen({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const staleChunk = isStaleChunkError(error)

  // True when the automatic one-shot reload could NOT run because the
  // 30s reload guard blocked it — possible sign of a genuinely broken
  // deploy. Fall back to the full actionable card in that case.
  const [reloadBlocked, setReloadBlocked] = useState(false)

  // The crash stays a quiet spinner for QUIET_MS before the card may
  // paint. Transient errors unmount inside the window and are never seen.
  const [quietElapsed, setQuietElapsed] = useState(false)

  // Auto-recover from stale-chunk crashes (deploy happened mid-session,
  // or the first chunk fetch after waking from idle lost the network
  // race). The reload is the only reliable recovery — a failed module
  // import stays failed inside the page's module map, so retrying the
  // import in-document does not work; a fresh document does.
  useEffect(() => {
    if (staleChunk) {
      const reloaded = reloadOnceForStaleBuild()
      if (!reloaded) setReloadBlocked(true)
      return
    }

    // One silent auto-retry for every other crash. Loader failures and
    // render hiccups during login / page changes are overwhelmingly
    // transient; retrying once inside the quiet window makes them
    // invisible. The module-level timestamp guarantees a persistent
    // error can never loop: on a re-catch the retry is skipped and the
    // card paints after QUIET_MS.
    const now = Date.now()
    if (now - lastAutoResetAt >= AUTO_RESET_SPACING_MS) {
      lastAutoResetAt = now
      const timer = setTimeout(() => reset(), AUTO_RESET_MS)
      return () => clearTimeout(timer)
    }
  }, [staleChunk, reset])

  useEffect(() => {
    const timer = setTimeout(() => setQuietElapsed(true), QUIET_MS)
    return () => clearTimeout(timer)
  }, [])

  // Stale-chunk crash: quiet update shell while the auto-reload runs.
  if (staleChunk && !reloadBlocked) {
    return <QuietShell text="Updating the app…" />
  }

  // Any other crash during its quiet grace window: the exact RoutePending
  // spinner. The silent auto-retry usually resolves the crash inside this
  // window and the page resumes — the user never learns an error happened.
  if (!quietElapsed) {
    return <QuietShell text="Loading…" />
  }

  const message =
    error instanceof Error ? error.message : String(error ?? 'Unknown error')

  const description = offline
    ? 'You appear to be offline. Check your connection and try again.'
    : staleChunk
      ? 'The app was just updated and this page was loaded from an older version. We are reloading the latest build for you…'
      : 'An unexpected error occurred while displaying this page. Your data is safe — retrying usually fixes it.'

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center bg-white px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
          {offline ? (
            <WifiOff className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          ) : (
            <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          )}
        </div>

        <h1 className="text-xl font-semibold tracking-tight">
          {offline ? 'You are offline' : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-slate-900"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Reload page
          </button>
        </div>

        {message && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300">
              Technical details
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
