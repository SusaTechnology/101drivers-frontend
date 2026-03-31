import DriverJobDetailsPage from '@/components/pages/driver-job-details'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-job-details/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverJobDetailsPage />
}
