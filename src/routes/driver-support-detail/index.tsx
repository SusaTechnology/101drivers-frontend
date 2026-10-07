import DriverSupportDetailPage from '@/components/pages/driver-support-detail'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'
import { z } from 'zod'

// The id now arrives as a URL search param so the page is deep-linkable
// (NotificationBell navigates here with `/driver-support-detail?id=…`,
// and browser/PWA refreshes preserve the URL but NOT router history state).
const searchSchema = z.object({
  id: z.string().optional(),
})

export const Route = createFileRoute('/driver-support-detail/')({
  component: RouteComponent,
  validateSearch: searchSchema,
})

function RouteComponent() {
  const search = useSearch({ from: '/driver-support-detail/' })
  return (
    <DriverRouteGuard>
      <DriverSupportDetailPage supportRequestId={search.id} />
    </DriverRouteGuard>
  )
}
