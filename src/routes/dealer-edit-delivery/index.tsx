import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const DealerEditDelivery = lazy(() => import('@/components/pages/dealer-edit-delivery'))
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-edit-delivery/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <DealerEditDelivery />
    </Suspense>
  )
}
