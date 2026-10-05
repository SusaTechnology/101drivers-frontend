import { createFileRoute, redirect } from '@tanstack/react-router'
import LandingPage from '@/components/pages/homePage'
import { isAuthenticated, getUser, startSessionKeepAlive } from '@/lib/tanstack/dataQuery'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Start session keep-alive if authenticated
    if (isAuthenticated()) {
      startSessionKeepAlive()
      
      const user = getUser()
      const roles = user?.roles || []
      
      // Redirect authenticated users to their respective dashboard
      if (roles.includes('ADMIN')) {
        throw redirect({
          to: '/admin-dashboard',
          replace: true,
        })
      } else if (roles.includes('DRIVER')) {
        // Only bounce drivers that have a dashboard to serve. Pending /
        // waitlisted / on-hold / invited / rejected drivers have no dashboard
        // — /driver/dashboard's DriverRouteGuard would just bounce them back
        // to its status screen, which made the "Done" button on the
        // "Application Pending Approval" screen appear to do nothing.
        if (user?.driverStatus === 'APPROVED') {
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

