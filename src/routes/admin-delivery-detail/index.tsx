import AdminDeliveryDetailsPage from '@/components/pages/admin-delivery-details'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-delivery-detail/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { deliveryId: string } => {
    return {
      deliveryId: (search.deliveryId as string) || '',
    }
  },
})

function RouteComponent() {
  const { deliveryId } = Route.useSearch()
  return <AdminDeliveryDetailsPage deliveryId={deliveryId} />
}
