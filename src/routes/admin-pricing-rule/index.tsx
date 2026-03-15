import AdminPricingRulePage from '@/components/pages/admin-pricing-rule'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-pricing-rule/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminPricingRulePage />
}
