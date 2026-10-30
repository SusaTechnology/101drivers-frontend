import { Outlet, createRootRoute, redirect, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect, useLayoutEffect } from 'react'
import { PWAInstallPrompt } from '../components/pwa/PWAInstallPrompt'
import { NotFoundScreen } from '../components/shared/NotFoundScreen'
import { PageViewTracker } from '../components/shared/PageViewTracker'
import { AdminShell } from '../components/shared/layout/AdminShell'
import { ensureAdminGateUnlocked, isAdminGatePath } from '../lib/adminGate'

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

/**
 * Admin shell push gate — the router-root half of the "page swings
 * sideways" fix (ERP sidebar, app-sidebar.tsx).
 *
 * The sidebar publishes its rail width as the --app-sidebar-push variable
 * and styles.css converts it into body padding-left on desktop. That
 * padding must be active EXACTLY while an admin-shell page is displayed.
 * The sidebar itself cannot own the on/off decision: it unmounts on every
 * route change (each admin page renders <Navbar> itself), including the
 * pending windows (<RoutePending> shows for every >150ms navigation), so
 * a component-lifecycle reset used to drop the padding mid-navigation and
 * swing the whole page. The ROOT layout never unmounts between routes and
 * re-renders with the new pathname the moment navigation starts, so it
 * owns the gate instead: pathname starts with /admin = admin shell on.
 * Every route that renders the admin navbar/sidebar starts with /admin
 * (verified across all 39 testNavbar importers). The width VALUE stays
 * owned by the sidebar (it knows the collapsed state); index.html
 * pre-seeds both pre-paint.
 */
function useAdminShellGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useLayoutEffect(() => {
    document.documentElement.dataset.adminShell = pathname.startsWith('/admin')
      ? 'on'
      : 'off'
  }, [pathname])
}

/**
 * Admin gate — the shared-secret door in front of the admin UI.
 *
 * Nobody without the gate cookie (or a valid ?key= link that sets it)
 * may even SEE the admin screens: /admin* and /auth/admin-signin are
 * bounced to the public landing page before anything renders. The
 * backend owns the key/cookie (src/admin-gate on the API side); this
 * beforeLoad only asks it "is the door open?".
 *
 * Runs in beforeLoad (not in a component) so a locked visitor never
 * sees the admin chrome flash — the navigation is refused outright.
 */
async function adminGateBeforeLoad(location: {
  pathname: string
  search: unknown
}): Promise<void> {
  const pathname = location.pathname
  if (!isAdminGatePath(pathname)) return

  const search = (location.search ?? {}) as Record<string, unknown>
  const accessKey =
    typeof search.key === 'string' && search.key.length > 0
      ? search.key
      : undefined

  if (accessKey) {
    const unlocked = await ensureAdminGateUnlocked(accessKey)
    if (!unlocked) {
      // Wrong or expired key — indistinguishable from no key at all.
      throw redirect({ to: '/', replace: true })
    }
    // Door is open — strip the key from the address bar so it doesn't
    // linger in the URL/history after first use. Every OTHER search
    // param is preserved (admin deep links carry userId & co).
    const { key: _usedKey, ...restSearch } = search
    throw redirect({
      to: pathname,
      replace: true,
      search: restSearch,
      // `pathname` is any /admin* route — the router's typed-`to`
      // generic can't know these are valid internal paths.
    } as never)
  }

  if (!(await ensureAdminGateUnlocked())) {
    throw redirect({ to: '/', replace: true })
  }
}

export const Route = createRootRoute({
  beforeLoad: ({ location }) => adminGateBeforeLoad(location),
  // Branded 404 — TanStack Router renders this inside the root layout
  // whenever the URL matches no route (the devtools + PWA prompt stay up).
  notFoundComponent: NotFoundScreen,
  component: () => {
    useRobotsMeta()
    useAdminShellGate()
    return (
      <>
        {/* Product analytics (Task 72) — one PAGE_VIEW per navigation,
            fully silent, renders nothing. */}
        <PageViewTracker />
        {/* Persistent admin chrome (navbar + ERP sidebar). Mounts once when
            the user enters /admin* and STAYS MOUNTED across admin→admin
            navigations — pages no longer render their own <Navbar>, so the
            shell (and the RoutePending windows) swap only the content below
            it. Renders nothing outside /admin* and on the four
            bespoke-header admin pages. */}
        <AdminShell />
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
