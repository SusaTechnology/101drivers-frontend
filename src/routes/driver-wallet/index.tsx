import DriverWalletPage from '@/components/pages/driver-wallet'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-wallet/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverWalletPage />
    </DriverRouteGuard>
  )
}
