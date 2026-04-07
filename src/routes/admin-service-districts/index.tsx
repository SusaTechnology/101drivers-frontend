// @ts-nocheck
import AdminServiceDistrictsPage from '@/components/pages/admin-service-districts'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-service-districts/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminServiceDistrictsPage />
}
