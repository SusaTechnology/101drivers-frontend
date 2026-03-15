import AdminDeliveryDetailsPage from '@/components/pages/admin-delivery-details'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-delivery-detail/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDeliveryDetailsPage />
}
