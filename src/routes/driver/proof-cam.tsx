import DriverProofCamPage from '@/components/pages/driver-proof-cam'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver/proof-cam')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverProofCamPage />
}
