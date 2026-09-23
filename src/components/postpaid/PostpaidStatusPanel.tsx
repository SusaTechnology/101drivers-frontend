// PostpaidStatusPanel — dealer-facing summary of their weekly postpaid
// billing state. Pulled from GET /api/postpaid-billing/me/status.
//
// Graduated alert system (like Uber/DoorDash), driven by Stripe's
// invoice attempt_count (1 = initial charge, 2 = first retry, ...):
//   • 1st failure:  amber banner — "Failed payment once" (+ hover note
//                   that the 3rd failed attempt restricts the account)
//   • 2nd failure:  amber banner — "Failed payment twice" (+ same hover)
//   • 3rd+ failure: red banner — account restricted (billingFrozen).
//                   "3 consecutive failures — new deliveries are
//                   paused. Update your card or contact support."
//   • Transient:    no banner (auto-resolves)
//   • Fraud:        admin-only (dealer doesn't see)
//
// The dealer ALWAYS sees:
//   • Next charge — THE number: the final amount Stripe will deduct
//     (upcoming invoice amount_due minus pending referral credits,
//     mirrored with the backend's exact FIFO application rule; falls
//     back to unpaid-deliveries-minus-credits when Stripe has no
//     preview yet, so the dealer never sees a blank dash while owing
//     money). One money figure only — non-technical dealers should
//     never have to reconcile "outstanding" vs "charged"; the owed
//     total still appears in the failure banners when collection
//     actually fails.
//   • Next invoice date
//   • Saved card status
//   • Failed payment details (if any) — amount, reason, attempt #, retry info
//
// The dealer NEVER sees:
//   • Raw Stripe error codes (translated to plain English)
//   • Fraud/security flags (admin-only)
//   • Other dealers' data

import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CreditCard,
  Calendar,
  Receipt,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from '@tanstack/react-router'
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import {
  getStripeErrorInfo,
  getResolutionButtonText,
  shouldShowDealer,
} from '@/lib/stripe-error-codes'
import { usePersistentCollapsed } from '@/hooks/usePersistentCollapsed'
import ChargeBreakdownDialog, {
  formatBreakdownMoney,
  type ChargeBreakdownRow,
  type ChargeBreakdownSection,
} from '@/components/postpaid/ChargeBreakdownDialog'

const API_URL = import.meta.env.VITE_API_URL

// Mirror of MAX_FAILURES_BEFORE_RESTRICT in the backend
// postpaidBilling.service.ts — the dealer-facing copy uses the same
// threshold the backend enforces (restrict on the 3rd failure).
const MAX_CONSECUTIVE_FAILURES = 3

// Hover note attached to the amber warnings (badge next to "Weekly
// Postpaid" + banner heading). Mirrors the backend policy exactly:
// restriction lands on the 3rd failed attempt — never the first.
// 1st/2nd failures are yellow warnings only.
const RESTRICT_ON_THIRD_TOOLTIP =
  'Your account will be restricted on the 3rd failed payment attempt. Update your card to avoid interruption.'

interface FailedPayment {
  paymentId: string
  amount: number
  failureCode: string | null
  failureMessage: string | null
  failedAt: string | null
  attemptCount: number | null
  deliveryId: string
  pickupAddress: string
  dropoffAddress: string
  stripeInvoiceId: string | null
}

