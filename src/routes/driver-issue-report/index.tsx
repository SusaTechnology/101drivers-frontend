import DriverIssueReportPage from '@/components/pages/driver-issue-report'
import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'

export const Route = createFileRoute('/driver-issue-report/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverIssueReportPage />
    </DriverRouteGuard>
  )
}
