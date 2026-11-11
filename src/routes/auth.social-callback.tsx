import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  driverLandingPathForContext,
  refreshBetterAuthContext,
} from '@/lib/betterAuth/ba-session'

/**
 * Social callback landing route — Better Auth redirects here after the
 * provider round-trip (Google / Microsoft / Apple / Yahoo). The session is
 * already established (HTTP-only cookie); this page mirrors it into the
 * legacy localStorage cache via driver-context and routes by driver state:
 *   no Driver profile yet → social application form
 *   onboarding pending    → onboarding-complete?token=…
 *   waitlisted/pending    → application-submitted screen
 *   approved              → dashboard
 * OAuth errors arrive as ?error=… from Better Auth — surfaced, never retried
 * in a loop. No open redirects: every target is an app-internal path.
 */
export const Route = createFileRoute('/auth/social-callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    error_description:
      typeof search.error_description === 'string'
        ? search.error_description
        : undefined,
  }),
  component: SocialCallbackPage,
})

function SocialCallbackPage() {
  const { error, error_description } = Route.useSearch()
  const navigate = useNavigate()
  const [started, setStarted] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (error || startedRef.current) return
    startedRef.current = true
    setStarted(true)
    refreshBetterAuthContext()
      .then((context) => {
        const path = driverLandingPathForContext(context)
        // Full navigation on purpose — clean app state after provider auth.
        window.location.assign(path)
      })
      .catch((err: unknown) => {
        // Includes the canonical "Session expired" throw from the bridge —
        // the cache is already cleared; send the driver to sign-in.
        toast.error(err instanceof Error ? err.message : 'Sign-in failed')
        navigate({ to: '/driver-signin' })
      })
  }, [error, navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Sign-in didn&apos;t complete
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {error_description ||
              'The sign-in provider returned an error. You can try again — nothing was changed on your account.'}
          </p>
          <Button
            onClick={() => navigate({ to: '/driver-signin' })}
            className="rounded-xl"
          >
            Back to driver sign-in
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-semibold">
          {started ? 'Finishing sign-in…' : 'Preparing…'}
        </p>
      </div>
    </div>
  )
}
