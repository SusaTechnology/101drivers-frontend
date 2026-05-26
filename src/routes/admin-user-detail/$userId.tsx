import AdminUserDetailsPage from '@/components/pages/admin-user-detail'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-user-detail/$userId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { userId } = Route.useParams()
  return <AdminUserDetailsPage userId={userId} />
}
