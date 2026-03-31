import DriverRepositioningPage from '@/components/pages/driver-repositioning'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-repositioning/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverRepositioningPage />
}
