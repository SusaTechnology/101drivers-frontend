import AdminDisputesReportPage from '@/components/pages/admin-report-disputes'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-report-disputes/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDisputesReportPage />
}
