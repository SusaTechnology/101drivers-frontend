import { useCallback, useEffect } from 'react'
import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import DriverBottomNav from '@/components/layout/DriverBottomNav'
import type { DriverTabId } from '@/components/layout/DriverBottomNav'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'
import { socketJoinDriverFeed, socketLeaveDriverFeed, socketJoinUser, onDriverStatusUpdated } from '@/lib/socket'
import { trackSeenDeliveries } from '@/lib/driver-feed-tracker'
import { unlockAudio } from '@/lib/sound'
import { getUser, revalidateSession, useDataQuery } from '@/lib/tanstack/dataQuery'

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
  const user = getUser()
  const driverId = user?.profileId

  // ── Unlock browser audio on first interaction (covers ALL driver pages) ──
  // Delegates to sound.ts which preloads audio + preps AudioContext fallback.
  useEffect(() => {
    unlockAudio()
  }, [])

  // ── Join driver-feed socket room (persists across ALL driver pages) ──
  // Previously this was done per-dashboard-page, which meant leaving wallet/
  // preferences/active-delivery would drop the room and miss new-gig alerts.
  useEffect(() => {
    if (driverId) socketJoinDriverFeed()
    return () => socketLeaveDriverFeed()
  }, [driverId])

  // ── Seed the feed tracker so new-gig alerts work even if the driver
  //    never visits the dashboard (e.g., refreshes on wallet page). ──
  // Fetch just the delivery IDs from the feed so the race gate opens and
  // existing deliveries are marked "seen" — only genuinely new LISTED
  // deliveries will trigger the notification sound.
  const { data: seedData } = useDataQuery<any>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/deliveryRequests/driver/feed/${driverId}?page=1&limit=100&status=LISTED`,
    queryKey: ['driverFeedSeed', driverId],
    noFilter: true,
    enabled: Boolean(driverId),
    staleTime: Infinity, // only fetch once — we just need the IDs to seed
  })

  useEffect(() => {
    if (seedData?.items?.length) {
      trackSeenDeliveries(seedData.items.map((item: any) => item.deliveryId).filter(Boolean))
    }
  }, [seedData])

  // ── Authoritative session revalidation (the mid-session eviction) ──
  // localStorage's driverStatus is a snapshot from login time — fast for
  // first paint, but it can silently go stale when an admin approves,
  // suspends, rejects or holds the driver mid-session. The layout mounts
  // ONCE for all /driver/* pages, so this is the single central place to
  // re-sync: revalidateSession() fetches the authoritative session
  // (GET /auth/session — DB-fresh lifecycle fields; 30s freshness gate,
  // deduplicated, failure-safe) and lands server truth in the cache. If
  // the CURRENT status is no longer APPROVED, the driver is sent to the
  // status board, which renders the fresh status card. The realtime
  // driver:status-updated ping (an admin acted while the app is open)
  // triggers the same revalidation immediately — the ping is a signal,
  // the refetched session is the truth. First paint still uses
  // localStorage, so approved drivers never see a flicker or a spinner.
  const navigate = useNavigate()

  const evictIfNotApproved = useCallback(
    (fresh: ReturnType<typeof getUser>) => {
      if (!fresh?.roles?.includes('DRIVER')) return
      if (fresh.driverStatus && fresh.driverStatus !== 'APPROVED') {
        navigate({ to: '/driver-application-submitted' })
      }
    },
    [navigate]
  )

  useEffect(() => {
    if (!driverId) return
    // Own-user room: carries notification events AND the lifecycle pings.
    socketJoinUser()
    let cancelled = false
    revalidateSession({ reason: 'driver-layout-mount' }).then((fresh) => {
      if (!cancelled) evictIfNotApproved(fresh)
    })
    const offStatusPing = onDriverStatusUpdated(() => {
      revalidateSession({ force: true, reason: 'driver-status-event' }).then((fresh) => {
        if (!cancelled) evictIfNotApproved(fresh)
      })
    })
    return () => {
      cancelled = true
      offStatusPing()
    }
  }, [driverId, evictIfNotApproved])

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