interface PostpaidStatus {
  dealerId: string
  businessName: string | null
  postpaidEnabled: boolean
  billingMode: string | null
  billingFrozen: boolean
  billingFrozenAt: string | null
  billingFrozenReason: string | null
  capCents: number | null
  outstandingCents: number
  outstandingDollars: number
  unpaidDeliveryCount: number
  // Split of unpaidDeliveryCount (optional — absent on a cached response
  // from a backend that hasn't been redeployed yet): rows whose payment is
  // actively being processed vs rows whose charge failed and is retrying.
  unpaidProcessingCount?: number
  unpaidFailedCount?: number
  hasSavedPaymentMethod: boolean
  nextInvoiceDate: string | null
  /** Stripe's raw upcoming-invoice amount_due (all swept items, before pending credits). */
  upcomingInvoiceAmountCents: number | null
  /** Sum of the dealer's pending (not yet applied) referral credits, in cents. */
  pendingReferralCreditCents: number | null
  /** THE final number: what the next weekly invoice will charge after referral credits. */
  estimatedNextChargeCents: number | null
  // Next-charge breakdown (the clickable "how we got to this amount" view).
  // Optional — keeps the panel safe against a cached response from a
  // backend that hasn't been redeployed yet.
  nextChargeLines?: Array<{
    id: string
    source: 'stripe' | 'db'
    description: string
    amountCents: number
    date: string | null
    deliveryId: string | null
    pickupAddress: string | null
    dropoffAddress: string | null
    completedAt: string | null
    distanceMiles?: number | null
  }>
  // Unpaid local rows NOT on Stripe's upcoming preview (DB↔Stripe drift —
  // e.g. an item already swept into a past invoice whose webhook was
  // missed; nightly reconciliation heals these).
  unreconciledLines?: Array<{
    id: string
    description: string
    amountCents: number
    date: string | null
    deliveryId: string
    pickupAddress: string
    dropoffAddress: string
    distanceMiles?: number | null
  }>
  /** Credits that will actually be applied to this next charge (FIFO). */
  creditsApplyingCents?: number
  failedPayments: FailedPayment[]
}

