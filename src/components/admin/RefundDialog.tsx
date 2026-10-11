import * as React from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDataMutation } from '@/lib/tanstack/dataQuery';

/**
 * Task 132: shared admin refund dialog — the single source of truth for
 * refund UI on BOTH admin pages (payment detail + delivery detail).
 *
 * Extracted verbatim from the payment detail page (the fuller of the two
 * implementations: full + partial modes, remaining-balance math, audit
 * note, "what happens" explainer). The delivery detail page previously
 * had a stripped-down full-only AlertDialog — both pages now render this
 * exact component so the two can never drift apart again.
 *
 * Hardening over the original:
 *  - Esc / overlay click can no longer close the dialog while the refund
 *    is in flight (a mid-flight close made the request look lost).
 *  - Amount + note inputs are disabled while the mutation is pending.
 *  - The partial amount is validated against the remaining refundable
 *    balance client-side (the backend enforces the same bound).
 *
 * The component OWNS: mode/amount/note state, the refund mutation,
 * validation, and the success/failure toasts.
 * The PAGE OWNS: open state, the "refund submitted" banner, and refetches
 * — all wired through the onSuccess callback.
 */

export interface RefundSuccessResult {
  /** Refunded amount in dollars (from the API response). */
  amount: number;
  /** Stripe refund object id (re_...), for display in the page banner. */
  refundId: string;
  /** Pre-refund refundedAmountCents snapshot — the banner-clearing baseline. */
  baselineCents: number;
  /** Stripe refund status ('succeeded' | 'pending' | ...). */
  status?: string;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Payment record id — the refund endpoint is POST /payments/stripe/refund/:paymentId. */
  paymentId: string;
  /** Charge total in cents. */
  totalCents: number;
  /** Amount already refunded in cents (0 for untouched payments). */
  refundedCents: number;
  /** Called after Stripe accepted the refund. The page shows its banner and refetches. */
  onSuccess: (result: RefundSuccessResult) => void;
}

export function RefundDialog({
  open,
  onOpenChange,
  paymentId,
  totalCents,
  refundedCents,
  onSuccess,
}: RefundDialogProps) {
  const [refundMode, setRefundMode] = React.useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = React.useState('');
  const [refundNote, setRefundNote] = React.useState('');

  const safeTotalCents = Number.isFinite(totalCents) ? totalCents : 0;
  const totalAmount = safeTotalCents / 100;
  const refundedSoFar = (Number.isFinite(refundedCents) ? refundedCents : 0) / 100;
  const refundRemaining = Math.max(0, totalAmount - refundedSoFar);
  const partiallyRefunded = refundedSoFar > 0;

  const resetFields = React.useCallback(() => {
    setRefundMode('full');
    setRefundAmount('');
    setRefundNote('');
  }, []);

  const refundMutation = useDataMutation({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/payments/stripe/refund/:paymentId`,
    method: 'POST',
    onSuccess: (data: any) => {
      resetFields();
      onOpenChange(false);
      const amount = typeof data?.amount === 'number' ? data.amount : refundRemaining;
      // The page records the in-progress banner (with the pre-refund
      // baseline) and refetches so the webhook's DB update shows up.
      onSuccess({
        amount,
        refundId: data?.refundId ?? '',
        baselineCents: refundedCents,
        status: data?.status,
      });
      // Don't claim completion we don't have — Stripe confirms most card
      // refunds instantly; some sit in `pending` briefly.
      if (data?.status === 'pending') {
        toast.success('Refund submitted', {
          description: `$${amount.toFixed(2)} refund submitted to Stripe and is processing. ` +
            'The payment status will update automatically once Stripe confirms (usually a few seconds).',
        });
      } else {
        toast.success('Refund processed', {
          description: `$${amount.toFixed(2)} refund accepted by Stripe — funds return to the dealer's card, ` +
            'typically appearing on their statement within 5-10 business days.',
        });
      }
    },
    onError: (error: any) => {
      toast.error('Refund failed', {
        description: error?.message || 'Unknown error',
      });
    },
  });

  const handleRefund = () => {
    if (!paymentId) return;
    const amount = refundMode === 'partial' ? parseFloat(refundAmount) : undefined;
    if (refundMode === 'partial') {
      if (!amount || amount <= 0) {
        toast.error('Invalid amount', { description: 'Please enter a valid refund amount.' });
        return;
      }
      // Mirror of the backend's remaining-balance validation — catch it
      // here so the admin gets an instant, specific message.
      if (amount > refundRemaining + 0.001) {
        toast.error('Amount too high', {
          description: `Only $${refundRemaining.toFixed(2)} remains refundable on this payment.`,
        });
        return;
      }
    }
    refundMutation.mutate({
      pathParams: { paymentId },
      // Empty/whitespace note is omitted entirely — the backend only
      // attaches adminNote when the admin actually typed a reason.
      note: refundNote.trim() || undefined,
      amount,
    });
  };

  // While a refund is in flight the dialog must stay open — closing it
  // mid-request makes the refund look lost (the request actually
  // completes and the webhook still fires).
  const handleOpenChange = (next: boolean) => {
    if (!next && refundMutation.isPending) return;
    if (!next) resetFields();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            Process Refund
          </DialogTitle>
          <DialogDescription>
            Issue a refund to the customer's card via Stripe. This action
            cannot be undone.
            {partiallyRefunded &&
              ` This payment is PARTIALLY refunded — $${refundedSoFar.toFixed(2)} of $${totalAmount.toFixed(2)} has already been returned to the dealer's card.`}
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
                disabled={refundMutation.isPending}
              >
                Full (${refundRemaining < totalAmount ? `${refundRemaining.toFixed(2)} remaining` : `${totalAmount.toFixed(2)}`})
              </Button>
              <Button
                type="button"
                variant={refundMode === 'partial' ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl"
                onClick={() => setRefundMode('partial')}
                disabled={refundMutation.isPending}
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
                max={refundRemaining.toFixed(2)}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="rounded-xl"
                disabled={refundMutation.isPending}
              />
              {partiallyRefunded && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Partially refunded: ${refundedSoFar.toFixed(2)} of ${totalAmount.toFixed(2)} already returned — most you can refund now is ${refundRemaining.toFixed(2)}
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
              disabled={refundMutation.isPending}
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
            onClick={() => handleOpenChange(false)}
            className="rounded-xl"
            disabled={refundMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            disabled={refundMutation.isPending || !paymentId}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
          >
            {refundMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {refundMode === 'full'
              ? `Confirm Full Refund ($${refundRemaining.toFixed(2)}${partiallyRefunded ? ' remaining' : ''})`
              : `Confirm Partial Refund ($${refundAmount || '0.00'})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
