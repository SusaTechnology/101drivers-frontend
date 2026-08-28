import DriverCompletedDetailsPage from '@/components/pages/driver-completed-details'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/completed-details')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverCompletedDetailsPage />
    </DriverRouteGuard>
  )
}
