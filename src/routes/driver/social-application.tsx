import { createFileRoute } from '@tanstack/react-router'
import { SocialDriverApplication } from '@/components/auth/SocialDriverApplication'

/**
 * Driver application for social-registered identities. Reachable only with a
 * Better Auth session (the component verifies it on mount and redirects to
 * /driver-signin otherwise). The backend enforces the SAME business gates as
 * the legacy email signup — California ZIP + age 25+ — and creates the
 * Driver row as WAITLISTED.
 */
export const Route = createFileRoute('/driver/social-application')({
  component: SocialDriverApplicationPage,
})

function SocialDriverApplicationPage() {
  return <SocialDriverApplication />
}
