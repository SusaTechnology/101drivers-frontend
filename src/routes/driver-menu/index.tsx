import DriverMenuPage from '@/components/pages/driver-menu'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-menu/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverMenuPage />
    </DriverRouteGuard>
  )
}
