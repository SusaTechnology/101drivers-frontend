import DriverStartingLocationPage from '@/components/pages/driver-starting-location'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-starting-location/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverStartingLocationPage />
}
