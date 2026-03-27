import AdminPayoutsReportPage from '@/components/pages/admin-report-payouts'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-report-payouts/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminPayoutsReportPage />
}
