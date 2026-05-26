import DealerLiveTrack from '@/components/pages/dealer/DealerLiveTrack'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/live-track/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DealerLiveTrack />
}
