/**
 * PriceDifferenceConfirmDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable confirmation dialog shown BEFORE a dealer commits a pricing edit
 * that has a price difference. The dialog explains in plain English:
 *
 *   - Price UP   → "It is going to charge you an additional price (new price −
 *                   old price = $X.XX)." + we'll re-authorize your card.
 *   - Price DOWN → "The difference (old price − new price = $X.XX) will be
 *                   released back to your card."
 *   - Unchanged  → "No charge or release — your card is unaffected."
 *
 * The headline + body come straight from the backend
 * (`POST /api/deliveryRequests/:id/edit-pricing/preview`), so the phrasing is
 * consistent across every caller (dealer-edit-delivery, dealer-drafts, future
 * mobile app) and stays in sync with the engine's `EPSILON` constant for
 * "did the price actually change?".
 *
 * Why this is a separate component from PricingEditErrorDialog:
 *   - This is a CONFIRMATION (before the call). Error dialog is for AFTER the
 *     call fails. Different lifecycle, different buttons, different tone.
 *   - This dialog shows a price breakdown card (old → new with arrow + delta).
 *     The error dialog shows the backend error message + retry options.
 *   - This dialog is dismissable (dealer can cancel). The error dialog is
 *     NOT dismissable (dealer must pick Retry / Update Card / Contact Support).
 *
 * Reusability contract:
 *   - Parent owns the `preview` state (the response from /edit-pricing/preview)
 *     and the `open` boolean.
 *   - Parent provides `onConfirm` (called when dealer clicks "Confirm & update")
 *     and `onCancel` (called when dealer clicks "Cancel" or closes the dialog).
 *   - Parent provides `confirming` (loading state) so the button can show a
 *     spinner while the actual /edit-pricing call is in flight.
 *   - The dialog gracefully handles `preview.editable === false` — it renders
 *     the not-editable message and disables the confirm button. The parent
 *     doesn't need to pre-check editability.
 *
 * Button order: Cancel (ghost, left) → Confirm & update (primary, right).
 * The dialog IS dismissable via Escape / backdrop click / X button — unlike
 * the error dialog, the dealer hasn't committed to anything yet, so it's safe
 * to bail out.
 */
import React from 'react'
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Equal,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  MapPin,
  RefreshCw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Shape of the response from POST /api/deliveryRequests/:id/edit-pricing/preview.
 * Mirrors `PreviewEditDeliveryPricingResult` on the backend
 * (deliveryPricingEdit.engine.ts). Duplicated here rather than imported
 * because the frontend doesn't share types with the backend.
 */
export interface PriceDifferencePreview {
  deliveryId: string
  status: string
  editable: boolean
  notEditableReason?: 'driver_accepted' | 'terminal_state' | 'unknown'
  isAdminOverride: boolean
  oldQuoteId: string | null
  newQuoteId: string
  oldPrice: number | null
  newPrice: number
  priceDelta: number
  priceDirection: 'increase' | 'decrease' | 'unchanged'
  expectedStripeAction:
    | 'none'
    | 'reauthorized'
    | 'skipped_postpaid'
    | 'skipped_no_payment'
  headline: string
  body: string
  willReactivate: boolean
  oldPickupAddress: string
  newPickupAddress: string
  oldDropoffAddress: string
  newDropoffAddress: string
  isPostpaid: boolean
  hasPayment: boolean
}

interface PriceDifferenceConfirmDialogProps {
  /** Controlled open state. */
  open: boolean
  /** The preview response from /edit-pricing/preview. When undefined, the
   *  dialog shows a loading state. */
  preview: PriceDifferencePreview | null
  /** True while the parent is fetching the preview. Shows a spinner. */
  loading?: boolean
  /** True while the parent is calling /edit-pricing (after Confirm). Shows
   *  a spinner on the confirm button and disables Cancel. */
  confirming?: boolean
  /** Called when dealer clicks "Confirm & update". Parent should call
   *  POST /edit-pricing, then close the dialog on success. */
  onConfirm: () => void
  /** Called when dealer clicks "Cancel" or closes the dialog. Parent should
   *  reset its `open` state. */
  onCancel: () => void
  /** Optional override for the confirm button label. Default: "Confirm & update". */
  confirmLabel?: string
}

