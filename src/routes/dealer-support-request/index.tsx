import DealerSupportRequest from '@/components/pages/dealer-support-request'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-support-request/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerSupportRequest />
}
