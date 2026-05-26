import { DealerSignUp } from '@/components/auth/dealer-signup'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-onboarding/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerSignUp />
}
