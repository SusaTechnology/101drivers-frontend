import AdminUserDetailsPage from '@/components/pages/admin-user-detail'
import { createFileRoute } from '@tanstack/react-router'
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-user-detail/$userId')({
  component: AdminGuardedRoute,
})

function AdminGuardedRoute() {
  return (
    <AdminRouteGuard>
      <RouteComponent />
    </AdminRouteGuard>
  )
}

function RouteComponent() {
  const { userId } = Route.useParams()
  return <AdminUserDetailsPage userId={userId} />
}
