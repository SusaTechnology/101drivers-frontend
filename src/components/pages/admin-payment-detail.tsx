// components/pages/admin-payment-detail.tsx
//
// Full-detail view for a single payment, reached from the admin-payments list
// via the "View Details" button (which navigates to
// /admin-payment-detail?paymentId=...).
//
// Surfaces:
//   - Payment core: amount, type (prepaid/postpaid), provider (stripe/manual),
//     status (authorized/captured/paid/refunded/voided/invoiced), failure
//     code+message, provider charge+intent IDs, lock-in amount
//   - Customer + delivery: pickup/dropoff addresses, pickup window, pickup PIN,
//     service type, customer contact info, current active driver
//   - Payout (if any): status, net amount, paid-at
//   - All payment events (full audit trail, not just the latest 5)
//
// Backend: GET /api/payments/admin/:id (see PaymentController.getAdminPaymentDetail)
import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import {
  useAdminPaymentDetail,
  usePaymentActions,
  formatCurrency,
  formatPaymentDate,
  getPaymentStatusColor,
  getPaymentTypeLabel,
  getProviderLabel,
} from '@/hooks/useAdminPayments';
import { getUser } from '@/lib/tanstack/dataQuery';
import { getStripeErrorInfo } from '@/lib/stripe-error-codes';
import type {
  MarkInvoicedRequest,
  MarkPaidRequest,
  MarkPayoutPaidRequest,
} from '@/types/payment';
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Truck,
  User,
  Building2,
  Clock,
  Wallet,
  Receipt,
  Banknote,
  FileText,
  CheckCircle,
  XCircle,
  Hash,
  Calendar,
  Mail,
  MapPin,
  Route as RouteIcon,
  Copy,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { useDataMutation } from '@/lib/tanstack/dataQuery';

interface AdminPaymentDetailPageProps {
  paymentId: string;
}

