import AdminDeliveryPoliciesPage from '@/components/pages/admin-delivery-policies'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-delivery-policies/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDeliveryPoliciesPage />
}
