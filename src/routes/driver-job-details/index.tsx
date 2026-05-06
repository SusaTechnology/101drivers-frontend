import DriverJobDetailsPage from '@/components/pages/driver-job-details'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-job-details/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverJobDetailsPage />
    </DriverRouteGuard>
  )
}
