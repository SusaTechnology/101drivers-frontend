import AdminPricingPage from '@/components/pages/admin-pricing'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-pricing/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminPricingPage />
}
