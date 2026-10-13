import type { QueryClient } from '@tanstack/react-query'

/**
 * Resume-sync — what happens when an app tab/PWA that sat idle comes back.
 *
 * THE PROBLEM (owner requirement #1: "whether it stays open and waits after
 * 3 hours, it just loads and does things"):
 *
 *   A driver phone (or dealer laptop) left open on the dashboard for hours
 *   used to come back frozen in the past: `refetchOnWindowFocus: false`
 *   meant no query EVER revalidated on focus, so after 3 hours the screen
 *   still showed 3-hour-old deliveries; the tracking socket was silently
 *   dead after iOS suspended the page; and the first action the user took
 *   raced a 401 (expired access token) before the single-flight refresh
 *   repaired the session.
 *
 * THE DESIGN — one controlled burst, not a focus-spam:
 *
 *   Global `refetchOnWindowFocus: true` was deliberately NOT used: it
 *   revalidates on EVERY tab switch, which for a data-heavy operations app
 *   means surprise spinner storms whenever data happens to be stale. Instead
 *   the app listens for three explicit "the world moved on" signals and runs
 *   ONE revalidation burst per signal:
 *
 *     1. visibilitychange: page was hidden for >= hiddenRefetchAfterMs
 *        (5 minutes) and is visible again  — the 3-hour-dash-phone case.
 *        Quick app-switches (under the threshold) do nothing, so normal
 *        multitasking stays exactly as cheap as before.
 *     2. online: connectivity returned after an offline period (garage,
 *        elevator, dead zone) — refetch what the failed/retried queries
 *        could not get while offline.
 *     3. pageshow with event.persisted: the page was restored from the
 *        back/forward cache (bfcache) after possibly being suspended.
 *
 *   The burst itself (see `resume()`):
 *     - queryClient.invalidateQueries({ refetchType: 'active' }) — marks ALL
 *       queries stale (so inactive ones refetch on next mount too) and
 *       refetches the mounted ones once, deduplicated per query key.
 *     - queryClient.resumePausedMutations() — mutations queued while offline
 *       (TanStack offline pause) flush as soon as connectivity is back.
 *     - socket nudge — dynamically imported so socket.io-client stays OUT of
 *       the main bundle; reconnects instantly instead of waiting for the
 *       engine's post-resume heartbeat to notice the dead TCP connection.
 *
 *   Expiry of the access token during the idle window needs NOTHING here:
 *   the first refetch gets a 401, the fetch wrapper runs the single-flight
 *   refresh (refreshShared), and every racing query replays with the new
 *   token — one silent refresh, zero "session expired" toasts (Task 27).
 *
 *   If iOS fully KILLED the page during the idle window, none of this
 *   matters — the relaunch is a fresh boot with network-first navigations
 *   and the silent boot self-heal (fa3f578).
 */

const DEFAULT_HIDDEN_REFETCH_AFTER_MS = 5 * 60 * 1000

let installed = false

export interface ResumeSyncOptions {
  /** Minimum hidden duration before a visible transition counts as a "came back later" resume. */
  hiddenRefetchAfterMs?: number
}

export function installResumeSync(
  queryClient: QueryClient,
  options: ResumeSyncOptions = {}
): () => void {
  // Prerender (react-snap runs the bundle in headless Chromium, but be safe
  // for any non-DOM context) and double-install guard.
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  if (installed) return () => {}
  installed = true

  const hiddenRefetchAfterMs = options.hiddenRefetchAfterMs ?? DEFAULT_HIDDEN_REFETCH_AFTER_MS

  let hiddenAt = 0

  const resume = (reason: string): void => {
    // Offline right now — the `online` listener will fire the burst when
    // connectivity actually returns; refetching into a dead network would
    // just multiply failed requests.
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    // resumePausedMutations never rejects; invalidateQueries resolves after
    // the refetches settle — swallow it, queries own their error/retry UX.
    queryClient.resumePausedMutations()
    void Promise.resolve(
      queryClient.invalidateQueries({ refetchType: 'active' })
    ).catch(() => {})

    // Dynamic import keeps socket.io-client out of the main chunk; if the
    // chunk itself is stale (mid-deploy edge), the failure is silent —
    // the socket engine's own reconnect remains the safety net.
    void import('@/lib/socket')
      .then((m) => m.nudgeSocketReconnect())
      .catch(() => {})

    console.log(`[ResumeSync] Revalidated app state (${reason})`)
  }

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    // Visible again.
    const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0
    hiddenAt = 0
    if (hiddenFor >= hiddenRefetchAfterMs) resume('visibility')
  }

  const onPageshow = (event: PageTransitionEvent): void => {
    // bfcache restore: the page was frozen, possibly for hours, and NO
    // visibilitychange may have fired for the hidden phase on some engines.
    if (event.persisted) resume('bfcache')
  }

  const onOnline = (): void => resume('online')

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', onPageshow)
  window.addEventListener('online', onOnline)

  // Disposer — lets hot reloads / future StrictMode mounts re-install
  // cleanly, and lets the regression harness isolate scenarios.
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', onPageshow)
    window.removeEventListener('online', onOnline)
    installed = false
  }
}
