import { createFileRoute } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import { DriverApplicationSubmitted } from '@/components/pages/driverApplicationSubmitted'

export const Route = createFileRoute("/driver-application-submitted/")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DriverApplicationSubmitted />
    </ThemeProvider>
  )
}
