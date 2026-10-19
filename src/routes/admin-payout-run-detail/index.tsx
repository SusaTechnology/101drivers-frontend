import AdminPayoutRunDetailPage from '@/components/pages/admin-payout-run-detail';
import { createFileRoute } from '@tanstack/react-router';
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute('/admin-payout-run-detail/')({
  component: AdminGuardedRoute,
  validateSearch: (search: Record<string, unknown>): { runId: string } => {
    return {
      runId: (search.runId as string) || '',
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
  const { runId } = Route.useSearch();
  return <AdminPayoutRunDetailPage runId={runId} />;
}
