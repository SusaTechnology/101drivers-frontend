import AdminSupportDetailPage from '@/components/pages/admin-support-detail'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

// The id now arrives as a URL search param so the page is deep-linkable
// (NotificationBell navigates here with `/admin-support-detail?id=…`,
// and browser/PWA refreshes preserve the URL but NOT router history state).
const searchSchema = z.object({
  id: z.string().optional(),
})

export const Route = createFileRoute('/admin-support-detail/')({
  component: RouteComponent,
  validateSearch: searchSchema,
})

function RouteComponent() {
  const search = useSearch({ from: '/admin-support-detail/' })
  return <AdminSupportDetailPage supportRequestId={search.id} />
}
