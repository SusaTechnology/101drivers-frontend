import QuoteSubmitted from '@/components/pages/quote-confirmation'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/quote-confirmation/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <QuoteSubmitted />
}
