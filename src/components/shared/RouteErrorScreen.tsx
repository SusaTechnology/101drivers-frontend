import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw, WifiOff } from 'lucide-react'

/**
 * Global crash screen for the router.
 *
 * WHY THIS EXISTS
 * Every page is rendered inside TanStack Router's CatchBoundary. When a
 * component throws (or a lazy route chunk fails to import — the classic
 * "missing file after deploy" case), the router swaps the ENTIRE page for
 * its built-in default screen: a nearly empty white page with a tiny icon
 * and a "Show Error" button (details hidden in production). To users that
 * looks like "the page turned clean white and says something" with no way
 * to recover except a blind refresh.
 *
 * This component replaces that default with a branded, actionable screen:
 *   - Plain-language explanation of what happened.
 *   - "Try again" re-renders the route; "Reload page" hard-refreshes.
 *   - Stale-chunk errors (deploy replaced hashed files while a tab was
 *     open) auto-reload ONCE so the user lands on the new build without
 *     doing anything — with a sessionStorage guard so a genuinely broken
 *     deploy can't put the tab into an infinite reload loop.
 *   - The underlying error message is kept in a collapsible block so
 *     support can still see the real cause.
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

  // Auto-recover from stale-chunk crashes (deploy happened mid-session).
  useEffect(() => {
    if (staleChunk) {
      reloadOnceForStaleBuild()
    }
  }, [staleChunk])

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
