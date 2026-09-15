import AdminPaymentDetailPage from '@/components/pages/admin-payment-detail';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

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

  // ── Self-healing URL ──
  // This route accepts ONLY paymentId. Stale tabs / mixed module states
  // have been observed putting junk into the address bar here (e.g. a
  // trailing "disputeId=" from an old bundle), which confused admins even
  // though the page itself ignores those params. If anything other than
  // paymentId is sitting in the URL, rewrite the history entry clean —
  // once, silently, without triggering a router navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    const foreignKeys = [...url.searchParams.keys()].filter(
      (key) => key !== 'paymentId',
    );
    if (foreignKeys.length === 0) return;
    url.search = new URLSearchParams({ paymentId }).toString();
    window.history.replaceState(null, '', url.toString());
  }, [paymentId]);

  return <AdminPaymentDetailPage paymentId={paymentId} />;
}
