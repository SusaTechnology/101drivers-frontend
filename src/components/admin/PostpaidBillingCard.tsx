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

export default function PostpaidBillingCard({ dealerId }: { dealerId: string }) {
  const [setupLoading, setSetupLoading] = useState(false)
  const [unfreezeLoading, setUnfreezeLoading] = useState(false)
  const [retryLoading, setRetryLoading] = useState(false)
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<'PREPAID' | 'POSTPAID'>('PREPAID')

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

  // ── Billing mode switch ──
  // Fetches eligibility when the switch dialog opens
  const { data: switchEligibility, isLoading: eligibilityLoading, refetch: refetchEligibility } = useDataQuery<{
    canSwitch: boolean
    blockReason: string | null
    outstandingBalance: number
    pendingDeliveryCount: number
    failedChargeCount: number
    hasSavedPaymentMethod: boolean
    currentMode: 'PREPAID' | 'POSTPAID'
    stripeSubscriptionId: string | null
  }>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealerId}/switch-check`,
    noFilter: true,
    enabled: false, // only fetch when dialog opens
  })

  const switchMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealerId}/switch-billing`,
    method: 'POST',
    onSuccess: () => {
      toast.success(`Switched to ${switchTarget === 'PREPAID' ? 'Prepaid' : 'Postpaid'}`)
      setSwitchLoading(false)
      setSwitchDialogOpen(false)
      refetch()
    },
    onError: (error: Error) => {
      toast.error('Switch failed', { description: error.message })
      setSwitchLoading(false)
    },
  })

  const openSwitchDialog = (target: 'PREPAID' | 'POSTPAID') => {
    setSwitchTarget(target)
    setSwitchDialogOpen(true)
    refetchEligibility()
  }

  const handleConfirmSwitch = async () => {
    setSwitchLoading(true)
    switchMutation.mutate({ mode: switchTarget })
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

  return (
    <Card className={cn(
      'rounded-2xl border-slate-200 dark:border-slate-800',
      !status.postpaidEnabled && 'opacity-60'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Postpaid Billing
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
        {/* Inactive notice — shown when the dealer is on Prepaid (postpaidEnabled=false) */}
        {!status.postpaidEnabled && (
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

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={handleSetup}
            disabled={setupLoading}
            className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
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
            disabled={!status.billingFrozen || unfreezeLoading}
            variant="outline"
            className="rounded-xl"
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
            disabled={!status.billingFrozen || retryLoading}
            variant="outline"
            className="rounded-xl"
            size="sm"
          >
            {retryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className="ml-1 font-bold">Retry Charge</span>
          </Button>
        </div>

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
