import AdminUserDetailsPage from '@/components/pages/admin-user-detail'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-user-detail/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminUserDetailsPage />
}
