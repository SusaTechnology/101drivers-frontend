import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  CloudOff,
  LockKeyhole,
  RefreshCw,
  SearchX,
  ServerCrash,
  ShieldAlert,
  WifiOff,
} from 'lucide-react'
import { classifyApiError, type ApiErrorKind } from '@/lib/apiErrorClass'

/**
 * InlineErrorCard — cause-specific, in-page failure banner.
 *
 * Replaces the old pattern of swapping the ENTIRE page (nav and all) for a
 * centered error card whenever a data query fails. The page shell stays
 * alive; this card renders inside the content area and explains WHAT went
 * wrong (offline / session expired / no access / not found / our server /
 * connection problem) with a matching action.
 *
 * Behavior per classification (see lib/apiErrorClass.ts):
 *   • offline      — offers auto-retry: listens for the browser 'online'
 *                    event and calls onRetry() the moment the connection
 *                    returns, before the user even taps anything.
 *   • retryable    — shows a "Try again" button with a spinning state.
 *   • signInAgain  — shows a "Sign in again" BUTTON. We never auto-redirect
 *                    and never auto-logout (explicit product decision).
 *   • permanent    — no retry button (403/404/dead session) so users don't
 *                    hammer a wall.
 */

const ICONS: Record<ApiErrorKind, typeof AlertTriangle> = {
  offline: WifiOff,
  network: CloudOff,
  unauthorized: LockKeyhole,
  forbidden: ShieldAlert,
  notFound: SearchX,
  server: ServerCrash,
  unknown: AlertTriangle,
}

export default function InlineErrorCard({
  error,
  onRetry,
  retrying = false,
  title,
  className = '',
}: {
  error: unknown
  /** Called by the Try again button and by the automatic
      retry-on-reconnect when offline. Omit only when there is truly
      nothing to reload. */
  onRetry?: () => void
  /** True while the parent query is refetching — shows the spinner state. */
  retrying?: boolean
  /** Optional context headline ("Couldn't load your deliveries"). Falls
      back to the classification's own headline. */
  title?: string
  className?: string
}) {
  const info = classifyApiError(error)
  const Icon = ICONS[info.kind]
  const navigate = useNavigate()

  // Offline: the moment the device reconnects, retry the failed query —
  // most "errors" on mobile are tunnel/Wi-Fi blips that fix themselves
  // within seconds, so the user usually never has to tap anything.
  useEffect(() => {
    if (info.kind !== 'offline' || !onRetry) return
    const handleOnline = () => onRetry()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [info.kind, onRetry])

  return (
    <div
      role="alert"
      className={`rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            {title ?? info.title}
          </h3>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {info.description}
          </p>
          {(info.retryable || info.signInAgain) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {info.retryable && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={retrying}
                  className="inline-flex items-center gap-2 rounded-xl bg-lime-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-lime-400 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`}
                  />
                  {retrying ? 'Retrying…' : 'Try again'}
                </button>
              )}
              {info.signInAgain && (
                <button
                  type="button"
                  onClick={() => navigate({ to: '/signin' })}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-900"
                >
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Sign in again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
