import { createFileRoute } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import { DriverOnboardingComplete } from '@/components/pages/driverOnboardingComplete'

export const Route = createFileRoute("/driver-onboarding-complete/")({
  component: DriverOnboardingCompletePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: typeof search.token === "string" ? search.token : undefined,
    }
  },
})

function DriverOnboardingCompletePage() {
  const { token } = Route.useSearch()
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DriverOnboardingComplete token={token} />
    </ThemeProvider>
  )
}
