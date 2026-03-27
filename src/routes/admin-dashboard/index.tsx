import AdminDashboardPage from '@/components/pages/admin-dashboard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDashboardPage />
}
