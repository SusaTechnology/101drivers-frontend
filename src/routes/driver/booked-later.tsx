import DriverBookedLaterPage from '@/components/pages/driver-booked-later'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/booked-later')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverBookedLaterPage />
    </DriverRouteGuard>
  )
}
