import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  WifiOff,
  Wrench,
} from 'lucide-react'
import { captureCaughtError } from '@/lib/errorCapture'

/**
 * Global crash screen for the router.
 *
 * WHY THIS EXISTS
 * Every page is rendered inside TanStack Router's CatchBoundary. When a
 * component throws (or a lazy route chunk resolves into a corrupted state —
 * the classic stale-PWA case), the router swaps the ENTIRE page for its
 * built-in default screen. This component replaces that default with a
 * branded, actionable screen.
 *
 * WHAT USERS ACTUALLY SEE (the important part — owner requirement: users
 * must NEVER catch a flashing "Something went wrong" during login or page
 * changes, must never see the app "freak them out", and recovery must
 * never depend on the user figuring out buttons):
 *
 *   1. QUIET FIRST, ALWAYS. For the first QUIET_MS the crash renders the
 *      exact RoutePending spinner — the same ring the app shows on every
 *      normal page load. Transient errors (a route loader that lost the
 *      network race, a query retried by React Query, a chunk that lands a
 *      beat late) recover and unmount INSIDE this window, so the user
 *      never sees any error at all.
 *
 *   2. ONE SILENT AUTO-RETRY for ordinary (non-stale) errors, guarded by a
 *      module-level 30s spacing so a truly broken page cannot loop. If the
 *      retry succeeds, the user saw only a normal-looking spinner.
 *
 *   3. STALE-BUILD CRASHES NEVER PAINT THE CARD UNTIL REPAIR IS EXHAUSTED.
 *      They escalate EXACTLY like the index.html boot shell (which has run
 *      this pattern since the Oct-13 PWA hardening): first a guarded soft
 *      reload; if the crash comes back, a silent DEEP REPAIR — unregister
 *      every service worker, delete every cache bucket, reload (localStorage
 *      is never touched, so users stay signed in); only if the crash STILL
 *      returns does the calm card appear — and its primary button then
 *      performs the same deep repair manually, so it can never dead-end.
 *      During reload/repair steps the screen is the quiet shell ("Updating
 *      the app…" / "Repairing the app…") — never an error dialog.
 *
 *      The boot shell only ever healed BOOT-level failures; route-level
 *      crashes (React.lazy payload corruption like Safari's "undefined is
 *      not an object (evaluating 'E._result.default')" when tapping
 *      Create Delivery) stopped at the soft-reload step, and a soft reload
 *      re-serves the same poisoned shell on long-lived devices — that is
 *      the "reload fixes nothing" loop. Escalation closes it.
 *
 *   4. Offline, no reload or repair can fetch anything new, and wiping
 *      caches offline would leave the PWA with nothing to paint. So while
 *      offline the card appears immediately with connection-first copy
 *      (same policy as the boot-shell watchdogs).
 *
 *   The underlying error message stays in a collapsible block so support
 *   can still see the real cause.
 */

/** Error signatures that mean "the JS bundle on the server changed under us"
 * or "a lazily-imported route chunk resolved into a corrupted payload". */
const STALE_CHUNK_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'unable to preload',
  'dynamically imported module',
  'vite:preloaderror',
  'chunkloaderror',
  'loading chunk',
  // React.lazy payload corruption. When a session resumes (installed PWA
  // reopened after days) a lazy route chunk can resolve into a broken
  // payload — stale build after a deploy, mixed chunk generations, or a
  // failed module fetch that some iOS WebKit versions fulfil with an empty
  // record instead of rejecting. React's minified internals then throw on
  // the payload's `_result.default` read:
  //   Safari: "undefined is not an object (evaluating 'E._result.default')"
  //   Chrome: "Cannot read properties of undefined (reading 'default')"
  // Owners reading the Safari dialog on a phone routinely transcribe it
  // WITHOUT the leading underscore ("E.result.default"), so the pattern
  // below deliberately matches both spellings. A fresh document (reload
  // or repair) rebuilds the payload — treat exactly like stale chunks.
  'result.default',
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

