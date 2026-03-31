import DriverWalletPage from '@/components/pages/driver-wallet'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-wallet/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverWalletPage />
}
