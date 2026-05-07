import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import DriverBottomNav from '@/components/layout/DriverBottomNav'
import type { DriverTabId } from '@/components/layout/DriverBottomNav'

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
    <>
      <Outlet />
      {!hideNav && <DriverBottomNav activeTab={getActiveTab(pathname)} />}
    </>
  )
}

export const Route = createFileRoute('/driver')({
  component: DriverLayout,
})
