import { createFileRoute } from '@tanstack/react-router'
import AdminContentPage from '@/components/pages/admin-content'
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-content/')({
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
  return <AdminContentPage />
}
