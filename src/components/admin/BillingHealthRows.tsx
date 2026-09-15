// BillingHealthRows — action rows for the admin "Billing Health" page.
//
// Each row owns its own mutations against the EXISTING per-dealer
// endpoints (the same ones the Postpaid Billing card on the dealer
// profile uses — retry-charge / unfreeze). Nothing new executes here;
// this file only puts those actions one click away from a fleet-wide
// list, so the admin doesn't have to open each profile to act.
//
// Unfreeze uses a two-click confirm (the button flips to "Confirm" for
// a few seconds) — unfreezing bypasses the failed-payment protection,
// so a stray click on a list row shouldn't do it silently.

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Building2,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  Unlock,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDataMutation } from '@/lib/tanstack/dataQuery'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL

export interface FrozenDealerRowData {
  dealerId: string
  businessName: string | null
  contactEmail: string | null
  billingFrozenAt: string | null
  billingFrozenReason: string | null
  hasSavedCard: boolean
  hasSubscription: boolean
  capCents: number | null
  outstandingCents: number
  outstandingDollars: number
  unpaidDeliveryCount: number
  failedPaymentCount: number
  lastFailureAt: string | null
  lastFailureCode: string | null
  maxAttemptCount: number | null
}

export interface WarningDealerRowData {
  dealerId: string
  businessName: string | null
  contactEmail: string | null
  hasSavedCard: boolean
  hasSubscription: boolean
  capCents: number | null
  failedPaymentCount: number
  failedAmountDollars: number
  lastFailureAt: string | null
  lastFailureCode: string | null
  maxAttemptCount: number | null
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `$${amount.toFixed(2)}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "3d ago" style relative label for failure/freeze timestamps. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/** Shared identity + stat cells so frozen/warning rows stay visually consistent. */
function RowIdentity({
  name,
  email,
  dealerId,
}: {
  name: string | null
  email: string | null
  dealerId: string
}) {
  const navigate = useNavigate()
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="font-bold text-slate-900 dark:text-white truncate">
          {name || 'Unnamed dealer'}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {email && (
          <span className="flex items-center gap-1 truncate">
            <Mail className="w-3 h-3" />
            {email}
          </span>
        )}
        <button
          onClick={() => navigate({ to: `/admin-user-detail/${dealerId}` })}
          className="flex items-center gap-1 text-primary hover:underline shrink-0"
          title="Open the dealer's admin profile"
        >
          <User className="w-3 h-3" />
          View dealer
        </button>
      </div>
    </div>
  )
}

function CardStatusBadges({
  hasSavedCard,
  hasSubscription,
}: {
  hasSavedCard: boolean
  hasSubscription: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {hasSavedCard ? (
        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] h-5">
          <CreditCard className="w-3 h-3 mr-1" />
          Card on file
        </Badge>
      ) : (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] h-5">
          <CreditCard className="w-3 h-3 mr-1" />
          No card on file — retry will fail
        </Badge>
      )}
      {!hasSubscription && (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] h-5">
          No Stripe subscription — Setup needed
        </Badge>
      )}
    </div>
  )
}

/** One-click retry of the dealer's failed weekly invoice(s). The backend
 * retries EVERY open invoice and reports what happened. */
function useRetryCharge(dealerId: string, refetch: () => void) {
  return useDataMutation<
    { ok: boolean; invoicesRetried: number; succeeded: number; failed: number },
    { dealerId: string }
  >({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealerId}/retry-charge`,
    method: 'POST',
    onSuccess: (data) => {
      const retried = data?.invoicesRetried ?? 0
      const ok = data?.succeeded ?? 0
      if (retried > 1) {
        toast.success(`Retry triggered — ${ok}/${retried} invoice(s) accepted`, {
          description:
            "Stripe will fire a webhook as each charge settles — the list updates automatically.",
        })
      } else {
        toast.success('Retry triggered', {
          description:
            "Stripe will fire a webhook when the charge settles — the list updates automatically.",
        })
      }
      // Give Stripe a few seconds, then refresh so the row reflects reality.
      setTimeout(() => refetch(), 5000)
    },
    onError: (error: any) => {
      toast.error('Retry failed', { description: error?.message })
    },
  })
}

// ─── Frozen dealer row ───────────────────────────────────────────

