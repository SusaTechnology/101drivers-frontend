import AdminPayoutDetailPage from '@/components/pages/admin-payout-detail';
import { createFileRoute } from '@tanstack/react-router';
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-payout-detail/')({
  component: AdminGuardedRoute,
  validateSearch: (search: Record<string, unknown>): { payoutId: string } => {
    return {
      payoutId: (search.payoutId as string) || '',
    };
  },
});

function AdminGuardedRoute() {
  return (
    <AdminRouteGuard>
      <RouteComponent />
    </AdminRouteGuard>
  )
}

function RouteComponent() {
  const { payoutId } = Route.useSearch();
  return <AdminPayoutDetailPage payoutId={payoutId} />;
}
