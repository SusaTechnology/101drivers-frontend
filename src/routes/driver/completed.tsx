import DriverCompletedPage from '@/components/pages/driver-completed'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/completed')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverCompletedPage />
    </DriverRouteGuard>
  )
}
