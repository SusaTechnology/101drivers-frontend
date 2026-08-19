import { createFileRoute, redirect } from '@tanstack/react-router'
import IndividualDashboard from '@/components/pages/individual-dashboard'
import { isAuthenticated, getUser } from '@/lib/tanstack/dataQuery'

export const Route = createFileRoute('/individual-dashboard/')({
  beforeLoad: () => {
    // Guard: only PRIVATE_CUSTOMER can access this page
    if (!isAuthenticated()) {
      throw redirect({ to: '/auth/dealer-signin', replace: true })
    }
    const user = getUser()
    const roles = user?.roles || []
    if (!roles.includes('PRIVATE_CUSTOMER')) {
      // BUSINESS_CUSTOMER → redirect to dealer dashboard
      throw redirect({ to: '/dealer-dashboard', replace: true })
    }
  },
  component: IndividualDashboard,
})
