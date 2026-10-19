import AdminPricingConfigFormPage from '@/components/pages/admin-pricing-config-form'
import { createFileRoute } from '@tanstack/react-router'
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-pricing-config/create/')({
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
  return <AdminPricingConfigFormPage />
}
