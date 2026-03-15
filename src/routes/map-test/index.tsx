import MapTest from '@/components/pages/map-test'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/map-test/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <MapTest />
}
