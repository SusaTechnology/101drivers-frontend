import AdminPayoutRunDetailPage from '@/components/pages/admin-payout-run-detail';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin-payout-run-detail/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { runId: string } => {
    return {
      runId: (search.runId as string) || '',
    };
  },
});

function RouteComponent() {
  const { runId } = Route.useSearch();
  return <AdminPayoutRunDetailPage runId={runId} />;
}
