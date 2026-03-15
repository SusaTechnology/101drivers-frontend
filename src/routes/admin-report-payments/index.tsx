import AdminPaymentsReportPage from '@/components/pages/admin-report-payments'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-report-payments/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminPaymentsReportPage />
}
