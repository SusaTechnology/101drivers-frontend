import PublicTrackPage from '@/components/pages/PublicTrackPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/track/$token')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()
  return <PublicTrackPage token={token} />
}
