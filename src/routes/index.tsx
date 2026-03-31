import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthenticated, getUser, startSessionKeepAlive } from '@/lib/tanstack/dataQuery'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Start session keep-alive if authenticated
    if (isAuthenticated()) {
      startSessionKeepAlive()
    }
    
    // If user is authenticated, redirect to their dashboard
    if (isAuthenticated()) {
      const user = getUser()
      const roles = user?.roles || []
      
      // Redirect based on role
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
    
    // Not authenticated - redirect to landing page
    throw redirect({
      to: '/landing',
      replace: true,
    })
  },
})

function IndexPage() {
  return null // This page only handles redirects
}
