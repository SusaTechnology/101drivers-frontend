import AdminSupportDetailPage from '@/components/pages/admin-support-detail'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-support-detail/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminSupportDetailPage />
}
