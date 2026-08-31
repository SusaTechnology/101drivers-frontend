import TestReferralPage from '@/components/pages/TestReferralPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test-referral/$code/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { code } = Route.useParams()
  return <TestReferralPage code={code} />
}
