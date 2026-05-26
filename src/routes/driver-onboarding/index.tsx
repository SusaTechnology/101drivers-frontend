import DriverOnboardingPage from '@/components/pages/driverOnboarding'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-onboarding/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DriverOnboardingPage/>
}
