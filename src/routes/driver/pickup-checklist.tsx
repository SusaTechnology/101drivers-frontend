import DriverPickupChecklistPage from '@/components/pages/driver-pickup-checklist'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/pickup-checklist')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverPickupChecklistPage />
    </DriverRouteGuard>
  )
}
