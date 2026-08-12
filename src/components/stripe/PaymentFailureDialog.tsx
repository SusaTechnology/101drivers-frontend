/**
 * PaymentFailureDialog
 *
 * Shown when a delivery-creation attempt fails because the saved card was
 * declined, expired, or otherwise rejected by Stripe.
 *
 * Two-button UX (per dealer spec):
 *   1. Retry        — re-submits the create-from-quote call on the same page.
 *                     If it fails again, the dialog stays open with the new
 *                     reason. If it works, the dialog closes and we navigate.
 *   2. Update card  — navigates to /dealer-setting so the dealer can save a
 *                     new card. The form data stays in sessionStorage so the
 *                     dealer can resume the same delivery after updating.
 *
 * The dialog is non-dismissable except via the two buttons — no "X" close,
 * no Escape key, no backdrop click. The dealer MUST make a choice.
 *
 * Stays mounted across retry attempts — only closes on success or on
 * explicit "Update card" navigation.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, CreditCard, RefreshCw, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PaymentFailureDialogProps {
  /** Controlled open state */
  open: boolean
  /** The human-readable failure reason from the backend (already translated) */
  reason: string
  /** A short code identifying the failure type — used to decide whether to show the "Update card" button */
  code?: string
  /** Called when dealer clicks "Retry". The dialog stays open during the retry; parent should re-attempt create-from-quote. */
  onRetry: () => Promise<void> | void
  /** Called when dealer clicks "Update card". Default: navigate to /dealer-setting. */
  onUpdateCard?: () => void
  /** Path to navigate to when updating card. Default '/dealer-setting'. */
  updateCardPath?: string
}

export default function PaymentFailureDialog({
  open,
  reason,
  code,
  onRetry,
  onUpdateCard,
  updateCardPath = '/dealer-setting',
}: PaymentFailureDialogProps) {
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)

  // Reset retrying state if the dialog re-opens with a new reason
  useEffect(() => {
    if (open) setRetrying(false)
  }, [open, reason])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await onRetry()
      // If onRetry completes without throwing, the parent will close this
      // dialog by setting `open=false`. We don't close here because the
      // parent needs to navigate after a successful create.
    } catch {
      // Parent will update `reason` with the new error message — dialog
      // stays open. Just stop the spinner.
      setRetrying(false)
    }
  }

  const handleUpdateCard = () => {
    if (onUpdateCard) {
      onUpdateCard()
    } else {
      navigate({ to: updateCardPath })
    }
  }

  // Codes that indicate the saved card itself is the problem — show the
  // "Update card" button as the primary recommended action.
  const cardNeedsUpdating =
    !code ||
    [
      'STRIPE_API_ERROR',
      'NO_SAVED_CARD',
      'NO_STRIPE_CUSTOMER',
      'PI_STATUS_requires_payment_method',
      'PI_STATUS_requires_action',
    ].includes(code || '')

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        // Prevent closing via backdrop click or Escape key — dealer must
        // pick one of the two buttons.
        if (!isOpen) return
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(e: Event) => e.preventDefault()}
        onPointerDownOutside={(e: Event) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
            Payment could not be processed
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            We couldn't charge your saved card. Your delivery has not been
            placed.
          </DialogDescription>
        </DialogHeader>

        {/* Reason block */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-900/10 p-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-rose-500 mb-1">
            Reason
          </p>
          <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
            {reason}
          </p>
        </div>

        {/* Helper text */}
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {cardNeedsUpdating
            ? 'You can update your card and try again, or simply retry with your current card if you think this was a temporary issue.'
            : 'Please try again. If the problem persists, contact support.'}
        </p>

        {/* Action buttons — two buttons side-by-side */}
        <div className="flex flex-col gap-2 pt-2">
          {/* Retry is always available */}
          <Button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full py-3 rounded-2xl font-extrabold text-sm bg-slate-900 hover:bg-slate-800 text-white"
          >
            {retrying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Retry payment
              </>
            )}
          </Button>

          {/* Update card — only show if the saved card is the likely problem */}
          {cardNeedsUpdating && (
            <Button
              onClick={handleUpdateCard}
              disabled={retrying}
              variant="outline"
              className="w-full py-3 rounded-2xl font-extrabold text-sm border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <CreditCard className="w-4 h-4" />
              Update card info
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
