import DealerSupportList from '@/components/pages/dealer-support-list'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-support-list/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerSupportList />
}
