import PrivacyPolicy from '@/components/pages/privacy'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <PrivacyPolicy />
}
