import DealerEditDelivery from '@/components/pages/dealer-edit-delivery'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-edit-delivery/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerEditDelivery />
}
