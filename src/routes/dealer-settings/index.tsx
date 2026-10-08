import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const DealerSettings = lazy(() => import('@/components/pages/dealer-setting'))
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dealer-settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <DealerSettings />
    </Suspense>
  )
}
