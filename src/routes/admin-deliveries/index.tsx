import AdminDeliveriesPage from '@/components/pages/admin-deliveries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-deliveries/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDeliveriesPage />
}
