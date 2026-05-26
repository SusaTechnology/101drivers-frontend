import AdminPaymentsPage from '@/components/pages/admin-payments'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-payments/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminPaymentsPage />
}
