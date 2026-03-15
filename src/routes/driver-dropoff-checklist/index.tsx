import DriverDashboardPage from '@/components/pages/driver-dashboard'
import DriverDropoffChecklistPage from '@/components/pages/driver-dropoff-checklist'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-dropoff-checklist/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverDropoffChecklistPage />
}
