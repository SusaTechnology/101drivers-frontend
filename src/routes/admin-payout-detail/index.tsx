import AdminPayoutDetailPage from '@/components/pages/admin-payout-detail';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin-payout-detail/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { payoutId: string } => {
    return {
      payoutId: (search.payoutId as string) || '',
    };
  },
});

function RouteComponent() {
  const { payoutId } = Route.useSearch();
  return <AdminPayoutDetailPage payoutId={payoutId} />;
}
