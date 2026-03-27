import DriverMenuPage from '@/components/pages/driver-menu'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-menu/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverMenuPage />
}
