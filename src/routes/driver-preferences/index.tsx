import DriverPreferencesPage from '@/components/pages/driver-preferences'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-preferences/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverPreferencesPage />
}
