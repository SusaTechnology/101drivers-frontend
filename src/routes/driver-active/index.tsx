import DriverActiveDeliveryPage from '@/components/pages/driver-active'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-active/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverActiveDeliveryPage />
}
