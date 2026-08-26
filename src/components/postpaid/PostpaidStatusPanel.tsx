// PostpaidStatusPanel — dealer-facing summary of their weekly postpaid
// billing state. Pulled from GET /api/postpaid-billing/me/status.
//
// Graduated alert system (like Uber/DoorDash):
//   • 1st failure:  amber banner — "Update your card before [retry date]"
//   • 2nd failure:  red banner — "Payment failed again. Please update your card."
//   • 3rd+ failure: red banner + "Account restricted — you can't create new deliveries"
//   • Transient:    no banner (auto-resolves)
//   • Fraud:        admin-only (dealer doesn't see)
//
// The dealer ALWAYS sees:
//   • Outstanding balance
//   • Next invoice date
//   • Saved card status
//   • Failed payment details (if any) — amount, reason, retry info
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
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import {
  getStripeErrorInfo,
  getResolutionButtonText,
  shouldShowDealer,
} from '@/lib/stripe-error-codes'

const API_URL = import.meta.env.VITE_API_URL

interface FailedPayment {
  paymentId: string
  amount: number
  failureCode: string | null
  failureMessage: string | null
  failedAt: string | null
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

export default function PostpaidStatusPanel({ customerId }: { customerId: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="max-w-[980px] mx-auto space-y-2">
        {/* ── Graduated alert system ── */}

        {/* RED alert: account restricted (frozen) */}
        {isFrozen && (
          <Card className="border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-red-700 dark:text-red-300">
                  Account restricted — new deliveries are paused
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Multiple payment charges have failed. To resume creating deliveries, please update your payment method below.
                </p>
                {status.hasSavedPaymentMethod ? (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    A card is on file but charges are being declined. Update your card or contact your bank.
                  </p>
                ) : (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    No card on file. Add a card so the next weekly invoice can succeed.
                  </p>
                )}
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
                  Payment action needed
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Your last invoice charge failed. Stripe will automatically retry — update your payment method before the retry date to ensure it succeeds.
                </p>
                {nextInvoiceDate && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Next retry: <strong>{nextInvoiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  </p>
                )}
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
                return (
                  <div
                    key={fp.paymentId}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          ${fp.amount.toFixed(2)}
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
                        onClick={() => {
                          // The dealer updates their card via the Stripe Connect
                          // portal — same flow as driver wallet. For now, direct
                          // them to contact support / payment settings.
                          toast.info('Update your payment method in Settings → Payment Methods', {
                            description: 'Or contact support for assistance.',
                          })
                        }}
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
                {isFrozen && (
                  <Badge variant="destructive">Restricted</Badge>
                )}
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
              </div>
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
