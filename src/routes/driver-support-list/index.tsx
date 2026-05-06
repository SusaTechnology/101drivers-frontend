import DriverSupportListPage from '@/components/pages/driver-support-list'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-support-list/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverSupportListPage />
    </DriverRouteGuard>
  )
}
