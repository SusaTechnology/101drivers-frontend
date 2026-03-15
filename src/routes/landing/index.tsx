import { createFileRoute } from '@tanstack/react-router'
import LandingPage  from '@/components/pages/landingPage'

export const Route = createFileRoute('/landing/')({
  component: LandingPageComponent,
})

function LandingPageComponent() {
  return <LandingPage />
}