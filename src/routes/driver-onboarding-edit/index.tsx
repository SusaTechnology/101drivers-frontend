import { createFileRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/lib/theme'
import { DriverOnboardingEdit } from '@/components/pages/driverOnboardingEdit'

// Driver onboarding-data EDIT page — reached from the Application Status
// board ("Edit Application Info"). Top-level route on purpose: it sits
// OUTSIDE the /driver layout's DriverRouteGuard, which would bounce
// non-approved drivers to the status board before this page ever rendered.
// The page self-guards: device gate, authentication, and an editable-status
// check against GET /api/drivers/onboarding-data.
export const Route = createFileRoute("/driver-onboarding-edit/")({
  component: DriverOnboardingEditPage,
})

function DriverOnboardingEditPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DriverOnboardingEdit />
    </ThemeProvider>
  )
}
