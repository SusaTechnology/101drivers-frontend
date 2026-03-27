import DealerDeliveryDetails from '@/components/pages/dealer-delivery-details'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-delivery-details/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerDeliveryDetails />
}
