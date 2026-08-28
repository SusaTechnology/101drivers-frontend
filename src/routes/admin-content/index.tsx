import { createFileRoute } from '@tanstack/react-router'
import AdminContentPage from '@/components/pages/admin-content'

export const Route = createFileRoute('/admin-content/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminContentPage />
}
