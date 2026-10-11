import { createFileRoute } from '@tanstack/react-router'
import AdminCmsPage from '@/components/pages/admin-cms'

export const Route = createFileRoute('/admin-cms/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminCmsPage />
}
