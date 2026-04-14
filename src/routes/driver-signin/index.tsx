import { createFileRoute } from '@tanstack/react-router'
import { DealerSignIn } from '@/components/auth/DealerSignIn'
import { ThemeProvider } from 'next-themes'

export const Route = createFileRoute("/driver-signin/")({
  component: DriverSignInPage,
})

function DriverSignInPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DealerSignIn userType="driver" />
    </ThemeProvider>
  )
}
