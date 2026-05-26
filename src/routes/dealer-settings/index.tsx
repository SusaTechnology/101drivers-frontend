import DealerSettings from '@/components/pages/dealer-setting'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerSettings />
}
