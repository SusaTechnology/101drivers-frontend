import DriverRepositioningPage from '@/components/pages/driver-repositioning'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/repositioning')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverRepositioningPage />
    </DriverRouteGuard>
  )
}
