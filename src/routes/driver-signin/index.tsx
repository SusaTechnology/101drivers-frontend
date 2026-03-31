import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver-signin/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/driver-signin/"!</div>
}