export function FrozenDealerRow({
  dealer,
  refetch,
}: {
  dealer: FrozenDealerRowData
  refetch: () => void
}) {
  const [pendingAction, setPendingAction] = useState<'retry' | 'unfreeze' | null>(
    null,
  )
  const [confirmingUnfreeze, setConfirmingUnfreeze] = useState(false)

  const retryMutation = useRetryCharge(dealer.dealerId, refetch)

  const unfreezeMutation = useDataMutation<void, { dealerId: string }>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/dealers/${dealer.dealerId}/unfreeze`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Dealer unfrozen', {
        description:
          'They can create deliveries again. If the card still fails, the next weekly invoice will re-freeze the account.',
      })
      refetch()
    },
    onError: (error: any) => {
      toast.error('Unfreeze failed', { description: error?.message })
    },
  })

  const handleRetry = async () => {
    setPendingAction('retry')
    try {
      await retryMutation.mutateAsync({ dealerId: dealer.dealerId })
    } finally {
      setPendingAction(null)
    }
  }

  const handleUnfreeze = async () => {
    // Two-click confirm: first click arms the button, second click fires.
    if (!confirmingUnfreeze) {
      setConfirmingUnfreeze(true)
      setTimeout(() => setConfirmingUnfreeze(false), 4000)
      return
    }
    setConfirmingUnfreeze(false)
    setPendingAction('unfreeze')
    try {
      await unfreezeMutation.mutateAsync({ dealerId: dealer.dealerId })
    } finally {
      setPendingAction(null)
    }
  }

  const retryDisabled =
    !dealer.hasSubscription || pendingAction !== null

  return (
    <div
      id={`billing-health-${dealer.dealerId}`}
      className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 p-4"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] gap-4 items-start">
        {/* Identity + card status */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="destructive" className="text-[10px] h-5 gap-1">
              <Lock className="w-3 h-3" />
              Frozen
            </Badge>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              since {formatDate(dealer.billingFrozenAt)} ·{' '}
              {formatRelative(dealer.billingFrozenAt)}
            </span>
          </div>
          <div className="mt-2">
            <RowIdentity
              name={dealer.businessName}
              email={dealer.contactEmail}
              dealerId={dealer.dealerId}
            />
          </div>
          <CardStatusBadges
            hasSavedCard={dealer.hasSavedCard}
            hasSubscription={dealer.hasSubscription}
          />
        </div>

        {/* Money + failure facts */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Outstanding
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
              {formatMoney(dealer.outstandingDollars)}
            </div>
            <div className="text-[9px] text-slate-400">
              {dealer.unpaidDeliveryCount} unpaid
            </div>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Failed
            </div>
            <div className="text-sm font-black text-red-600 dark:text-red-400 mt-0.5">
              {dealer.failedPaymentCount}
            </div>
            <div className="text-[9px] text-slate-400">
              {dealer.lastFailureAt
                ? `last ${formatRelative(dealer.lastFailureAt)}`
                : 'no failures'}
            </div>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Attempts
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
              {dealer.maxAttemptCount ?? '—'}
            </div>
            <div className="text-[9px] text-slate-400 truncate px-1">
              {dealer.lastFailureCode || '—'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex lg:flex-col gap-2 lg:w-44">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl flex-1"
            onClick={handleRetry}
            disabled={retryDisabled}
            title={
              !dealer.hasSubscription
                ? 'No Stripe subscription — run Setup on the dealer profile first'
                : 'Retry the most recent failed weekly invoice'
            }
          >
            {pendingAction === 'retry' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className="ml-1">Retry Charge</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'rounded-xl flex-1',
              confirmingUnfreeze &&
                'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
            )}
            onClick={handleUnfreeze}
            disabled={pendingAction !== null}
            title="Clear the frozen flag after confirming the dealer fixed their card"
          >
            {pendingAction === 'unfreeze' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            <span className="ml-1">
              {confirmingUnfreeze ? 'Confirm unfreeze?' : 'Unfreeze'}
            </span>
          </Button>
        </div>
      </div>

      {/* Frozen reason — the same human-readable string the profile card shows */}
      {dealer.billingFrozenReason && (
        <p className="mt-3 text-[11px] text-red-600 dark:text-red-400 leading-relaxed">
          {dealer.billingFrozenReason}
        </p>
      )}
    </div>
  )
}

// ─── Warning dealer row (failed 1-2 times, not frozen yet) ───────

export function WarningDealerRow({
  dealer,
  refetch,
}: {
  dealer: WarningDealerRowData
  refetch: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const retryMutation = useRetryCharge(dealer.dealerId, refetch)

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retryMutation.mutateAsync({ dealerId: dealer.dealerId })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] gap-4 items-start">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] h-5">
              Failing — attempt {dealer.maxAttemptCount ?? 1}
            </Badge>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              last failure {formatRelative(dealer.lastFailureAt)}
            </span>
          </div>
          <div className="mt-2">
            <RowIdentity
              name={dealer.businessName}
              email={dealer.contactEmail}
              dealerId={dealer.dealerId}
            />
          </div>
          <CardStatusBadges
            hasSavedCard={dealer.hasSavedCard}
            hasSubscription={dealer.hasSubscription}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Failed $
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
              {formatMoney(dealer.failedAmountDollars)}
            </div>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Failed
            </div>
            <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {dealer.failedPaymentCount}
            </div>
          </div>
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Code
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 mt-1 truncate px-1">
              {dealer.lastFailureCode || '—'}
            </div>
          </div>
        </div>

        <div className="flex lg:flex-col gap-2 lg:w-44">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl flex-1"
            onClick={handleRetry}
            disabled={!dealer.hasSubscription || retrying}
            title={
              !dealer.hasSubscription
                ? 'No Stripe subscription — run Setup on the dealer profile first'
                : 'Retry the most recent failed weekly invoice now, before the 3rd failure freezes them'
            }
          >
            {retrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className="ml-1">Retry Charge</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
