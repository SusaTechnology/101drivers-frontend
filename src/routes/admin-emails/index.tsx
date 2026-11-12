import AdminEmailsPage from '@/components/pages/admin-emails'
import { createFileRoute } from '@tanstack/react-router'
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-emails/')({
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
  return <AdminEmailsPage />
}
