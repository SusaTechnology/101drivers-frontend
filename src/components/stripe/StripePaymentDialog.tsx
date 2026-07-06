/**
 * Reusable Stripe payment dialog.
 *
 * Wraps StripePaymentWrapper inside a shadcn Dialog with:
 * - Auto-open via `open` prop (controlled)
 * - "Skip for now" dismiss button
 * - Success screen after payment with manual dismiss (Done button)
 * - Configurable title, description, and amount
 * - onPaymentSuccess / onDismiss callbacks
 *
 * Usage:
 *   <StripePaymentDialog
 *     open={showModal}
 *     deliveryId="abc123"
 *     amount={99.50}
 *     onPaymentSuccess={(id) => console.log('paid!')}
 *     onDismiss={() => navigate({ to: '/dealer-dashboard' })}
 *   />
 */
import React, { useState, useEffect, useRef } from 'react'
import { CreditCard, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import StripePaymentWrapper from './StripePaymentWrapper'

interface StripePaymentDialogProps {
  /** Controlled open state */
  open: boolean
  /** Delivery ID to create the PaymentIntent for */
  deliveryId: string
  /** Dollar amount to display (optional — StripePaymentWrapper shows it) */
  amount?: number
  /** Called after successful payment (before auto-close) */
  onPaymentSuccess?: (paymentIntentId: string) => void
  /** Called when user dismisses / skips, or after success auto-close */
  onDismiss?: () => void
  /** Dialog title (optional override) */
  title?: string
  /** Dialog description (optional override) */
  description?: string
  /** Skip button label (optional override) */
  skipLabel?: string
}

export default function StripePaymentDialog({
  open,
  deliveryId,
  amount,
  onPaymentSuccess,
  onDismiss,
  title = 'Authorize Payment',
  description = 'Enter your card details to pay for this delivery. You can also skip and pay later from the delivery details page.',
  skipLabel = 'Skip for now',
}: StripePaymentDialogProps) {
  const [paymentSucceeded, setPaymentSucceeded] = useState(false)
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset success state when dialog opens fresh
  useEffect(() => {
    if (open) {
      setPaymentSucceeded(false)
    }
  }, [open])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    }
  }, [])

  const handlePaymentSuccess = (paymentIntentId: string) => {
    setPaymentSucceeded(true)
    onPaymentSuccess?.(paymentIntentId)
  }

  // If payment succeeded, show success screen instead of card form
  if (paymentSucceeded) {
    return (
      <Dialog open={open} onOpenChange={() => { /* prevent manual close during success */ }}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Card Authorized!
            </h3>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              Your card is verified and <span className="font-bold text-slate-900 dark:text-white">${amount ? amount.toFixed(2) : 'the amount'}</span> is reserved. The actual charge happens only after the driver completes the delivery.
            </p>
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 w-full">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                If the delivery is cancelled before completion, the hold is released immediately and you will not be charged.
              </p>
            </div>
            <Button
              onClick={() => onDismiss?.()}
              className="mt-6 w-full py-3 rounded-2xl font-extrabold text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onDismiss?.()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-lime-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        {deliveryId && (
          <StripePaymentWrapper
            deliveryId={deliveryId}
            amount={amount}
            onSuccess={handlePaymentSuccess}
            onError={() => {
              // Error is handled inside StripePaymentForm — keep dialog open for retry
            }}
          />
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onDismiss?.()}
            className="w-full text-slate-500 hover:text-slate-700"
          >
            {skipLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
