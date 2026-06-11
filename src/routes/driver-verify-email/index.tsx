import DriverVerifyEmailPage from '@/components/pages/driver-verify-email'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-verify-email/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      otp: typeof search.otp === 'string' ? search.otp : undefined,
    }
  },
})

function RouteComponent() {
  return <DriverVerifyEmailPage />
}
