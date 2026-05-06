import { createFileRoute } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import { DriverOnboardingComplete } from '@/components/pages/driverOnboardingComplete'

export const Route = createFileRoute("/driver-onboarding-complete/")({
  component: DriverOnboardingCompletePage,
})

function DriverOnboardingCompletePage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DriverOnboardingComplete />
    </ThemeProvider>
  )
}
