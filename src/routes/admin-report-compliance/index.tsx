import AdminComplianceReportPage from '@/components/pages/admin-report-compliance'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-report-compliance/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminComplianceReportPage />
}
