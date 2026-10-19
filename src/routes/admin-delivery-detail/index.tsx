import AdminDeliveryDetailsPage from '@/components/pages/admin-delivery-details'
import { createFileRoute } from '@tanstack/react-router'
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-delivery-detail/')({
  component: AdminGuardedRoute,
  validateSearch: (search: Record<string, unknown>): { deliveryId: string } => {
    return {
      deliveryId: (search.deliveryId as string) || '',
    }
  },
})

function AdminGuardedRoute() {
  return (
    <AdminRouteGuard>
      <RouteComponent />
    </AdminRouteGuard>
  )
}

function RouteComponent() {
  const { deliveryId } = Route.useSearch()
  return <AdminDeliveryDetailsPage deliveryId={deliveryId} />
}
