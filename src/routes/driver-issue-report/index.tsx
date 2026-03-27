import DriverIssueReportPage from '@/components/pages/driver-issue-report'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-issue-report/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverIssueReportPage />
}
