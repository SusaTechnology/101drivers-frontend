import DriverSupportDetailPage from '@/components/pages/driver-support-detail'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-support-detail/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverSupportDetailPage />
}
