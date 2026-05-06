import DriverActiveDeliveryPage from '@/components/pages/driver-active'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-active/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverActiveDeliveryPage />
    </DriverRouteGuard>
  )
}
