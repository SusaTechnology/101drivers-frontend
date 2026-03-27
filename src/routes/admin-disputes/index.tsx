import AdminDisputesPage from '@/components/pages/admin-disputes'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-disputes/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDisputesPage />
}