export default function AdminPaymentDetailPage({ paymentId }: AdminPaymentDetailPageProps) {
  const { actionItems, signOut } = useAdminActions();
  const { data: payment, isLoading, isError, error, refetch } = useAdminPaymentDetail(paymentId);
  const paymentActions = usePaymentActions(paymentId);
  const user = getUser();

  // Local UI state for action dialogs
  const [markInvoicedOpen, setMarkInvoicedOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPayoutPaidOpen, setMarkPayoutPaidOpen] = useState(false);
  const [invoicedForm, setInvoicedForm] = useState({ invoiceId: '', note: '' });
  const [markPaidForm, setMarkPaidForm] = useState({ note: '' });
  const [markPayoutForm, setMarkPayoutForm] = useState({ providerTransferId: '', note: '' });

  // ── Refund state ──
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');

  // Refund mutation — calls POST /api/payments/stripe/refund/:paymentId
  // with optional `amount` for partial refunds. The webhook updates the
  // payment status + refundedAmountCents + creates the driver clawback.
  const refundMutation = useDataMutation({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/payments/stripe/refund/:paymentId`,
    method: 'POST',
    onSuccess: () => {
      setRefundOpen(false);
      setRefundAmount('');
      setRefundNote('');
      setRefundMode('full');
      toast.success('Refund submitted', {
        description: 'The refund has been submitted to Stripe. The payment status will update automatically when the refund is processed.',
      });
      refetch();
    },
    onError: (error: any) => {
      toast.error('Refund failed', {
        description: error?.message || 'Unknown error',
      });
    },
  });

  const handleRefund = () => {
    const amount = refundMode === 'partial' ? parseFloat(refundAmount) : undefined;
    if (refundMode === 'partial' && (!amount || amount <= 0)) {
      toast.error('Invalid amount', { description: 'Please enter a valid refund amount.' });
      return;
    }
    refundMutation.mutate({
      pathParams: { paymentId },
      note: refundNote || undefined,
      amount,
    });
  };

  const actorUserId = user?.id || 'system';

  // ─── Loading state ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <Navbar
          brand={<Brand />}
          items={navItems}
          actions={actionItems}
          onSignOut={signOut}
          title="Admin"
        />
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-10 w-64 mb-4" />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────
  if (isError || !payment) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <Navbar
          brand={<Brand />}
          items={navItems}
          actions={actionItems}
          onSignOut={signOut}
          title="Admin"
        />
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <Card className="rounded-2xl border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <p className="text-rose-700 dark:text-rose-300 font-bold text-lg">
                Failed to load payment
              </p>
              <p className="text-rose-600 dark:text-rose-400 text-sm mt-2">
                {error?.message || 'Unknown error'}
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
                  Try Again
                </Button>
                <Link to="/admin-payments">
                  <Button className="rounded-xl bg-primary text-slate-950">
                    Back to Payments
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusColor = getPaymentStatusColor(payment.status);
  const delivery = payment.delivery;
  const customer = delivery?.customer;
  const activeAssignment = delivery?.assignments?.[0];
  const driverUser = activeAssignment?.driver?.user;
  const payout = delivery?.payout;

  // Helpers
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Failed to copy')
    );
  };

  const submitMarkInvoiced = () => {
    if (!invoicedForm.invoiceId.trim()) {
      toast.error('Invoice ID is required');
      return;
    }
    const payload: MarkInvoicedRequest = {
      actorUserId,
      invoiceId: invoicedForm.invoiceId,
      note: invoicedForm.note || undefined,
    };
    paymentActions.markInvoiced.mutate(payload, {
      onSuccess: () => {
        toast.success('Payment marked as invoiced');
        setMarkInvoicedOpen(false);
        setInvoicedForm({ invoiceId: '', note: '' });
        refetch();
      },
      onError: (err: Error) => {
        toast.error('Failed to mark as invoiced', { description: err.message });
      },
    });
  };

  const submitMarkPaid = () => {
    const payload: MarkPaidRequest = {
      actorUserId,
      note: markPaidForm.note || undefined,
    };
    paymentActions.markPaid.mutate(payload, {
      onSuccess: () => {
        toast.success('Payment marked as paid');
        setMarkPaidOpen(false);
        setMarkPaidForm({ note: '' });
        refetch();
      },
      onError: (err: Error) => {
        toast.error('Failed to mark as paid', { description: err.message });
      },
    });
  };

  const submitMarkPayoutPaid = () => {
    if (!markPayoutForm.providerTransferId.trim()) {
      toast.error('Provider transfer ID is required');
      return;
    }
    const payload: MarkPayoutPaidRequest = {
      actorUserId,
      providerTransferId: markPayoutForm.providerTransferId,
      note: markPayoutForm.note || undefined,
    };
    paymentActions.markPayoutPaid.mutate(payload, {
      onSuccess: () => {
        toast.success('Payout marked as paid');
        setMarkPayoutPaidOpen(false);
        setMarkPayoutForm({ providerTransferId: '', note: '' });
        refetch();
      },
      onError: (err: Error) => {
        toast.error('Failed to mark payout as paid', { description: err.message });
      },
    });
  };

  const InfoRow = ({
    icon: Icon,
    label,
    value,
    copyable = false,
    mono = false,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: React.ReactNode;
    copyable?: boolean;
    mono?: boolean;
  }) => (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide font-bold text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className={cn(
          'text-sm text-slate-800 dark:text-slate-200 mt-0.5 break-words',
          mono && 'font-mono'
        )}>
          {value ?? '—'}
        </div>
      </div>
      {copyable && typeof value === 'string' && value && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => copyToClipboard(value, label)}
        >
          <Copy className="w-3 h-3" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
        {/* Breadcrumb + header */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link to="/admin-payments">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Payments
            </Button>
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
            {payment.id}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(payment.amount)}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border',
                statusColor.bg,
                statusColor.text,
                statusColor.border
              )}>
                {payment.status}
              </Badge>
              <Badge variant="outline" className="text-[11px] font-bold rounded-full">
                {getPaymentTypeLabel(payment.paymentType)}
              </Badge>
              <Badge variant="outline" className="text-[11px] font-bold rounded-full">
                {getProviderLabel(payment.provider)}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={paymentActions.isAnyPending}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
            {payment.status === 'INVOICED' && (
              <Button
                onClick={() => setMarkPaidOpen(true)}
                size="sm"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={paymentActions.markPaid.isPending}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Mark Paid
              </Button>
            )}
            {payment.status === 'AUTHORIZED' && payment.paymentType === 'POSTPAID' && (
              <Button
                onClick={() => setMarkInvoicedOpen(true)}
                size="sm"
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                disabled={paymentActions.markInvoiced.isPending}
              >
                <FileText className="w-3.5 h-3.5 mr-1" />
                Mark Invoiced
              </Button>
            )}
            {payout && payout.status !== 'PAID' && (
              <Button
                onClick={() => setMarkPayoutPaidOpen(true)}
                size="sm"
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                disabled={paymentActions.markPayoutPaid.isPending}
              >
                <Banknote className="w-3.5 h-3.5 mr-1" />
                Mark Payout Paid
              </Button>
            )}
            {/* ── Refund button ──
                Shows when the payment is CAPTURED, PAID, or partially
                REFUNDED (so the admin can issue additional partial
                refunds). Hidden for AUTHORIZED (not captured yet),
                FAILED, or VOIDED payments. */}
            {['CAPTURED', 'PAID', 'REFUNDED'].includes(payment.status) && payment.providerPaymentIntentId && (
              <Button
                onClick={() => setRefundOpen(true)}
                size="sm"
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                disabled={refundMutation.isPending}
              >
                {refundMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                )}
                {payment.status === 'REFUNDED' ? 'Additional Refund' : 'Process Refund'}
              </Button>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left column — payment + delivery */}
          <div className="xl:col-span-2 space-y-6">
            {/* Payment core */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow
                    icon={Hash}
                    label="Payment ID"
                    value={payment.id}
                    copyable
                    mono
                  />
                  <InfoRow
                    icon={CreditCard}
                    label="Amount"
                    value={formatCurrency(payment.amount)}
                  />
                  <InfoRow
                    icon={FileText}
                    label="Type"
                    value={getPaymentTypeLabel(payment.paymentType)}
                  />
                  <InfoRow
                    icon={Wallet}
                    label="Provider"
                    value={getProviderLabel(payment.provider)}
                  />
                  <InfoRow
                    icon={Receipt}
                    label="Invoice ID"
                    value={payment.invoiceId}
                    copyable={!!payment.invoiceId}
                    mono
                  />
                  {payment.lockInAmount != null && (
                    <InfoRow
                      icon={Banknote}
                      label="Lock-in Amount"
                      value={formatCurrency(payment.lockInAmount)}
                    />
                  )}
                  {payment.providerChargeId && (
                    <InfoRow
                      icon={Hash}
                      label="Provider Charge ID"
                      value={payment.providerChargeId}
                      copyable
                      mono
                    />
                  )}
                  {payment.providerPaymentIntentId && (
                    <InfoRow
                      icon={Hash}
                      label="Payment Intent ID"
                      value={payment.providerPaymentIntentId}
                      copyable
                      mono
                    />
                  )}
                  <InfoRow
                    icon={Calendar}
                    label="Created"
                    value={formatPaymentDate(payment.createdAt)}
                  />
                  <InfoRow
                    icon={Calendar}
                    label="Updated"
                    value={formatPaymentDate(payment.updatedAt)}
                  />
                  {payment.authorizedAt && (
                    <InfoRow
                      icon={Clock}
                      label="Authorized"
                      value={formatPaymentDate(payment.authorizedAt)}
                    />
                  )}
                  {payment.capturedAt && (
                    <InfoRow
                      icon={CheckCircle}
                      label="Captured"
                      value={formatPaymentDate(payment.capturedAt)}
                    />
                  )}
                  {payment.paidAt && (
                    <InfoRow
                      icon={CheckCircle}
                      label="Paid"
                      value={formatPaymentDate(payment.paidAt)}
                    />
                  )}
                  {payment.voidedAt && (
                    <InfoRow
                      icon={XCircle}
                      label="Voided"
                      value={formatPaymentDate(payment.voidedAt)}
                    />
                  )}
                  {payment.refundedAt && (
                    <InfoRow
                      icon={XCircle}
                      label="Refunded"
                      value={formatPaymentDate(payment.refundedAt)}
                    />
                  )}
                </div>
                {(payment.failureCode || payment.failureMessage) && (() => {
                  const errorInfo = getStripeErrorInfo(payment.failureCode);
                  return (
                    <div className="mt-4 p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        <span className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                          Payment Failure
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'ml-auto text-[10px] font-bold border',
                            errorInfo.severity === 'critical' && 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
                            errorInfo.severity === 'danger' && 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
                            errorInfo.severity === 'warning' && 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
                            errorInfo.severity === 'info' && 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
                          )}
                        >
                          {errorInfo.severity}
                        </Badge>
                      </div>

                      {/* Admin-specific message (from stripe-error-codes.ts) */}
                      <div className="text-sm text-rose-600 dark:text-rose-400 font-medium">
                        {errorInfo.adminMessage}
                      </div>

                      {/* Raw error code + dealer-facing message for context */}
                      {payment.failureCode && (
                        <div className="text-xs font-mono text-rose-500 dark:text-rose-400 mt-2">
                          Stripe code: {payment.failureCode}
                        </div>
                      )}
                      {payment.failureMessage && payment.failureMessage !== errorInfo.adminMessage && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                          Dealer message: &ldquo;{payment.failureMessage}&rdquo;
                        </div>
                      )}

                      {/* Stripe invoice ID — so admin can look it up in Stripe dashboard */}
                      {payment.stripeInvoiceId && (
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-2">
                          Stripe Invoice: {payment.stripeInvoiceId}
                        </div>
                      )}

                      {/* Attempt count — which retry attempt this failure was */}
                      {payment.attemptCount != null && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
                          <span className="font-bold">Failure attempt:</span>
                          <span>
                            {payment.attemptCount === 1
                              ? '1st attempt (initial charge)'
                              : `${payment.attemptCount}th attempt (retry #${payment.attemptCount - 1})`}
                          </span>
                          {payment.attemptCount >= 3 && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[9px] ml-1">
                              Max retries approaching
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Failure attempt info */}
                      {payment.failedAt && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          Failed at: {formatPaymentDate(payment.failedAt)}
                        </div>
                      )}

                      {/* Resolution action */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {errorInfo.willAutoRetry ? (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">
                            Stripe will auto-retry
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px]">
                            No auto-retry scheduled
                          </Badge>
                        )}
                        {errorInfo.shouldRestrict && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px]">
                            ⚠️ Should restrict account
                          </Badge>
                        )}
                        {errorInfo.resolutionAction === 'admin_review' && (
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px]">
                            🔍 Admin review required
                          </Badge>
                        )}
                      </div>

                      {/* Action buttons — navigate to the relevant page */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* Navigate to the dealer's user detail page */}
                        {delivery?.customer?.userId && (
                          <Link
                            to="/admin-user-detail/$userId"
                            params={{ userId: delivery.customer.userId }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition"
                          >
                            <User className="w-3.5 h-3.5" />
                            View dealer details
                          </Link>
                        )}
                        {/* Navigate to the delivery detail page */}
                        {delivery?.id && (
                          <Link
                            to="/admin-delivery-detail"
                            search={{ deliveryId: delivery.id }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            View delivery
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Delivery + customer */}
            {delivery && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Truck className="w-4 h-4 text-primary" />
                    Delivery
                  </CardTitle>
                  <Link to="/admin-delivery-detail" search={{ deliveryId: delivery.id }}>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      View Delivery
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    <InfoRow
                      icon={Hash}
                      label="Delivery ID"
                      value={delivery.id}
                      copyable
                      mono
                    />
                    <InfoRow
                      icon={Truck}
                      label="Status"
                      value={<Badge variant="outline" className="text-[11px]">{delivery.status}</Badge>}
                    />
                    <InfoRow
                      icon={RouteIcon}
                      label="Service Type"
                      value={delivery.serviceType === 'HOME_DELIVERY' ? 'Home Delivery' : delivery.serviceType}
                    />
                    <InfoRow
                      icon={Calendar}
                      label="Pickup Window Start"
                      value={formatPaymentDate(delivery.pickupWindowStart)}
                    />
                    <InfoRow
                      icon={Calendar}
                      label="Pickup Window End"
                      value={formatPaymentDate(delivery.pickupWindowEnd)}
                    />
                    <InfoRow
                      icon={Calendar}
                      label="Dropoff Window Start"
                      value={formatPaymentDate(delivery.dropoffWindowStart)}
                    />
                    <InfoRow
                      icon={Calendar}
                      label="Dropoff Window End"
                      value={formatPaymentDate(delivery.dropoffWindowEnd)}
                    />
                    {delivery.pickupPin && (
                      <InfoRow
                        icon={Hash}
                        label="Pickup PIN"
                        value={<span className="font-mono font-bold">{delivery.pickupPin}</span>}
                        copyable
                        mono
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <InfoRow
                      icon={MapPin}
                      label="Pickup Address"
                      value={delivery.pickupAddress}
                    />
                    <InfoRow
                      icon={MapPin}
                      label="Dropoff Address"
                      value={delivery.dropoffAddress}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment events audit trail */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4 text-primary" />
                  Payment Events
                  <Badge variant="outline" className="ml-2 text-[11px]">
                    {payment.events?.length ?? 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {!payment.events || payment.events.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No payment events recorded
                  </div>
                ) : (
                  <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-4">
                    {payment.events.map((ev) => (
                      <li key={ev.id} className="ml-4 pl-2">
                        <span className="absolute -left-[7px] flex items-center justify-center w-3 h-3 rounded-full bg-primary ring-2 ring-white dark:ring-slate-900" />
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
                            {ev.type}
                          </Badge>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {ev.status}
                          </span>
                          {ev.amount != null && ev.amount > 0 && (
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {formatCurrency(ev.amount)}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 ml-auto">
                            {formatPaymentDate(ev.createdAt)}
                          </span>
                        </div>
                        {ev.message && (
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                            {ev.message}
                          </p>
                        )}
                        {ev.providerRef && (
                          <p className="text-[11px] font-mono text-slate-500 mt-1 break-all">
                            ref: {ev.providerRef}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column — customer + driver + payout */}
          <div className="space-y-6">
            {customer && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {customer.customerType === 'BUSINESS' ? (
                      <Building2 className="w-4 h-4 text-primary" />
                    ) : (
                      <User className="w-4 h-4 text-primary" />
                    )}
                    Customer
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <InfoRow
                    icon={Hash}
                    label="Customer ID"
                    value={customer.id}
                    copyable
                    mono
                  />
                  <InfoRow
                    icon={User}
                    label="Type"
                    value={customer.customerType === 'BUSINESS' ? 'Business' : 'Private'}
                  />
                  {customer.businessName && (
                    <InfoRow
                      icon={Building2}
                      label="Business Name"
                      value={customer.businessName}
                    />
                  )}
                  {customer.contactName && (
                    <InfoRow
                      icon={User}
                      label="Contact Name"
                      value={customer.contactName}
                    />
                  )}
                  {customer.contactEmail && (
                    <InfoRow
                      icon={Mail}
                      label="Email"
                      value={customer.contactEmail}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {activeAssignment && driverUser && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="w-4 h-4 text-primary" />
                    Assigned Driver
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <InfoRow
                    icon={Hash}
                    label="Driver ID"
                    value={activeAssignment.driverId}
                    copyable
                    mono
                  />
                  {driverUser.fullName && (
                    <InfoRow
                      icon={User}
                      label="Name"
                      value={driverUser.fullName}
                    />
                  )}
                  <InfoRow
                    icon={Mail}
                    label="Email"
                    value={driverUser.email}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Assigned At"
                    value={formatPaymentDate(activeAssignment.assignedAt)}
                  />
                  <InfoRow
                    icon={User}
                    label="Driver Status"
                    value={<Badge variant="outline" className="text-[11px]">{activeAssignment.driver.status}</Badge>}
                  />
                </CardContent>
              </Card>
            )}

            {payout && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Banknote className="w-4 h-4 text-primary" />
                    Driver Payout
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <InfoRow
                    icon={Hash}
                    label="Payout ID"
                    value={payout.id}
                    copyable
                    mono
                  />
                  <InfoRow
                    icon={Banknote}
                    label="Net Amount"
                    value={formatCurrency(payout.netAmount)}
                  />
                  <InfoRow
                    icon={CheckCircle}
                    label="Status"
                    value={<Badge variant="outline" className="text-[11px]">{payout.status}</Badge>}
                  />
                  {payout.paidAt && (
                    <InfoRow
                      icon={Calendar}
                      label="Paid At"
                      value={formatPaymentDate(payout.paidAt)}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ─── Mark Invoiced dialog ─── */}
        <Dialog open={markInvoicedOpen} onOpenChange={setMarkInvoicedOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Mark as Invoiced
              </DialogTitle>
              <DialogDescription>
                Record an invoice ID for this postpaid payment. The customer will be
                billed via invoice rather than the captured Stripe charge.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="invoiceId" className="text-xs">Invoice ID *</Label>
                <Input
                  id="invoiceId"
                  value={invoicedForm.invoiceId}
                  onChange={(e) => setInvoicedForm(prev => ({ ...prev, invoiceId: e.target.value }))}
                  placeholder="INV-2026-001"
                  className="rounded-xl mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="note" className="text-xs">Note (optional)</Label>
                <Input
                  id="note"
                  value={invoicedForm.note}
                  onChange={(e) => setInvoicedForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Reason for invoice"
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkInvoicedOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={submitMarkInvoiced}
                disabled={paymentActions.markInvoiced.isPending || !invoicedForm.invoiceId.trim()}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                {paymentActions.markInvoiced.isPending && (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                )}
                Mark Invoiced
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Mark Paid dialog ─── */}
        <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Mark as Paid
              </DialogTitle>
              <DialogDescription>
                Mark this invoiced payment as paid. Use after the customer has
                settled the invoice outside of Stripe.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="paidNote" className="text-xs">Note (optional)</Label>
                <Input
                  id="paidNote"
                  value={markPaidForm.note}
                  onChange={(e) => setMarkPaidForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Reason / reference"
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPaidOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={submitMarkPaid}
                disabled={paymentActions.markPaid.isPending}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {paymentActions.markPaid.isPending && (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                )}
                Mark Paid
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Mark Payout Paid dialog ─── */}
        <Dialog open={markPayoutPaidOpen} onOpenChange={setMarkPayoutPaidOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-600" />
                Mark Payout as Paid
              </DialogTitle>
              <DialogDescription>
                Record the provider transfer ID for the driver payout. Marks the
                payout row as PAID so it stops appearing as eligible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="transferId" className="text-xs">Provider Transfer ID *</Label>
                <Input
                  id="transferId"
                  value={markPayoutForm.providerTransferId}
                  onChange={(e) => setMarkPayoutForm(prev => ({ ...prev, providerTransferId: e.target.value }))}
                  placeholder="tr_..."
                  className="rounded-xl mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="payoutNote" className="text-xs">Note (optional)</Label>
                <Input
                  id="payoutNote"
                  value={markPayoutForm.note}
                  onChange={(e) => setMarkPayoutForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Reason / reference"
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPayoutPaidOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={submitMarkPayoutPaid}
                disabled={paymentActions.markPayoutPaid.isPending || !markPayoutForm.providerTransferId.trim()}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              >
                {paymentActions.markPayoutPaid.isPending && (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                )}
                Mark Payout Paid
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Refund Dialog ──
            Supports both full and partial refunds. For partial, the
            admin enters an amount + optional note. The backend validates
            that the amount doesn't exceed the remaining refundable balance.
            The webhook handles updating the payment status + driver clawback. */}
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Process Refund
              </DialogTitle>
              <DialogDescription>
                Issue a refund to the customer's card via Stripe. This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Refund mode selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">Refund Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={refundMode === 'full' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setRefundMode('full')}
                  >
                    Full (${Number(payment.amount).toFixed(2)})
                  </Button>
                  <Button
                    type="button"
                    variant={refundMode === 'partial' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setRefundMode('partial')}
                  >
                    Partial
                  </Button>
                </div>
              </div>

              {/* Partial refund amount */}
              {refundMode === 'partial' && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">
                    Amount to refund ($)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(payment.amount).toFixed(2)}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00"
                    className="rounded-xl"
                  />
                  {payment.status === 'REFUNDED' && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Already refunded: ${(Number(payment.refundedAmountCents ?? 0) / 100).toFixed(2)} of ${Number(payment.amount).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Refund note (optional) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">
                  Note (optional — for audit trail)
                </Label>
                <Textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="Reason for refund..."
                  className="rounded-xl"
                  rows={2}
                />
              </div>

              {/* Warning */}
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30">
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  <strong>What happens:</strong>
                </p>
                <ul className="text-xs text-rose-600 dark:text-rose-400 mt-1 space-y-0.5 ml-4 list-disc">
                  <li>The customer receives the refund on their card (5-10 business days)</li>
                  <li>The driver's payout will be reduced proportionally on their next payout</li>
                  <li>If the driver has already been paid, a clawback adjustment is created</li>
                  <li>The payment status updates automatically via Stripe webhook</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRefundOpen(false);
                  setRefundAmount('');
                  setRefundNote('');
                  setRefundMode('full');
                }}
                className="rounded-xl"
                disabled={refundMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRefund}
                disabled={refundMutation.isPending}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
              >
                {refundMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {refundMode === 'full'
                  ? `Confirm Full Refund ($${Number(payment.amount).toFixed(2)})`
                  : `Confirm Partial Refund ($${refundAmount || '0.00'})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