export default function PostpaidStatusPanel({
  customerId,
  collapsible = false,
}: {
  customerId: string
  /** Show a collapse toggle so the dealer can fold the panel away to
   *  save screen space. Default false (always expanded). */
  collapsible?: boolean
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  // Breakdown dialog — the "how we got to this amount" detail view
  // (a real modal dialog, not an inline collapse).
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const navigate = useNavigate()
  // Persisted collapse state — default is expanded; the dealer's choice
  // to hide the panel survives page reloads.
  const [collapsed, toggleCollapsed] = usePersistentCollapsed(
    'dealer-postpaid-panel-collapsed',
  )

  const { data: status, isLoading, refetch } = useDataQuery<PostpaidStatus>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/me/status`,
    noFilter: true,
    enabled: Boolean(customerId),
    refetchInterval: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <Card className="max-w-[980px] mx-auto border-slate-200 dark:border-slate-800 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading postpaid billing status...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!status) return null
  if (!status.postpaidEnabled) return null

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refetch()
      toast.success('Status refreshed')
    } catch (err: any) {
      toast.error('Failed to refresh', { description: err?.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  const nextInvoiceDate = status.nextInvoiceDate
    ? new Date(status.nextInvoiceDate)
    : null

  // ── Final next-charge number ──
  // Computed by the backend: Stripe's official upcoming-invoice
  // amount_due minus the referral credits that will be applied before
  // the invoice finalizes (same FIFO rule the backend applier uses).
  // Null when the dealer has no active weekly subscription yet.
  // `!== undefined` keeps the panel safe against a cached response from
  // a backend that has not been redeployed yet.
  const estimatedNextCharge =
    status.estimatedNextChargeCents !== null &&
    status.estimatedNextChargeCents !== undefined
      ? (status.estimatedNextChargeCents / 100).toFixed(2)
      : null
  const pendingCreditsDollars =
    status.pendingReferralCreditCents != null &&
    status.pendingReferralCreditCents > 0
      ? (status.pendingReferralCreditCents / 100).toFixed(2)
      : null
  // Whether the next-charge figure is Stripe's OFFICIAL upcoming-invoice
  // amount (preview succeeded) or the backend's DB-side estimate (no
  // Stripe preview available — e.g. weekly billing not fully set up
  // yet, or the dealer has no subscription). The backend always returns
  // a number now, so null only means the backend hasn't been redeployed.
  const isStripeOfficial = status.upcomingInvoiceAmountCents != null

  // ── Breakdown math: deliveries − credits = due ──
  // The single "Next Charge" figure hides WHY it can be $0.00 while N
  // deliveries still show unpaid (credits never zero the Payment rows —
  // they only reduce the invoice). Show the gross so the card reads as
  // "3 unpaid deliveries · $585.72 in deliveries · −$585.72 credits".
  // The applied figure is derived (gross − due, clamped into [0, pending])
  // because the backend applies whole credits FIFO — applied can be less
  // than the pending sum when credits exceed what the invoice needs.
  const grossDeliveriesDollars = (status.outstandingCents / 100).toFixed(2)
  const creditsAppliedDollars = (() => {
    const pending = status.pendingReferralCreditCents ?? 0
    if (pending <= 0) return null
    const due = status.estimatedNextChargeCents ?? status.outstandingCents
    const applied = Math.max(0, Math.min(status.outstandingCents - due, pending))
    return (applied / 100).toFixed(2)
  })()
  const creditsCoverAll =
    status.estimatedNextChargeCents === 0 && creditsAppliedDollars !== null
  // Credits that will actually ride THIS next charge (FIFO-accurate, from
  // the backend) — may be less than the pending sum.
  const creditsApplyingDollars =
    status.creditsApplyingCents != null && status.creditsApplyingCents > 0
      ? (status.creditsApplyingCents / 100).toFixed(2)
      : null

  // ── What is happening with the unpaid deliveries right now ──
  // "Unpaid" must never read as "you owe this NOW" — every unpaid delivery
  // is either being processed for payment (reported usage awaiting the
  // weekly invoice) or waiting to be retried after a failed attempt. The
  // backend splits the count so the subline can say which; fall back to
  // "everything processing" on a cached pre-deploy response.
  const unpaidFailedCount = status.unpaidFailedCount ?? 0
  const unpaidProcessingCount =
    status.unpaidProcessingCount ??
    Math.max(0, status.unpaidDeliveryCount - unpaidFailedCount)
  let unpaidStatusPhrase: string | null = null
  if (status.unpaidDeliveryCount > 0) {
    if (creditsCoverAll) {
      unpaidStatusPhrase = 'covered by your credits'
    } else if (unpaidFailedCount > 0 && unpaidProcessingCount > 0) {
      unpaidStatusPhrase = `${unpaidProcessingCount} processing · ${unpaidFailedCount} failed — retrying`
    } else if (unpaidFailedCount > 0) {
      unpaidStatusPhrase = 'payment failed — retrying'
    } else {
      unpaidStatusPhrase = 'payment being processed'
    }
  }

  // ── Breakdown dialog data ("See how we get to $X") ──
  // Row titles mirror the weekly invoice email's line format
  // ("Delivery #3gifyqd1 — pickup → dropoff (47.3 mi)") so the panel,
  // the dialog and the invoice all speak the same language.
  const rawLines = status.nextChargeLines ?? []
  // Zero-amount lines (the $0/week billing-anchor plan) are noise for a
  // non-technical reader — skip them so every visible row is real money.
  const itemizedLines = rawLines.filter((l) => l.amountCents !== 0)
  const hasItemization = itemizedLines.length > 0

  type BreakdownLine = (typeof itemizedLines)[number]
  const lineTitle = (l: BreakdownLine): string => {
    if (l.deliveryId && l.pickupAddress) {
      const dist =
        l.distanceMiles != null && Number(l.distanceMiles) > 0
          ? ` (${Number(l.distanceMiles).toFixed(1)} mi)`
          : ''
      return `Delivery #${l.deliveryId.slice(-8)} — ${l.pickupAddress} → ${l.dropoffAddress ?? ''}${dist}`
    }
    // Stripe line without a matched local row — strip the trailing
    // "— $X" from Stripe's own description (amount shown on the right).
    return l.description.replace(/\s*[—-]\s*\$[\d,.]+\s*$/, '')
  }
  const toRow = (l: BreakdownLine): ChargeBreakdownRow => {
    const d = l.completedAt ?? l.date
    const dateStr = d
      ? new Date(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null
    return {
      id: l.id,
      title: lineTitle(l),
      subtitle: dateStr
        ? l.deliveryId
          ? `Completed ${dateStr}`
          : dateStr
        : null,
      amountCents: l.amountCents,
    }
  }

  const breakdownSections: ChargeBreakdownSection[] = []
  const positiveRows = itemizedLines
    .filter((l) => l.amountCents > 0)
    .map(toRow)
  if (positiveRows.length) {
    breakdownSections.push({ id: 'deliveries', rows: positiveRows })
  }
  const discountRows = itemizedLines
    .filter((l) => l.amountCents < 0)
    .map(toRow)
  if (status.creditsApplyingCents != null && status.creditsApplyingCents > 0) {
    discountRows.push({
      id: 'referral-credits',
      title: 'Referral credits',
      subtitle: 'Applied automatically before the charge',
      amountCents: -status.creditsApplyingCents,
    })
  }
  if (discountRows.length) {
    breakdownSections.push({
      id: 'discounts',
      heading: 'Refunds & credits',
      description: 'These reduce what you pay.',
      rows: discountRows,
    })
  }
  // Completed deliveries our records show but Stripe's upcoming invoice
  // doesn't (yet) — surfaced separately so the itemized rows and the
  // total always agree.
  const unreconciledRows: ChargeBreakdownRow[] = (
    status.unreconciledLines ?? []
  ).map((l) => {
    const dist =
      l.distanceMiles != null && Number(l.distanceMiles) > 0
        ? ` (${Number(l.distanceMiles).toFixed(1)} mi)`
        : ''
    const dateStr = l.date
      ? new Date(l.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null
    return {
      id: l.id,
      title: `Delivery #${l.deliveryId.slice(-8)} — ${l.pickupAddress} → ${l.dropoffAddress}${dist}`,
      subtitle: dateStr ? `Completed ${dateStr}` : null,
      amountCents: l.amountCents,
    }
  })
  // Money the amber section accounts for — one figure the dealer can tie
  // the "in progress" list to (the user-facing "you have Y to pay").
  const unreconciledTotalCents = unreconciledRows.reduce(
    (sum, r) => sum + r.amountCents,
    0,
  )
  if (unreconciledRows.length) {
    breakdownSections.push({
      id: 'unreconciled',
      tone: 'warning',
      heading: 'Payment in progress',
      description: (
        <>
          These completed deliveries aren&apos;t included in the total above
          yet — we&apos;re still processing their payments.
          <br />
          • If the payment succeeds, each delivery is marked paid on your
          weekly invoice — nothing more happens.
          <br />
          • If the payment fails, the amount moves to a future weekly charge
          and we retry automatically. New deliveries only pause after several
          failed attempts.
          <br />
          Total for these deliveries:{' '}
          <strong>{formatBreakdownMoney(unreconciledTotalCents)}</strong> — a
          delivery is never charged twice.
        </>
      ),
      rows: unreconciledRows,
    })
  }

  // Intro sentence — the words must always agree with the total. The old
  // "Nothing is pending on the upcoming invoice right now." line next to
  // a $818.02 figure is exactly what this replaces.
  const nextChargeCents = status.estimatedNextChargeCents ?? 0
  let breakdownIntro: ReactNode
  if (nextChargeCents === 0) {
    breakdownIntro =
      creditsApplyingDollars !== null || pendingCreditsDollars !== null
        ? 'Your referral credits cover everything right now — nothing will be charged on your next weekly invoice.'
        : unreconciledRows.length > 0
          ? 'Nothing will be charged this week — the deliveries below are still being processed for payment. If a payment fails, the amount moves to a future weekly charge automatically.'
          : 'Nothing is due right now — your next weekly invoice will be $0.00.'
  } else if (!hasItemization) {
    // Itemized rows unavailable (older backend / unexpected preview) —
    // explain the number in words instead of showing an empty list.
    breakdownIntro = (
      <>
        We&apos;re still preparing the itemized list for this amount. Right
        now we can tell you: {status.unpaidDeliveryCount} completed{' '}
        {status.unpaidDeliveryCount === 1 ? 'delivery' : 'deliveries'} totaling{' '}
        {formatBreakdownMoney(status.outstandingCents)}
        {creditsApplyingDollars !== null
          ? `, minus $${creditsApplyingDollars} in referral credits`
          : ''}
        . The full list will appear here as soon as your invoice is prepared.
      </>
    )
  } else if (isStripeOfficial) {
    breakdownIntro =
      'This is the exact amount your next weekly invoice will charge to the card on file. Each line below is one delivery, refund or credit.'
  } else {
    breakdownIntro =
      'Your weekly invoice has not been prepared yet, so this is our estimate from the deliveries below — it locks to the exact amount when the invoice is prepared.'
  }
  const breakdownBadge = isStripeOfficial
    ? { label: 'Final amount', tone: 'green' as const }
    : { label: 'Estimated', tone: 'amber' as const }

  // ── Deep-link to Settings → Payment method ──
  // The single most important action for a dealer with failed charges is
  // updating their card — so every banner gets a button that lands them
  // DIRECTLY on the payment settings section instead of leaving them to
  // find it. The settings page renders after data loads, so the scroll
  // retries until the "Payment method" card exists.
  const goToPaymentSettings = () => {
    navigate({ to: '/dealer-settings' }).catch(() => {
      // Router navigation failed (stale route tree after a deploy) —
      // fall back to a hard navigation so the dealer still gets there.
      window.location.href = '/dealer-settings#payment-method'
    })
    let tries = 0
    const scroll = () => {
      const el = document.getElementById('payment-method')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (tries < 10) {
        tries += 1
        setTimeout(scroll, 150)
      }
    }
    setTimeout(scroll, 250)
  }

  // ── Determine which failed payments to show to the dealer ──
  // Filter out fraud/security errors (admin-only) using the error code map.
  const visibleFailedPayments = (status.failedPayments || []).filter((fp) => {
    if (!fp.failureCode) return true // Unknown error — show generic message
    return shouldShowDealer(fp.failureCode)
  })

  // ── Determine alert severity ──
  // If frozen → red "restricted" alert
  // If failed payments exist but not frozen → amber "action needed" alert
  const isFrozen = status.billingFrozen
  const hasFailures = visibleFailedPayments.length > 0

  // Highest attempt number across the currently-failed charges —
  // Stripe's attempt_count on the invoice (1 = initial charge,
  // 2 = first retry, ...). This IS the "consecutive failures" counter:
  // when a retry succeeds the rows flip to PAID and drop out of this
  // list, so the count resets naturally.
  const maxAttempt = visibleFailedPayments.reduce(
    (max, fp) => Math.max(max, fp.attemptCount || 1),
    1,
  )

  // ── Status badges (shared) ──
  // Rendered in the expanded header AND in the collapsed one-line strip
  // so the live state (Restricted / Action needed / Active) stays
  // glanceable even when the dealer has folded the panel away.
  const statusBadges = (
    <>
      {isFrozen && <Badge variant="destructive">Restricted</Badge>}
      {!isFrozen && hasFailures && (
        <Badge
          className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 cursor-help"
          title={RESTRICT_ON_THIRD_TOOLTIP}
        >
          Failed payment {maxAttempt === 1 ? 'once' : maxAttempt === 2 ? 'twice' : `${maxAttempt} times`}
        </Badge>
      )}
      {!isFrozen && !hasFailures && (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      )}
      {!status.hasSavedPaymentMethod && (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          No card on file
        </Badge>
      )}
    </>
  )

  // ── Collapsed one-line strip ──
  // Folds away the alert banners, failed-charge list and balance grid to
  // save screen space. The 60s status poll keeps running so the badges
  // below stay live — a frozen/action-needed state is still visible.
  if (collapsible && collapsed) {
    return (
      <div className="px-4 py-3">
        <Card className="max-w-[980px] mx-auto border-slate-200 dark:border-slate-800 rounded-2xl">
          <CardContent className="p-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={false}
              title="Expand postpaid billing details"
              className="w-full flex items-center gap-2 text-left group cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-sm font-bold text-slate-900 dark:text-white shrink-0">
                Weekly Postpaid
              </span>
              {statusBadges}
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0">
                Show
                <ChevronDown className="w-4 h-4" />
              </span>
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="max-w-[980px] mx-auto space-y-2">
        {/* ── Graduated alert system ── */}

        {/* RED alert: account restricted (frozen — 3rd+ consecutive failure) */}
        {isFrozen && (
          <Card className="border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-red-700 dark:text-red-300">
                  {maxAttempt >= 2
                    ? `${maxAttempt} consecutive payment attempts failed — new deliveries are paused`
                    : 'Payment attempt failed — new deliveries are paused'}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  We tried charging your card {maxAttempt} {maxAttempt === 1 ? 'time' : 'times'} and every attempt failed. Your outstanding balance of ${status.outstandingDollars.toFixed(2)} is still due.
                </p>
                {status.hasSavedPaymentMethod ? (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    A card is on file but charges are being declined. Update your card below — once a charge succeeds, new deliveries are re-enabled automatically. If you keep seeing this, contact support.
                  </p>
                ) : (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    No card on file. Add a card so the next weekly invoice can succeed.
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {/* Primary CTA: the fastest way out of a restricted
                      account is a working card — make it the loudest
                      button, not a hunt through the settings menu. */}
                  <Button
                    size="sm"
                    className="h-7 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 dark:text-white"
                    onClick={goToPaymentSettings}
                  >
                    <CreditCard className="h-3 w-3 mr-1" />
                    {status.hasSavedPaymentMethod ? 'Update card' : 'Add a card'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-lg border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => {
                      window.location.href = '/help-customer'
                    }}
                  >
                    Contact Support
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AMBER alert: payment failed but account NOT restricted (1st/2nd failure) */}
        {!isFrozen && hasFailures && (
          <Card className="border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p
                  className="font-bold text-amber-700 dark:text-amber-300 cursor-help"
                  title={RESTRICT_ON_THIRD_TOOLTIP}
                >
                  {maxAttempt === 1
                    ? 'Failed payment once'
                    : `Failed payment ${maxAttempt === 2 ? 'twice' : `${maxAttempt} times`}`}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {maxAttempt >= 2
                    ? `Attempt ${maxAttempt} of ${MAX_CONSECUTIVE_FAILURES} failed. Update your payment method now — after ${MAX_CONSECUTIVE_FAILURES} consecutive failures, new deliveries are paused until the balance is paid.`
                    : `Your weekly invoice charge failed. We'll retry automatically — update your payment method before the retry date so it succeeds.`}
                </p>
                {nextInvoiceDate && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Next retry: <strong>{nextInvoiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs rounded-lg border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  onClick={goToPaymentSettings}
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  {status.hasSavedPaymentMethod ? 'Update card' : 'Add a card'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Failed payments detail list (if any) ── */}
        {hasFailures && (
          <Card className="border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Failed charges ({visibleFailedPayments.length})
                </span>
              </div>
              {visibleFailedPayments.map((fp) => {
                const errorInfo = getStripeErrorInfo(fp.failureCode)
                const attemptNo = fp.attemptCount || 1
                return (
                  <div
                    key={fp.paymentId}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            ${fp.amount.toFixed(2)}
                          </span>
                          <Badge
                            className={
                              attemptNo >= MAX_CONSECUTIVE_FAILURES
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            }
                          >
                            Attempt {attemptNo} of {MAX_CONSECUTIVE_FAILURES}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {fp.pickupAddress} → {fp.dropoffAddress}
                        </div>
                      </div>
                      {fp.failedAt && (
                        <div className="text-[10px] text-slate-400 shrink-0">
                          {new Date(fp.failedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                    {/* Error-specific message from stripe-error-codes.ts */}
                    {errorInfo.dealerMessage && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {errorInfo.dealerMessage}
                      </div>
                    )}
                    {/* Resolution action button */}
                    {errorInfo.resolutionAction === 'update_card' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg"
                        onClick={goToPaymentSettings}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        {getResolutionButtonText(errorInfo.resolutionAction)}
                      </Button>
                    )}
                    {errorInfo.resolutionAction === 'contact_bank' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg"
                        onClick={() => {
                          toast.info('Please contact your bank', {
                            description: 'Your bank declined the charge. Ask them why, or try a different card in Settings → Payment Methods.',
                          })
                        }}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        {getResolutionButtonText(errorInfo.resolutionAction)}
                      </Button>
                    )}
                    {errorInfo.resolutionAction === 'contact_support' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg"
                        onClick={() => {
                          window.location.href = '/help-customer'
                        }}
                      >
                        {getResolutionButtonText(errorInfo.resolutionAction)}
                      </Button>
                    )}
                    {errorInfo.resolutionAction === 'wait_retry' && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-500">
                        <Info className="h-3 w-3" />
                        No action needed — we&apos;re handling it.
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Status panel (always shown) ── */}
        <Card className="border-slate-200 dark:border-slate-800 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Weekly Postpaid
                </Badge>
                {statusBadges}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="h-7 text-xs"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  <span className="ml-1">Refresh</span>
                </Button>
                {collapsible && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCollapsed}
                    aria-expanded={true}
                    title="Collapse postpaid billing panel"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Next charge — THE money figure: the final amount Stripe
                  deducts (deliveries − referral credits). Replaces the old
                  separate "Outstanding" card: one number, no mental math.
                  The owed total still appears in the failure banners. */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Receipt className="h-3 w-3" />
                  Next Charge
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {estimatedNextCharge !== null ? `$${estimatedNextCharge}` : '—'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {status.unpaidDeliveryCount > 0
                    ? `${status.unpaidDeliveryCount} ${status.unpaidDeliveryCount === 1 ? 'delivery' : 'deliveries'}`
                    : 'No unpaid deliveries'}
                  {unpaidStatusPhrase ? ` · ${unpaidStatusPhrase}` : ''}
                  {status.outstandingCents > 0
                    ? ` · $${grossDeliveriesDollars} in deliveries`
                    : ''}
                  {creditsAppliedDollars !== null
                    ? ` · −$${creditsAppliedDollars} credits`
                    : pendingCreditsDollars
                      ? ` · −$${pendingCreditsDollars} credits`
                      : ''}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                  {estimatedNextCharge === null
                    ? 'Appears once your weekly billing is active.'
                    : isStripeOfficial
                      ? creditsCoverAll
                        ? 'Your referral credits fully cover these deliveries — nothing will be charged when the weekly invoice runs.'
                        : nextChargeCents === 0 && status.unpaidDeliveryCount > 0
                          ? 'Nothing will be charged this week — payment for these deliveries is still being processed. If a payment fails, the amount moves to a future weekly charge automatically.'
                          : 'The final amount your next weekly invoice will charge — deliveries and referral credits already included.'
                      : creditsCoverAll
                        ? 'Your referral credits fully cover your unpaid deliveries right now.'
                        : 'Estimated from your completed deliveries that have not been billed yet, minus referral credits.'}
                </div>
                {estimatedNextCharge !== null && (
                  <button
                    type="button"
                    onClick={() => setBreakdownOpen(true)}
                    className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    See how we get to ${estimatedNextCharge}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Next invoice date */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Calendar className="h-3 w-3" />
                  Next Invoice
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {nextInvoiceDate
                    ? nextInvoiceDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {nextInvoiceDate
                    ? nextInvoiceDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'No upcoming invoice'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                  When your card on file will be charged for the amount above.
                </div>
              </div>

              {/* Saved card status */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <CreditCard className="h-3 w-3" />
                  Payment Method
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {status.hasSavedPaymentMethod ? 'On file' : 'None'}
                </div>
                <div className="text-[10px] text-slate-400">
                  Charged weekly by Stripe
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                  The card Stripe charges automatically when your weekly invoice is created.
                </div>
              </div>
            </div>


            <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
              Completed deliveries appear as line items on your next weekly
              invoice — you&apos;ll receive it by email when it&apos;s ready.
              Tips are charged separately when you add one.
            </p>
          </CardContent>
        </Card>

        {/* ── Breakdown dialog: "how we get to this amount" ──
            Opens as a modal (not an inline collapse) so the dealer's eye
            stays on one focused, itemized explanation of the number. */}
        {estimatedNextCharge !== null && (
          <ChargeBreakdownDialog
            open={breakdownOpen}
            onOpenChange={setBreakdownOpen}
            title={`How we get to $${estimatedNextCharge}`}
            description="Line-by-line breakdown of your next charge"
            intro={breakdownIntro}
            badge={breakdownBadge}
            sections={breakdownSections}
            totalLabel={isStripeOfficial ? 'Total' : 'Estimated total'}
            totalCents={status.estimatedNextChargeCents ?? 0}
            footnote="Questions about any line? Contact support — we're happy to walk through it with you."
          />
        )}
      </div>
    </div>
  )
}
