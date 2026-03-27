import AdminSchedulingPolicyPage from '@/components/pages/admin-scheduling-policy'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-scheduling-policy/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminSchedulingPolicyPage />
}
