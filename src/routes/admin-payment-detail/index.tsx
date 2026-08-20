import AdminPaymentDetailPage from '@/components/pages/admin-payment-detail';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin-payment-detail/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { paymentId: string } => {
    return {
      paymentId: (search.paymentId as string) || '',
    };
  },
});

function RouteComponent() {
  const { paymentId } = Route.useSearch();
  return <AdminPaymentDetailPage paymentId={paymentId} />;
}
