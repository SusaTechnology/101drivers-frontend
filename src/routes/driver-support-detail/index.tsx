import DriverSupportDetailPage from '@/components/pages/driver-support-detail'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-support-detail/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverSupportDetailPage />
    </DriverRouteGuard>
  )
}
