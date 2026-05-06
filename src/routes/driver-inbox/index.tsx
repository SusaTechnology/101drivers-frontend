import DriverInboxPage from '@/components/pages/driver-inbox'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-inbox/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverInboxPage />
    </DriverRouteGuard>
  )
}
