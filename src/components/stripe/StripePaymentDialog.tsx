/**
 * Reusable Stripe payment dialog.
 *
 * Wraps StripePaymentWrapper inside a shadcn Dialog with:
 * - Auto-open via `open` prop (controlled)
 * - "Skip for now" dismiss button
 * - Configurable title, description, and amount
 * - onPaymentSuccess / onDismiss callbacks
 *
 * Usage:
 *   <StripePaymentDialog
 *     open={showModal}
 *     deliveryId="abc123"
 *     amount={99.50}
 *     onPaymentSuccess={(id) => navigate({ to: '/dealer-deliveries', search: { id } })}
 *     onDismiss={() => navigate({ to: '/dealer-dashboard' })}
 *   />
 */
import React from 'react'
import { CreditCard } from 'lucide-react'
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
  /** Called after successful payment */
  onPaymentSuccess?: (paymentIntentId: string) => void
  /** Called when user dismisses / skips */
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
            onSuccess={(paymentIntentId) => onPaymentSuccess?.(paymentIntentId)}
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
