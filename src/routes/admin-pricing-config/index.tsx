import AdminPricingConfigPage from '@/components/pages/admin-pricing-config'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-pricing-config/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminPricingConfigPage />
}
