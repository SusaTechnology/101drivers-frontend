import AdminBillingHealthPage from '@/components/pages/admin-billing-health'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-billing-health/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminBillingHealthPage />
}