// ── Escalating stale-build recovery ───────────────────────────────────
//
// Recovery attempts are remembered (per session) in a sessionStorage
// ledger with a rolling window. The plan for each new stale crash:
//
//   no prior attempts           → soft reload (the standard fix)
//   reload already tried        → deep repair (unregister SW + clear caches)
//   repair already tried        → 'blocked' — show the actionable card
//
// The boot shell's watchdogs use the same reload-guard key, so a reload
// that just happened at boot level counts against the soft step here too.

const RECOVERY_LEDGER_KEY = 'route-error:stale-recoveries'
const RECOVERY_WINDOW_MS = 120_000

interface RecoveryEntry {
  t: number
  kind: 'reload' | 'repair'
}

function readRecoveryLedger(): RecoveryEntry[] {
  try {
    const raw = sessionStorage.getItem(RECOVERY_LEDGER_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    return parsed.filter(
      (e): e is RecoveryEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as RecoveryEntry).t === 'number' &&
        ((e as RecoveryEntry).kind === 'reload' ||
          (e as RecoveryEntry).kind === 'repair') &&
        now - (e as RecoveryEntry).t < RECOVERY_WINDOW_MS,
    )
  } catch {
    return []
  }
}

function recordRecovery(kind: RecoveryEntry['kind']): void {
  try {
    const entries = [...readRecoveryLedger(), { t: Date.now(), kind }]
    sessionStorage.setItem(RECOVERY_LEDGER_KEY, JSON.stringify(entries.slice(-6)))
  } catch {
    // Storage unavailable (private mode): the plan simply cannot remember.
    // The 30s reload guard still bounds the soft path, and the card still
    // appears for a persistent crash once reloadOnceForStaleBuild's own
    // guard blocks.
  }
}

/** The incident is over — the app booted and stayed up. Clears the ledger
 * so the NEXT incident (days later) starts gently at the soft-reload step.
 * Called from main.tsx after a stability window following a clean boot. */
export function clearStaleRecoveryLedger(): void {
  try {
    sessionStorage.removeItem(RECOVERY_LEDGER_KEY)
  } catch {
    // ignore — nothing to clear
  }
}

/**
 * Hard-reload the tab at most once per RELOAD_GUARD_MS window. The guard
 * key is SHARED with the index.html boot-shell watchdogs, so a reload
 * that just happened at boot level also blocks this one — one loop bound
 * across every layer. Used by the soft recovery step.
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

/**
 * The route-level twin of the boot shell's Watchdog-2 "nuclear fix":
 * unregister every service worker, delete every cache bucket, then reload.
 * localStorage is NEVER touched — auth tokens live there (dataQuery.ts)
 * and users must stay signed in through a repair.
 */
export async function repairAndReload(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        regs.map((r) => r.unregister().catch(() => undefined)),
      )
    }
  } catch {
    // ignore — best-effort
  }
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k).catch(() => undefined)))
  } catch {
    // ignore — best-effort
  }
  window.location.reload()
}

export type StaleRecoveryPlan = 'reload' | 'repair' | 'blocked'

/** True once a recovery has been started in THIS document — dedupes the
 * concurrent callers (vite:preloadError listener + this screen's effect)
 * so a single crash can never fire two recoveries. */
let recoveryStarted = false

/**
 * Run the escalating recovery for a stale-chunk crash. Safe to call from
 * both the router error screen and the vite:preloadError listener.
 *
 * Returns the plan taken. 'reload' and 'repair' navigate away shortly —
 * the caller keeps showing the quiet shell. 'blocked' means "do not
 * recover automatically" (offline, or repair already exhausted) — the
 * caller paints the actionable card.
 */
