import DriverDashboardPage from '@/components/pages/driver-dashboard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverDashboardPage />
}
