import DriverPreferencesPage from '@/components/pages/driver-preferences'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver/preferences')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverPreferencesPage />
    </DriverRouteGuard>
  )
}
