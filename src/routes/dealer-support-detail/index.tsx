import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const DealerSupportDetail = lazy(() => import('@/components/pages/dealer-support-detail'))
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

// The id now arrives as a URL search param so the page is deep-linkable
// (NotificationBell navigates here with `/dealer-support-detail?id=…`,
// and browser/PWA refreshes preserve the URL but NOT router history state).
const searchSchema = z.object({
  id: z.string().optional(),
})

export const Route = createFileRoute('/dealer-support-detail/')({
  component: RouteComponent,
  validateSearch: searchSchema,
})

function RouteComponent() {
  const search = useSearch({ from: '/dealer-support-detail/' })
  return (
    <Suspense fallback={<RoutePending />}>
      <DealerSupportDetail supportRequestId={search.id} />
    </Suspense>
  )
}
