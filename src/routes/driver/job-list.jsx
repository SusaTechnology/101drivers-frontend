import DriverGigBoardPage from '@/components/pages/dashboard-list'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/job-list')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverGigBoardPage />
    </DriverRouteGuard>
  )
}
