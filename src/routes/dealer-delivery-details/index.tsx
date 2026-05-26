import DealerDeliveryDetails from '@/components/pages/dealer-delivery-details'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  id: z.string().optional(),
})

export const Route = createFileRoute('/dealer-delivery-details/')({
  component: RouteComponent,
  validateSearch: searchSchema,
})

function RouteComponent() {
  const search = useSearch({ from: '/dealer-delivery-details/' })
  return <DealerDeliveryDetails deliveryId={search.id} />
}
