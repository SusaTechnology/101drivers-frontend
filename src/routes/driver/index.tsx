import DriverDashboardPage from '@/components/pages/driver-dashboard'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverDashboardPage />
    </DriverRouteGuard>
  )
}
