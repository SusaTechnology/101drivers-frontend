// PostpaidBillingCard — admin-side card for managing a dealer's weekly
// postpaid billing. Rendered on the admin user-detail page when the
// customer is BUSINESS + postpaidEnabled=true (or when admin wants to
// set them up).
//
// Buttons:
//   • Setup Postpaid (POST /postpaid-billing/dealers/:id/setup) — creates
//     the Stripe Customer + $0/wk anchor Subscription. Idempotent.
//   • Unfreeze (POST /postpaid-billing/dealers/:id/unfreeze) — clears
//     billingFrozen after admin confirms dealer has fixed their card.
//   • Retry Charge (POST /postpaid-billing/dealers/:id/retry-charge) —
//     calls Stripe.pay on the most recent open invoice.
//
// Status display (GET /postpaid-billing/dealers/:id/status):
//   • billingMode, billingFrozen, billingFrozenReason
//   • outstanding balance + unpaid delivery count
//   • Stripe Customer / Subscription / default PM IDs (for debugging)
//   • List of unpaid Payment rows
//
// Cap input is intentionally NOT shown here — per product decision, the
// cap UI is kept out for now. The backend logic (setCreditCap /
// postpaidCreditLimitCents) remains in place; admin can still set it via
// direct API call if needed.
//
// Props:
//   • dealerId — the customer's ID (used to build the API endpoints)
//   • highlight — when true, the card is rendered with an emphasized
//     border + shadow + a "Setup required" banner to draw the admin's
//     attention. Set by the parent after a successful billing-mode
//     switch from prepaid → postpaid (only when no existing Stripe
//     customer/subscription is present, so the admin remembers to click
//     the "Setup Postpaid" button).
//   • onSetupComplete — callback invoked when the admin clicks the
//     "Setup Postpaid" button and the API call succeeds. The parent
//     uses this to clear the highlight state.

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  RefreshCw,
  Loader2,
  Settings,
  Unlock,
  RotateCcw,
  CreditCard,
  DollarSign,
  Calendar,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL

interface PostpaidAdminStatus {
  dealerId: string
  businessName: string | null
  approvalStatus: string
  postpaidEnabled: boolean
  billingMode: string | null
  billingFrozen: boolean
  billingFrozenAt: string | null
  billingFrozenReason: string | null
  capCents: number | null
  outstandingCents: number
  outstandingDollars: number
  unpaidDeliveryCount: number
  stripe: {
    customerId: string | null
    subscriptionId: string | null
    defaultPaymentMethodId: string | null
  }
  unpaidPayments: Array<{
    paymentId: string
    deliveryId: string
    amount: number
    status: string
    stripeInvoiceItemId: string | null
  }>
}

interface PostpaidBillingCardProps {
  dealerId: string
  /** When true, the card gets an emphasized border + shadow + a setup
   * banner to draw the admin's attention. Set by the parent after a
   * successful switch from prepaid → postpaid when no existing Stripe
   * customer/subscription is present. */
  highlight?: boolean
  /** Called when the admin successfully clicks "Setup Postpaid" and the
   * API call returns. Parent uses this to clear the highlight. */
  onSetupComplete?: () => void
}

