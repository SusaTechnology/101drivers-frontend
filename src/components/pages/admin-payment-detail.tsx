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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
                {(payment.failureCode || payment.failureMessage) && (
                  <div className="mt-4 p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                        Failure
                      </span>
                    </div>
                    {payment.failureCode && (
                      <div className="text-sm font-mono text-rose-700 dark:text-rose-300">
                        {payment.failureCode}
                      </div>
                    )}
                    {payment.failureMessage && (
                      <div className="text-sm text-rose-600 dark:text-rose-400 mt-1">
                        {payment.failureMessage}
                      </div>
                    )}
                  </div>
                )}
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
      </main>
    </div>
  );
}
