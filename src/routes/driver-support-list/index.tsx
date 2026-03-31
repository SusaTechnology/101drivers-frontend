import DriverSupportListPage from '@/components/pages/driver-support-list'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-support-list/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverSupportListPage />
}
