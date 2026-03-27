import DriverInboxPage from '@/components/pages/driver-inbox'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-inbox/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverInboxPage />
}
