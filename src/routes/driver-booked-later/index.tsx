import DriverBookedLaterPage from '@/components/pages/driver-booked-later'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-booked-later/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverBookedLaterPage />
}
