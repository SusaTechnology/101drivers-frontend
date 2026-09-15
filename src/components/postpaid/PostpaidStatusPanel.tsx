// PostpaidStatusPanel — dealer-facing summary of their weekly postpaid
// billing state. Pulled from GET /api/postpaid-billing/me/status.
//
// Graduated alert system (like Uber/DoorDash), driven by Stripe's
// invoice attempt_count (1 = initial charge, 2 = first retry, ...):
//   • 1st failure:  amber banner — "1st payment attempt failed — we'll
//                   retry automatically on [retry date]"
//   • 2nd failure:  amber banner — "2nd consecutive failure — update
//                   your card now; a 3rd pauses new deliveries"
//   • 3rd+ failure: red banner — account restricted (billingFrozen).
//                   "3 consecutive failures — new deliveries are
//                   paused. Update your card or contact support."
//   • Transient:    no banner (auto-resolves)
//   • Fraud:        admin-only (dealer doesn't see)
//
// The dealer ALWAYS sees:
//   • Outstanding balance
//   • Next invoice date
//   • Saved card status
//   • Failed payment details (if any) — amount, reason, attempt #, retry info
//
// The dealer NEVER sees:
//   • Raw Stripe error codes (translated to plain English)
//   • Fraud/security flags (admin-only)
//   • Other dealers' data

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Calendar,
  DollarSign,
  Loader2,
  RefreshCw,
  Info,
  ExternalLink,
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

const API_URL = import.meta.env.VITE_API_URL

// Mirror of MAX_FAILURES_BEFORE_RESTRICT in the backend
// postpaidBilling.service.ts — the dealer-facing copy uses the same
// threshold the backend enforces (restrict on the 3rd failure).
const MAX_CONSECUTIVE_FAILURES = 3

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
  hasSavedPaymentMethod: boolean
  nextInvoiceDate: string | null
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
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Action needed
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
                <p className="font-bold text-amber-700 dark:text-amber-300">
                  {maxAttempt >= 2
                    ? `Payment failed for the ${maxAttempt === 2 ? '2nd' : maxAttempt === 3 ? '3rd' : `${maxAttempt}th`} consecutive time`
                    : '1st payment attempt failed'}
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
              {/* Outstanding balance */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <DollarSign className="h-3 w-3" />
                  Outstanding
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  ${status.outstandingDollars.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {status.unpaidDeliveryCount} unpaid {status.unpaidDeliveryCount === 1 ? 'delivery' : 'deliveries'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                  Total amount owed for completed deliveries not yet charged to your card.
                </div>
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
                  When Stripe will next charge your saved card for the outstanding balance.
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
              Completed deliveries appear as line items on your next weekly Stripe invoice.
              You&apos;ll receive the invoice via email when it&apos;s finalized.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
