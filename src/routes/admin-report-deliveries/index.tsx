import AdminDeliveriesReportPage from '@/components/pages/admin-report-deliveries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-report-deliveries/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDeliveriesReportPage />
}
