import { createFileRoute } from '@tanstack/react-router'
import InsurancePortalPage from '@/components/pages/insurance-portal'

export const Route = createFileRoute('/insurance-portal/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <InsurancePortalPage />
}
