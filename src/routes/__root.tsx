import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect } from 'react'
import { PWAInstallPrompt } from '../components/pwa/PWAInstallPrompt'

/**
 * Pathname prefixes that should NOT be indexed by search engines.
 *
 * Even though robots.txt blocks these URLs from being crawled, we also
 * set a `noindex, nofollow` meta tag at runtime as a belt-and-suspenders
 * measure. This catches cases where:
 *   - A bot ignores robots.txt
 *   - A user shares a direct link to a secure page that gets indexed
 *   - The site is embedded in an iframe somewhere
 *
 * Public-facing routes (home, about, privacy, terms, help, driver-onboarding,
 * driver-signin, dealer-signin/signup, individual-signup) are NOT in this list
 * and default to `index, follow`.
 */
const NOINDEX_PREFIXES = [
  '/admin-',
  '/dealer-dashboard',
  '/dealer-create-delivery',
  '/dealer-delivery-details',
  '/dealer-drafts',
  '/dealer-edit-delivery',
  '/dealer-edit-draft',
  '/dealer-onboarding',
  '/dealer-review-delivery',
  '/dealer-settings',
  '/dealer-support-detail',
  '/dealer-support-list',
  '/dealer-support-request',
  '/driver/',            // driver dashboard sub-routes
  '/driver-active',
  '/driver-booked-later',
  '/driver-completed',
  '/driver-completed-details',
  '/driver-inbox',
  '/driver-issue-report',
  '/driver-job-details',
  '/driver-menu',
  '/driver-onboarding-complete',
  '/driver-pickup-checklist',
  '/driver-preferences',
  '/driver-proof-cam',
  '/driver-repositioning',
  '/driver-starting-location',
  '/driver-support-detail',
  '/driver-support-list',
  '/driver-verify-email',
  '/driver-wallet',
  '/driver-application-submitted',
  '/auth/admin-signin',
  '/auth/reset-password',
  '/individual-verify-email',
  '/map-test',
  '/insurance-portal',
  '/live-track',
  '/track/',
  '/test-referral/',  // public referral-lookup pages — shareable but not indexable
  '/quote-details',
  '/quote-confirmation',
]

/**
 * Sync the `<meta name="robots">` tag with the current route.
 *
 * On public routes: content="index, follow" (default — searchable).
 * On secure routes: content="noindex, nofollow" (never indexed).
 *
 * The meta tag is created on first load if it doesn't exist (index.html
 * doesn't include one by default), then updated whenever the route changes.
 */
function useRobotsMeta() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    const isSecure = NOINDEX_PREFIXES.some((prefix) =>
      prefix.endsWith('/')
        ? pathname.startsWith(prefix)
        : pathname === prefix || pathname.startsWith(prefix + '/')
    )

    // Find or create the meta tag
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    meta.content = isSecure ? 'noindex, nofollow' : 'index, follow'
  }, [pathname])
}

export const Route = createRootRoute({
  component: () => {
    useRobotsMeta()
    return (
      <>
        <Outlet />
        <PWAInstallPrompt />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      </>
    )
  },
})
