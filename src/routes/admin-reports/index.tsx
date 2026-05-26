import AdminReportsHubPage from '@/components/pages/admin-reports'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-reports/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminReportsHubPage />
}
