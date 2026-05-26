import { createFileRoute } from '@tanstack/react-router'
import { QuoteDetails } from '@/components/pages/QuoteDetails'

export const Route = createFileRoute('/quote-details/')({
  component: QuoteDetailsPage,
})

function QuoteDetailsPage() {
  return <QuoteDetails />
}