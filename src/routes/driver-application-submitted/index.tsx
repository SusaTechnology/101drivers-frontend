import { createFileRoute, redirect } from '@tanstack/react-router'
import { ThemeProvider } from '@/lib/theme'
import { DriverApplicationSubmitted } from '@/components/pages/driverApplicationSubmitted'
import { isAuthenticated, getUser } from '@/lib/tanstack/dataQuery'

export const Route = createFileRoute("/driver-application-submitted/")({
  // Owner rule: the status board is for drivers with pending business
  // only (invited / pending / waitlisted / on hold / rejected). An
  // APPROVED driver who lands here — stale link, manual URL, sign-out
  // race — is redirected during route matching, BEFORE any paint, so
  // the board never flashes for them. Sync localStorage reads only;
  // nothing here can await.
  beforeLoad: () => {
    if (!isAuthenticated()) return
    const user = getUser()
    if (!user?.roles?.includes("DRIVER") || user?.driverStatus !== "APPROVED") {
      return
    }
    if (user.onboardingCompleted) {
      throw redirect({ to: "/driver/dashboard" })
    }
    if (user.onboardingToken) {
      // Approved but not onboarded yet — the onboarding form is where
      // they have work to do, not this board.
      throw redirect({
        to: "/driver-onboarding-complete",
        search: { token: user.onboardingToken } as never,
      })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DriverApplicationSubmitted />
    </ThemeProvider>
  )
}
