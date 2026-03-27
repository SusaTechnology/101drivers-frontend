import DriverPickupChecklistPage from '@/components/pages/driver-pickup-checklist'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-pickup-checklist/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverPickupChecklistPage />
}
