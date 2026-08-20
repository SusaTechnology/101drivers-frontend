import IndividualVerifyEmailPage from '@/components/pages/individual-verify-email'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/individual-verify-email/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      otp: typeof search.otp === 'string' ? search.otp : undefined,
    }
  },
})

function RouteComponent() {
  return <IndividualVerifyEmailPage />
}
