import { createFileRoute, redirect } from '@tanstack/react-router'
import LandingPage from '@/components/pages/homePage'
import { isAuthenticated, getUser, startSessionKeepAlive } from '@/lib/tanstack/dataQuery'
import { isAdminGateUnlocked } from '@/lib/adminGate'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Start session keep-alive if authenticated
    if (isAuthenticated()) {
      startSessionKeepAlive()
      
      const user = getUser()
      const roles = user?.roles || []
      
      // Redirect authenticated users to their respective dashboard
      if (roles.includes('ADMIN')) {
        // Only while the admin gate is unlocked. A logged-in admin whose
        // gate cookie is missing/expired must see the PUBLIC landing page
        // here — bouncing them to /admin-dashboard would ping-pong with
        // the gate's own "locked → landing" redirect forever.
        if (isAdminGateUnlocked()) {
          throw redirect({
            to: '/admin-dashboard',
            replace: true,
          })
        }
      } else if (roles.includes('DRIVER')) {
        // Owner rule, matching the login redirect and the driver route
        // guard: only an APPROVED driver with completed onboarding has a
        // dashboard to serve. Every other status sees the status board —
        // reachable from the landing page's nav, and the guard sends
        // them there if they type a driver URL.
        if (user?.driverStatus === 'APPROVED' && user?.onboardingCompleted) {
          throw redirect({
            to: '/driver/dashboard',
            replace: true,
          })
        }
      } else if (roles.includes('BUSINESS_CUSTOMER') || roles.includes('PRIVATE_CUSTOMER')) {
        // Both business and private customers use the dealer dashboard pages.
        throw redirect({
          to: '/dealer-dashboard',
          replace: true,
        })
      }
    }
  },
  component: IndexPageComponent,
})

function IndexPageComponent() {
  return <LandingPage />
}

