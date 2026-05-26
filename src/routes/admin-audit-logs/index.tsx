import AdminAuditLogsPage from '@/components/pages/admin-audit-logs'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-audit-logs/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminAuditLogsPage />
}
