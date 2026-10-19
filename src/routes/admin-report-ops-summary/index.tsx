import AdminOpsSummaryPage from '@/components/pages/admin-report-ops-summary'
import { createFileRoute } from '@tanstack/react-router'
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-report-ops-summary/')({
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
  return <AdminOpsSummaryPage />
}
