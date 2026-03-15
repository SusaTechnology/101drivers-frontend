import AdminOpsSummaryPage from '@/components/pages/admin-report-ops-summary'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-report-ops-summary/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminOpsSummaryPage />
}
