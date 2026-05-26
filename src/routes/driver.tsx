import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import DriverBottomNav from '@/components/layout/DriverBottomNav'
import type { DriverTabId } from '@/components/layout/DriverBottomNav'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

// Routes that should NOT show the bottom nav
const HIDE_NAV_ROUTES = [
  '/driver/signin',
  '/driver/onboarding',
  '/driver/proof-cam',
  '/driver/job-details',
  '/driver/starting-location',
  '/driver/pickup-checklist',
]

function getActiveTab(pathname: string): DriverTabId {
  if (pathname.startsWith('/driver/booked-later')) return 'my-bookings'
  if (pathname.startsWith('/driver/active')) return 'in-progress'
  if (pathname.startsWith('/driver/completed')) return 'completed'
  return 'available'
}

function DriverLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const hideNav = HIDE_NAV_ROUTES.some((route) => pathname.startsWith(route))

  return (
    // <>
    //   <Outlet />
    //   {!hideNav && <DriverBottomNav activeTab={getActiveTab(pathname)} />}
    // </>
        <DriverRouteGuard>
      <div className="flex flex-col h-dvh" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* Page Content — pb accounts for bottom nav height + iPhone home indicator */}
        <div className="flex-1 overflow-auto" style={{ paddingBottom: hideNav ? 'env(safe-area-inset-bottom, 0px)' : 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <Outlet />
        </div>

        {/* Bottom Nav */}
      {!hideNav && <DriverBottomNav activeTab={getActiveTab(pathname)} />}

      </div>
    </DriverRouteGuard>
  )
}

export const Route = createFileRoute('/driver')({
  component: DriverLayout,
})
