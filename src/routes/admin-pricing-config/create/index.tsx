import AdminPricingConfigFormPage from '@/components/pages/admin-pricing-config-form'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-pricing-config/create/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminPricingConfigFormPage />
}
