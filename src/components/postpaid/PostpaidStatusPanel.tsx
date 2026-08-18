// PostpaidStatusPanel — dealer-facing read-only summary of their weekly
// postpaid billing state. Pulled from GET /api/postpaid-billing/me/status.
//
// Shows:
//   • Frozen banner (if billingFrozen=true) with reason + CTA to manage
//     saved card (so the weekly invoice can retry successfully).
//   • Outstanding balance (sum of unpaid postpaid Payments)
//   • Next invoice date (from Stripe retrieveUpcoming, best-effort)
//   • Number of unpaid deliveries
//   • Whether a saved payment method is on file (with CTA to add one if not)
//
// No "set cap" / "unfreeze" / "retry charge" buttons — those are admin-only
// and live in the admin user-detail page.

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CreditCard,
  Calendar,
  DollarSign,
  Package,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDataQuery } from '@/lib/tanstack/dataQuery'

const API_URL = import.meta.env.VITE_API_URL

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
}

export default function PostpaidStatusPanel({ customerId }: { customerId: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: status, isLoading, refetch } = useDataQuery<PostpaidStatus>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/me/status`,
    noFilter: true,
    enabled: Boolean(customerId),
    refetchInterval: 60 * 1000, // refresh every minute — billing state changes asynchronously
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

  // If postpaidEnabled is false, this panel shouldn't be rendered at all —
  // caller (dealer-dashboard) gates it on customerProfile.postpaidEnabled.
  // If we get here with postpaidEnabled=false it means the dealer was
  // downgraded after the panel mounted; render nothing.
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

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="max-w-[980px] mx-auto space-y-2">
        {/* Frozen banner — only shown when billingFrozen=true */}
        {status.billingFrozen && (
          <Card className="border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-red-700 dark:text-red-300">Billing frozen</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {status.billingFrozenReason || 'Your weekly Stripe charge failed.'}{' '}
                  You cannot create new deliveries until this is resolved.
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {status.hasSavedPaymentMethod
                    ? 'A saved card is on file. Contact support to retry the charge, or wait for the daily auto-retry.'
                    : 'No saved card on file. Add a card under Payment Methods so the next weekly invoice can succeed.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status panel */}
        <Card className="border-slate-200 dark:border-slate-800 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Weekly Postpaid
                </Badge>
                {status.billingFrozen && (
                  <Badge variant="destructive">Frozen</Badge>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              </div>

              {/* Cap usage (read-only; cap set by admin) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Package className="h-3 w-3" />
                  Cap
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {status.capCents === null ? '∞' : `$${(status.capCents / 100).toFixed(0)}`}
                </div>
                <div className="text-[10px] text-slate-400">
                  {status.capCents === null ? 'No limit set' : `$${status.outstandingDollars.toFixed(2)} used`}
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
              </div>
            </div>

            <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
              Completed deliveries appear as line items on your next weekly Stripe invoice.
              You'll receive the invoice via email when it's finalized.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
