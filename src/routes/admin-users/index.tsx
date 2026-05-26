import AdminUsersPage from '@/components/pages/admin-users'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-users/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminUsersPage />
}
