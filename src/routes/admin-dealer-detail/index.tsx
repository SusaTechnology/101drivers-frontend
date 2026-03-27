import AdminDealerDetailsPage from '@/components/pages/admin-dealer-details'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-dealer-detail/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminDealerDetailsPage />
}
