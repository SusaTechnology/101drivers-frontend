import AdminSupportListPage from '@/components/pages/admin-support-list'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-support-list/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminSupportListPage />
}
