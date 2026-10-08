import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const DealerSupportList = lazy(() => import('@/components/pages/dealer-support-list'))
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-support-list/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <DealerSupportList />
    </Suspense>
  )
}
