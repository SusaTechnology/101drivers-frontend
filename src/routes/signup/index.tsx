import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

/**
 * /signup — deep-link alias for the individual (personal customer) signup.
 *
 * The owner's referral spec references links like /signup?ref=joesgarage.
 * This route forwards to the real signup form at /auth/individual-signup,
 * preserving ALL query params (notably ?ref=CODE, which the signup card's
 * ReferralCodeWidget consumes on mount to land in the locked chip state).
 */
export const Route = createFileRoute('/signup/')({
  component: SignupAliasRoute,
})

function SignupAliasRoute() {
  useEffect(() => {
    const search = window.location.search
    window.location.replace(`/auth/individual-signup${search}`)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
        Taking you to signup…
      </p>
    </div>
  )
}
