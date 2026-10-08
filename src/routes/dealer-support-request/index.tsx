import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const DealerSupportRequest = lazy(() => import('@/components/pages/dealer-support-request'))
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-support-request/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <DealerSupportRequest />
    </Suspense>
  )
}
