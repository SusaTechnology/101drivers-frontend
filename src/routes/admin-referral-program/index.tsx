import AdminReferralProgramPage from '@/components/pages/admin-referral-program'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-referral-program/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminReferralProgramPage />
}
