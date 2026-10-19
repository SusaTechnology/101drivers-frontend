import AdminDeliveriesReportPage from '@/components/pages/admin-report-deliveries'
import { createFileRoute } from '@tanstack/react-router'
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-report-deliveries/')({
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
  return <AdminDeliveriesReportPage />
}