export function runStaleRecovery(
  onStep?: (step: 'reload' | 'repair') => void,
): StaleRecoveryPlan {
  // A recovery is already underway in this document — never double-fire.
  if (recoveryStarted) return 'reload'

  // Offline: reloading fetches the same cached shell and clearing caches
  // would leave the PWA nothing to paint until the network returns. Same
  // policy as the boot-shell watchdogs: surface the offline card instead.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'blocked'
  }

  const recent = readRecoveryLedger()

  // A deep repair already ran inside the window and the crash came back
  // anyway. Stop escalating — show the card whose primary button performs
  // the repair manually. This is the hard bound: reload → repair → card.
  if (recent.some((e) => e.kind === 'repair')) {
    return 'blocked'
  }

  recoveryStarted = true

  // First incident inside the window: the standard one-shot soft reload.
  if (recent.length === 0) {
    recordRecovery('reload')
    onStep?.('reload')
    if (reloadOnceForStaleBuild()) return 'reload'
    // Guard-blocked: something reloaded within the last 30s (boot-shell
    // watchdog, a previous layer's recovery) and the crash is STILL here.
    // A soft reload is demonstrably not fixing this device — escalate.
  }

  // Second incident (or guard-blocked soft reload): silent deep repair.
  recordRecovery('repair')
  onStep?.('repair')
  void repairAndReload().catch(() => window.location.reload())
  return 'repair'
}

/** How long an ordinary crash stays as the quiet RoutePending spinner
 * before the card is allowed to paint. Transient errors unmount inside
 * this window and are never seen. */
const QUIET_MS = 1_400

/** When the single silent auto-retry (ordinary errors) fires. */
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

export function RouteErrorScreen({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const staleChunk = isStaleChunkError(error)

  // Feed the persisted client error log. window.onerror never fires for
  // errors React (or the router boundary) caught, so without this hook a
  // route crash would be invisible to support diagnostics.
  useEffect(() => {
    captureCaughtError(error)
  }, [error])

  // 'blocked' = automatic recovery refused (offline / repair exhausted) —
  // the card is painted instead of the quiet shell.
  const [recoveryBlocked, setRecoveryBlocked] = useState(false)

  // Which recovery step is running — drives the quiet-shell label.
  const [recoverStep, setRecoverStep] = useState<'reload' | 'repair'>('reload')

  // User tapped "Repair & reopen" on the card (button feedback state).
  const [repairTapped, setRepairTapped] = useState(false)

  // Ordinary crash during its quiet grace window: the exact RoutePending
  // spinner. The silent auto-retry usually resolves the crash inside this
  // window and the page resumes — the user never learns an error happened.
  // (Stale crashes skip this gate: their recovery shell shows below and
  // may legitimately outlive QUIET_MS while repair runs.)
  const [quietElapsed, setQuietElapsed] = useState(false)

  useEffect(() => {
    if (staleChunk) {
      const plan = runStaleRecovery((step) => setRecoverStep(step))
      if (plan === 'blocked') setRecoveryBlocked(true)
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

  if (!staleChunk && !quietElapsed) {
    return <QuietShell text="Loading…" />
  }

  // Stale-chunk crash mid-recovery: quiet update/repair shell while the
  // automatic soft reload or deep repair navigates to a fresh document.
  if (staleChunk && !recoveryBlocked) {
    return (
      <QuietShell
        text={recoverStep === 'repair' ? 'Repairing the app…' : 'Updating the app…'}
      />
    )
  }

  const message =
    error instanceof Error ? error.message : String(error ?? 'Unknown error')

  const description = offline
    ? 'You appear to be offline. Check your connection and try again.'
    : staleChunk
      ? 'The app on your device is running an older copy that no longer matches the current version. Repairing clears the app\'s temporary files and reopens the latest version — your data and sign-in stay untouched.'
      : 'An unexpected error occurred while displaying this page. Your data is safe — retrying usually fixes it.'

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center bg-white px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
          {offline ? (
            <WifiOff className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          ) : staleChunk ? (
            <Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          ) : (
            <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          )}
        </div>

        <h1 className="text-xl font-semibold tracking-tight">
          {offline
            ? 'You are offline'
            : staleChunk
              ? "We couldn't load this page"
              : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          {staleChunk && !offline ? (
            // "Try again" (reset) is useless for a corrupted lazy payload —
            // it re-renders the same broken component in the same document
            // and re-throws instantly. The repair IS the fix, so it is the
            // primary action.
            <>
              <button
                onClick={() => {
                  setRepairTapped(true)
                  repairAndReload().catch(() => window.location.reload())
                }}
                disabled={repairTapped}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-900"
              >
                <Wrench className="h-4 w-4" />
                {repairTapped ? 'Repairing…' : 'Repair & reopen'}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                Reload page
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