/**
 * Helper: format a dollar amount, handling null (unknown old price).
 */
function formatUsd(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `$${Number(amount).toFixed(2)}`
}

export default function PriceDifferenceConfirmDialog({
  open,
  preview,
  loading = false,
  confirming = false,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm & update',
}: PriceDifferenceConfirmDialogProps) {
  // ── Resolve visual config based on direction (or not-editable) ────────────
  const isNotEditable = preview != null && !preview.editable
  const direction = preview?.priceDirection ?? 'unchanged'

  let Icon = Equal
  let accentText = 'text-slate-700 dark:text-slate-300'
  let accentBg = 'bg-slate-100 dark:bg-slate-800/60'
  let accentBorder = 'border-slate-200 dark:border-slate-700'
  let deltaText = 'text-slate-600 dark:text-slate-400'

  if (isNotEditable) {
    Icon = ShieldAlert
    accentText = 'text-rose-700 dark:text-rose-400'
    accentBg = 'bg-rose-50 dark:bg-rose-900/10'
    accentBorder = 'border-rose-200 dark:border-rose-800/40'
    deltaText = 'text-rose-600 dark:text-rose-400'
  } else if (direction === 'increase') {
    Icon = TrendingUp
    accentText = 'text-amber-700 dark:text-amber-400'
    accentBg = 'bg-amber-50 dark:bg-amber-900/10'
    accentBorder = 'border-amber-200 dark:border-amber-800/40'
    deltaText = 'text-amber-700 dark:text-amber-400'
  } else if (direction === 'decrease') {
    Icon = TrendingDown
    accentText = 'text-emerald-700 dark:text-emerald-400'
    accentBg = 'bg-emerald-50 dark:bg-emerald-900/10'
    accentBorder = 'border-emerald-200 dark:border-emerald-800/40'
    deltaText = 'text-emerald-700 dark:text-emerald-400'
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen && !confirming) {
          onCancel()
        }
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!confirming}
        onEscapeKeyDown={(e: Event) => {
          if (confirming) e.preventDefault()
        }}
        onPointerDownOutside={(e: Event) => {
          if (confirming) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${accentText}`}>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
            {loading
              ? 'Calculating price difference…'
              : preview?.headline ?? 'Price difference'}
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400 sr-only">
            Confirm the pricing edit before we update your delivery and your card.
          </DialogDescription>
        </DialogHeader>

        {/* ── Loading state ──────────────────────────────────────────────── */}
        {loading && (
          <div className="py-6 flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Recalculating the quote with the new addresses…</p>
          </div>
        )}

        {/* ── Body: price breakdown + message + address diff ─────────────── */}
        {!loading && preview && (
          <div className="flex flex-col gap-4">
            {/* Price breakdown card */}
            <div className={`rounded-2xl border p-4 ${accentBorder} ${accentBg}`}>
              <div className="flex items-center justify-between gap-3">
                {/* Old price */}
                <div className="flex-1 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                    Old price
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {formatUsd(preview.oldPrice)}
                  </p>
                </div>

                {/* Arrow + delta */}
                <div className="flex flex-col items-center px-2">
                  <ArrowRight className={`h-5 w-5 ${deltaText}`} />
                  {preview.priceDirection !== 'unchanged' && (
                    <span className={`text-[11px] font-extrabold mt-1 ${deltaText}`}>
                      {preview.priceDirection === 'increase' ? '+' : '−'}
                      {formatUsd(Math.abs(preview.priceDelta))}
                    </span>
                  )}
                </div>

                {/* New price */}
                <div className="flex-1 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                    New price
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {formatUsd(preview.newPrice)}
                  </p>
                </div>
              </div>

              {/* Delta line — the explicit "(new price − old price = $X.XX)" or
                  "(old price − new price = $X.XX)" the dealer spec asked for. */}
              {preview.priceDirection !== 'unchanged' && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-center">
                  <p className={`text-xs font-bold ${deltaText}`}>
                    {preview.priceDirection === 'increase'
                      ? `Additional charge: new price − old price = ${formatUsd(Math.abs(preview.priceDelta))}`
                      : `Release: old price − new price = ${formatUsd(Math.abs(preview.priceDelta))}`}
                  </p>
                </div>
              )}
            </div>

            {/* User-facing body message (from backend) */}
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {preview.body}
            </p>

            {/* Stripe action badge */}
            {preview.editable && (
              <div className="flex flex-wrap gap-2">
                {preview.expectedStripeAction === 'reauthorized' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[11px] font-bold px-2.5 py-1">
                    <RefreshCw className="h-3 w-3" />
                    Card will be re-authorized
                  </span>
                )}
                {preview.expectedStripeAction === 'skipped_postpaid' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 text-[11px] font-bold px-2.5 py-1">
                    Postpaid — no card charge
                  </span>
                )}
                {preview.expectedStripeAction === 'skipped_no_payment' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold px-2.5 py-1">
                    No payment row yet
                  </span>
                )}
                {preview.willReactivate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 text-[11px] font-bold px-2.5 py-1">
                    <RefreshCw className="h-3 w-3" />
                    Will reactivate from EXPIRED
                  </span>
                )}
                {preview.isAdminOverride && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 text-[11px] font-bold px-2.5 py-1">
                    <ShieldAlert className="h-3 w-3" />
                    Admin override
                  </span>
                )}
              </div>
            )}

            {/* Address diff (only if changed) */}
            {(preview.oldPickupAddress !== preview.newPickupAddress ||
              preview.oldDropoffAddress !== preview.newDropoffAddress) && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Address changes
                </p>
                <div className="space-y-1.5 text-xs">
                  {preview.oldPickupAddress !== preview.newPickupAddress && (
                    <div>
                      <span className="font-bold text-slate-600 dark:text-slate-400">Pickup: </span>
                      <span className="text-slate-500 dark:text-slate-500 line-through">
                        {preview.oldPickupAddress}
                      </span>
                      <ArrowRight className="inline h-3 w-3 mx-1 text-slate-400" />
                      <span className="text-slate-900 dark:text-white font-medium">
                        {preview.newPickupAddress}
                      </span>
                    </div>
                  )}
                  {preview.oldDropoffAddress !== preview.newDropoffAddress && (
                    <div>
                      <span className="font-bold text-slate-600 dark:text-slate-400">Dropoff: </span>
                      <span className="text-slate-500 dark:text-slate-500 line-through">
                        {preview.oldDropoffAddress}
                      </span>
                      <ArrowRight className="inline h-3 w-3 mx-1 text-slate-400" />
                      <span className="text-slate-900 dark:text-white font-medium">
                        {preview.newDropoffAddress}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Not-editable warning */}
            {isNotEditable && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-900/10 p-3">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                  {preview.notEditableReason === 'driver_accepted'
                    ? 'A driver has already accepted this delivery. Pricing and addresses can no longer be changed — cancel the delivery and create a new one, or contact support.'
                    : preview.notEditableReason === 'terminal_state'
                      ? 'This delivery has reached a final state (completed, closed, cancelled, or disputed). Only an admin can edit it now — please contact an admin.'
                      : 'This delivery is in a state where pricing edits are not allowed.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer: Cancel + Confirm ───────────────────────────────────── */}
        {!loading && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={confirming}
              className="flex-1 sm:flex-none py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!preview?.editable || confirming}
              className="flex-1 sm:flex-none py-3 rounded-2xl font-extrabold text-sm bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating…
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
