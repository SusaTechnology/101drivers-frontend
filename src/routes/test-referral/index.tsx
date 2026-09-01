import TestReferralLookupPage from '@/components/pages/TestReferralLookupPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test-referral/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <TestReferralLookupPage />
}
