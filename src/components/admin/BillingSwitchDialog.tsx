/**
 * BillingSwitchDialog — reusable confirmation dialog for switching
 * a dealer between Prepaid and Postpaid billing.
 *
 * Used by: admin-user-detail.tsx (the only page where billing mode
 * can be switched).
 *
 * Flow:
 *   1. Parent calls openBillingSwitch(target)
 *   2. Dialog opens + fetches GET /switch-check (pre-check)
 *   3. If blocked: shows the block reason (red alert)
 *   4. If allowed: shows impact summary + stats
 *   5. Admin clicks "Confirm Switch" → POST /switch-billing
 *   6. On success: calls onSwitchComplete() so parent can refetch
 *
 * The parent owns the state (open, loading, eligibility data) and
 * passes it as props. This component is purely presentational —
 * it doesn't manage its own API calls.
 */

import { Loader2, ArrowLeftRight, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface SwitchEligibility {
  canSwitch: boolean;
  blockReason: string | null;
  outstandingBalance: number;
  pendingDeliveryCount: number;
  failedChargeCount: number;
  hasSavedPaymentMethod: boolean;
  currentMode: 'PREPAID' | 'POSTPAID';
  stripeSubscriptionId: string | null;
}

interface BillingSwitchDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  target: 'PREPAID' | 'POSTPAID';
  eligibility: SwitchEligibility | null;
  loadingEligibility: boolean;
  loadingSwitch: boolean;
}

export function BillingSwitchDialog({
  open,
  onClose,
  onConfirm,
  target,
  eligibility,
  loadingEligibility,
  loadingSwitch,
}: BillingSwitchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-slate-500" />
            Switch to {target === 'PREPAID' ? 'Prepaid' : 'Postpaid'} Billing
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Review the impact before confirming this change.
          </DialogDescription>
        </DialogHeader>

        {loadingEligibility ? (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" />
            <p className="text-xs text-slate-400 mt-2">Checking eligibility...</p>
          </div>
        ) : eligibility ? (
          <div className="space-y-3">
            {/* Block reason */}
            {!eligibility.canSwitch && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                    {eligibility.blockReason}
                  </p>
                </div>
              </div>
            )}

            {/* Impact summary */}
            {eligibility.canSwitch && (
              <>
                {target === 'PREPAID' ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                        <p className="font-bold">Switching to Prepaid — what happens:</p>
                        <p>• New deliveries will be charged immediately at creation</p>
                        <p>• The Stripe subscription will be cancelled at the end of the current billing period</p>
                        {eligibility.pendingDeliveryCount > 0 && (
                          <p>• <strong>{eligibility.pendingDeliveryCount} completed delivery(ies) (${eligibility.outstandingBalance.toFixed(2)})</strong> will still be billed via the current postpaid cycle — no money is lost</p>
                        )}
                        <p>• The customer&apos;s saved card stays on file for prepaid charges</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        <p className="font-bold">Switching to Postpaid — what happens:</p>
                        <p>• New deliveries will be billed weekly via Stripe invoices</p>
                        <p>• A Stripe customer + subscription will be created (if not already)</p>
                        <p>• No immediate charge — the customer pays when the weekly invoice is finalized</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Outstanding</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white">${eligibility.outstandingBalance.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Pending deliveries</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{eligibility.pendingDeliveryCount}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Failed charges</p>
                    <p className={cn('text-sm font-black', eligibility.failedChargeCount > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white')}>{eligibility.failedChargeCount}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Saved card</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{eligibility.hasSavedPaymentMethod ? '✅ Yes' : '❌ No'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Failed to load eligibility. Close and try again.</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          {eligibility?.canSwitch && (
            <Button
              onClick={onConfirm}
              disabled={loadingSwitch}
              className={cn(
                'rounded-xl text-white font-bold',
                target === 'PREPAID'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {loadingSwitch ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span className="ml-1">Confirm Switch</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
