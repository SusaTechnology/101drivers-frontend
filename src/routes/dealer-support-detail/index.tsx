import DealerSupportDetail from '@/components/pages/dealer-support-detail'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-support-detail/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerSupportDetail />
}