export default function PostpaidBillingCard({
  dealerId,
  highlight = false,
  onSetupComplete,
}: PostpaidBillingCardProps) {
  const [setupLoading, setSetupLoading] = useState(false)
  const [unfreezeLoading, setUnfreezeLoading] = useState(false)
  const [retryLoading, setRetryLoading] = useState(false)

  const {
    data: status,
    isLoading,
    refetch,
    isFetching,
  } = useDataQuery<PostpaidAdminStatus>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealerId}/status`,
    noFilter: true,
    enabled: Boolean(dealerId),
    refetchInterval: 60 * 1000,
  })

  const setupMutation = useDataMutation<
    { customerId: string; stripeCustomerId: string; stripeSubscriptionId: string; billingMode: string },
    { dealerId: string }
  >({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealerId}/setup`,
    method: 'POST',
    onSuccess: (data) => {
      toast.success('Postpaid setup complete', {
        description: `Stripe Customer ${data.stripeCustomerId} • Subscription ${data.stripeSubscriptionId}`,
      })
      refetch()
      onSetupComplete?.()
    },
    onError: (error: any) => {
      toast.error('Postpaid setup failed', {
        description: error?.message || 'Unknown error',
      })
    },
  })

  const unfreezeMutation = useDataMutation<void, { dealerId: string }>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealerId}/unfreeze`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Dealer unfrozen')
      refetch()
    },
    onError: (error: any) => {
      toast.error('Unfreeze failed', { description: error?.message })
    },
  })

  const retryMutation = useDataMutation<void, { dealerId: string }>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealerId}/retry-charge`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Retry triggered', {
        description: 'Stripe will fire a webhook when the charge settles.',
      })
      // Give Stripe a few seconds, then refetch
      setTimeout(() => refetch(), 5000)
    },
    onError: (error: any) => {
      toast.error('Retry failed', { description: error?.message })
    },
  })

  const handleSetup = async () => {
    setSetupLoading(true)
    try {
      await setupMutation.mutateAsync({ dealerId })
    } finally {
      setSetupLoading(false)
    }
  }

  const handleUnfreeze = async () => {
    setUnfreezeLoading(true)
    try {
      await unfreezeMutation.mutateAsync({ dealerId })
    } finally {
      setUnfreezeLoading(false)
    }
  }

  const handleRetry = async () => {
    setRetryLoading(true)
    try {
      await retryMutation.mutateAsync({ dealerId })
    } finally {
      setRetryLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-4 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading postpaid billing status...</span>
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return null
  }

  // Has at least one CHARGE_FAILED payment? Used to enable the retry
  // button even when the dealer isn't frozen (1-2 failures don't freeze
  // per the graduated policy, but admin may still want to retry the
  // open invoice).
  const hasFailedCharge = status.unpaidPayments.some(
    (p) => p.status === 'CHARGE_FAILED',
  )

  // Retry button is enabled when:
  //   • dealer is on postpaid, AND
  //   • has a Stripe subscription (retry needs an open invoice to call
  //     Stripe.pay on), AND
  //   • there's something to retry — either the dealer is frozen OR
  //     there's at least one CHARGE_FAILED payment in the list.
  const canRetry =
    status.postpaidEnabled &&
    Boolean(status.stripe.subscriptionId) &&
    (status.billingFrozen || hasFailedCharge)

  return (
    <Card
      id="postpaid-billing-card"
      className={cn(
        'rounded-2xl transition-all duration-500',
        // Default border
        'border-slate-200 dark:border-slate-800',
        // When on prepaid, dim the card
        !status.postpaidEnabled && 'opacity-60',
        // When highlight is on, emphasize with blue border + shadow + pulse
        highlight &&
          'border-blue-500 dark:border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.18),0_12px_32px_-8px_rgba(59,130,246,0.45)] ring-2 ring-blue-400/40 animate-[pulse_2.5s_ease-in-out_infinite]',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Postpaid Billing
            {highlight && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px] ml-1 animate-pulse">
                <Sparkles className="w-3 h-3 mr-1" />
                Setup complete
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 text-xs"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Highlight banner — shown when the parent just switched this
            dealer from prepaid to postpaid. With the AUTO-SETUP pattern,
            the switch always either:
              (a) reactivates an existing Stripe subscription, OR
              (b) creates a new Stripe customer + subscription.
            So by the time we render this banner, the dealer should ALWAYS
            have a stripeSubscriptionId. If somehow they don't (e.g.
            Stripe was unavailable between the switch and this status
            refetch), we show the "needs setup" fallback below. */}
        {highlight && status.stripe.subscriptionId && (
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 animate-pulse">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="text-xs text-green-800 dark:text-green-200">
                <p className="font-bold">Switched to Postpaid billing — setup complete</p>
                <p className="mt-1">
                  A Stripe customer + $0/week subscription has been created (or
                  reactivated) for this dealer. They can now create postpaid
                  deliveries. Subscription ID:{' '}
                  <span className="font-mono text-[10px]">
                    {status.stripe.subscriptionId.slice(0, 30)}...
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Defensive fallback — shown if the parent just switched but
            the subscription ID is somehow still null (e.g. Stripe was
            unavailable between the switch and this status refetch).
            This should be very rare with the auto-setup pattern. */}
        {highlight && !status.stripe.subscriptionId && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 animate-pulse">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <p className="font-bold">Switched to Postpaid — Stripe setup missing</p>
                <p className="mt-1">
                  The billing mode is postpaid but no Stripe subscription was
                  found. Click the <strong>Setup Postpaid</strong> button below
                  to create the Stripe customer + subscription. New postpaid
                  deliveries cannot be created until setup is complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Inactive notice — shown when the dealer is on Prepaid (postpaidEnabled=false) */}
        {!status.postpaidEnabled && !highlight && (
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <p className="font-bold">This section is inactive</p>
                <p className="mt-1">
                  The dealer is on <strong>Prepaid</strong> billing — new deliveries are charged immediately at creation.
                  The Stripe subscription{status.stripe.subscriptionId ? ' (shown below)' : ''} has been cancelled at period end
                  {status.stripe.subscriptionId ? ' (or will be)' : ''}.
                  Any pending postpaid charges from the current billing cycle will still be collected.
                </p>
                <p className="mt-1 text-slate-400">
                  To re-enable Postpaid billing, edit the customer profile and change Payment Type to Postpaid.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              status.billingMode === 'WEEKLY_POSTPAID'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }
          >
            {status.billingMode || 'Not onboarded'}
          </Badge>
          {status.billingFrozen ? (
            <Badge variant="destructive">Frozen</Badge>
          ) : (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Active
            </Badge>
          )}
          {status.stripe.subscriptionId ? (
            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Stripe Sub ✓
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              No Subscription
            </Badge>
          )}
          {status.stripe.defaultPaymentMethodId ? (
            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Card on file
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              No card on file
            </Badge>
          )}
        </div>

        {/* Frozen reason */}
        {status.billingFrozen && status.billingFrozenReason && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-red-700 dark:text-red-300">Frozen since {new Date(status.billingFrozenAt!).toLocaleString()}</p>
                <p className="text-red-600 dark:text-red-400 mt-1">{status.billingFrozenReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Outstanding balance + unpaid count */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <DollarSign className="h-3 w-3" />
              Outstanding
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              ${status.outstandingDollars.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {status.unpaidDeliveryCount} unpaid {status.unpaidDeliveryCount === 1 ? 'delivery' : 'deliveries'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Calendar className="h-3 w-3" />
              Cap
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {status.capCents === null ? '∞' : `$${(status.capCents / 100).toFixed(0)}`}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {status.capCents === null ? 'No limit set' : `$${status.outstandingDollars.toFixed(2)} used`}
            </div>
          </div>
        </div>

        {/* Stripe IDs (debug) */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Stripe refs
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            customer: {status.stripe.customerId || '—'}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            subscription: {status.stripe.subscriptionId || '—'}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            default_pm: {status.stripe.defaultPaymentMethodId || '—'}
          </div>
        </div>

        {/* Action buttons — disabled when on prepaid mode */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={handleSetup}
            disabled={setupLoading || !status.postpaidEnabled}
            className={cn(
              'rounded-xl text-white hover:bg-blue-700',
              // When highlighted (setup required), make the button pop
              highlight && !status.stripe.subscriptionId
                ? 'bg-blue-600 ring-2 ring-blue-400 ring-offset-2 shadow-lg'
                : 'bg-blue-600',
              !status.postpaidEnabled && 'opacity-40',
            )}
            size="sm"
          >
            {setupLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            <span className="ml-1 font-bold">
              {status.stripe.subscriptionId ? 'Re-run Setup' : 'Setup Postpaid'}
            </span>
          </Button>

          <Button
            onClick={handleUnfreeze}
            disabled={!status.postpaidEnabled || !status.billingFrozen || unfreezeLoading}
            variant="outline"
            className="rounded-xl disabled:opacity-40"
            size="sm"
          >
            {unfreezeLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            <span className="ml-1 font-bold">Unfreeze</span>
          </Button>

          <Button
            onClick={handleRetry}
            disabled={!canRetry || retryLoading}
            variant="outline"
            className={cn(
              'rounded-xl',
              // Keep retry button visible (not dimmed) when it's actionable;
              // only dim it when there's genuinely nothing to retry.
              canRetry ? '' : 'opacity-40',
            )}
            size="sm"
            title={
              !status.postpaidEnabled
                ? 'Retry is only available for postpaid customers'
                : !status.stripe.subscriptionId
                ? 'No Stripe subscription — run Setup first'
                : !canRetry
                ? 'No failed charges to retry'
                : 'Retry the most recent failed weekly invoice'
            }
          >
            {retryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className="ml-1 font-bold">Retry Charge</span>
          </Button>
        </div>

        {/* Helper hint when retry is available but not frozen */}
        {canRetry && !status.billingFrozen && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            There are failed charges ready to retry. Click <strong>Retry Charge</strong>{' '}
            to attempt the most recent failed weekly invoice again.
          </p>
        )}

        {/* Helper hint when retry is not available but the dealer is on postpaid */}
        {!canRetry && status.postpaidEnabled && status.stripe.subscriptionId && (
          <p className="text-[11px] text-slate-400">
            Retry is only available when there's a failed charge to retry.
          </p>
        )}

        {status.stripe.subscriptionId && !status.stripe.defaultPaymentMethodId && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Dealer has a subscription but no saved card. The next weekly
            invoice will fail and freeze them. Tell the dealer to add a
            card via their Payment Methods page.
          </p>
        )}

        {/* Unpaid payments list (collapsible-looking, but always visible for admin) */}
        {status.unpaidPayments.length > 0 && (
          <div className="pt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Unpaid payments ({status.unpaidPayments.length})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {status.unpaidPayments.map((p) => (
                <div
                  key={p.paymentId}
                  className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-slate-50 dark:bg-slate-800/50"
                >
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    {p.deliveryId.slice(-8)}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ${Number(p.amount).toFixed(2)}
                  </span>
                  <Badge variant="outline" className="text-[9px] h-4">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
