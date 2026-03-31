import { createFileRoute, redirect } from '@tanstack/react-router'
import LandingPage  from '@/components/pages/landingPage'
import { isAuthenticated, getUser, startSessionKeepAlive } from '@/lib/tanstack/dataQuery'

export const Route = createFileRoute('/landing/')({
  beforeLoad: () => {
    // Start session keep-alive if authenticated
    if (isAuthenticated()) {
      startSessionKeepAlive()
      
      // Redirect authenticated users to their dashboard
      const user = getUser()
      const roles = user?.roles || []
      
      if (roles.includes('ADMIN')) {
        throw redirect({
          to: '/admin-dashboard',
          replace: true,
        })
      } else if (roles.includes('DRIVER')) {
        throw redirect({
          to: '/driver-dashboard',
          replace: true,
        })
      } else if (roles.includes('BUSINESS_CUSTOMER') || roles.includes('PRIVATE_CUSTOMER')) {
        throw redirect({
          to: '/dealer-dashboard',
          replace: true,
        })
      }
    }
  },
  component: LandingPageComponent,
})

function LandingPageComponent() {
  return <LandingPage />
}
