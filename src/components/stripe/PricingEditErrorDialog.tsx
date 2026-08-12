/**
 * PricingEditErrorDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable dialog for displaying errors returned by the pricing-edit engine
 * (`POST /api/deliveryRequests/:id/edit-pricing`).
 *
 * Why this exists separately from PaymentFailureDialog:
 *   - Pricing edits can fail for MORE reasons than just card issues — the
 *     delivery may be in a non-editable status, Stripe may be misconfigured
 *     on the server, or (worst case) compensation may have failed and the
 *     customer has a phantom auth hold that needs manual release.
 *   - The dialog needs THREE buttons (Retry / Update Card / Contact Support)
 *     instead of just two, and the "Contact Support" button is ALWAYS visible
 *     per the dealer spec — even for card-decline cases the user might want
 *     to reach support.
 *   - The error code → user-message mapping is pricing-edit-specific.
 *
 * Button visibility by error code:
 *   ┌─────────────────────────────┬────────┬──────────────┬──────────────────┐
 *   │ Code                        │ Retry  │ Update Card  │ Contact Support  │
 *   ├─────────────────────────────┼────────┼──────────────┼──────────────────┤
 *   │ NO_SAVED_CARD               │   ✓    │     ✓        │       ✓          │
 *   │ CARD_DECLINED               │   ✓    │     ✓        │       ✓          │
 *   │ CARD_REQUIRES_ACTION        │   ✓    │     ✓        │       ✓          │
 *   │ STRIPE_API_ERROR            │   ✓    │     ✓        │       ✓          │
 *   │ INVALID_STATUS              │   ✗    │     ✗        │       ✓          │
 *   │ NEW_PI_FAILED_UNKNOWN       │   ✓    │     ✗        │       ✓          │
 *   │ STRIPE_NOT_CONFIGURED       │   ✗    │     ✗        │       ✓          │
 *   │ COMPENSATION_FAILED         │   ✗    │     ✗        │       ✓          │
 *   └─────────────────────────────┴────────┴──────────────┴──────────────────┘
 *
 * "Contact Support" is ALWAYS visible — even for card-decline cases, the
 * dealer may want to reach support (e.g. if they don't have another card).
 *
 * The dialog is non-dismissable except via the buttons — no X close, no
 * Escape key, no backdrop click. The dealer MUST make a choice. This
 * mirrors the pattern from PaymentFailureDialog.tsx.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  CreditCard,
  LifeBuoy,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Mirrors the PricingEditErrorCode type on the backend
 * (deliveryPricingEdit.engine.ts). Duplicated here rather than imported
 * because the frontend doesn't share types with the backend.
 */
export type PricingEditErrorCode =
  | 'NO_SAVED_CARD'
  | 'CARD_DECLINED'
  | 'CARD_REQUIRES_ACTION'
  | 'STRIPE_API_ERROR'
  | 'STRIPE_NOT_CONFIGURED'
  | 'NEW_PI_FAILED_UNKNOWN'
  | 'COMPENSATION_FAILED'
  | 'INVALID_STATUS'

interface PricingEditErrorDialogProps {
  /** Controlled open state. */
  open: boolean
  /** The structured error code from the backend (PricingEditException.errorCode). */
  code?: PricingEditErrorCode | string
  /** The human-readable message from the backend (already user-friendly). */
  message: string
  /** Delivery id — passed to the support page as context so the support
   *  team can look it up without asking the dealer. */
  deliveryId?: string
  /** Called when dealer clicks "Retry". Dialog stays open during the retry;
   *  parent should re-attempt the edit-pricing call. If it succeeds, the
   *  parent closes the dialog by setting `open=false`. If it fails again,
   *  the parent updates `code` and `message` with the new error. */
  onRetry: () => Promise<void> | void
  /** Called when dealer clicks "Update card". Default: navigate to
   *  /dealer-settings. Override if you need custom behavior. */
  onUpdateCard?: () => void
  /** Path to navigate to when updating card. Default '/dealer-settings'. */
  updateCardPath?: string
  /** Called when dealer clicks "Contact Support". Default: navigate to
   *  /dealer-support-request with prefilled context. */
  onContactSupport?: () => void
  /** Path to navigate to when contacting support. Default '/dealer-support-request'. */
  contactSupportPath?: string
}

/**
 * Per-code configuration: title, description, and which buttons to show.
 *
 * `showRetry` — false for errors where retrying won't help (e.g. status is
 *   invalid, or compensation failed and the dealer must wait for support).
 * `showUpdateCard` — true only when the saved card is plausibly the problem.
 */
const ERROR_CODE_CONFIG: Record<
  string,
  {
    title: string
    description: string
    showRetry: boolean
    showUpdateCard: boolean
    /** Visual severity — drives the icon + accent color. */
    severity: 'warning' | 'danger'
  }
> = {
  NO_SAVED_CARD: {
    title: 'No saved card on file',
    description:
      "We couldn't find a saved payment method on your account. Save a card under Payment Methods, then retry the edit. Your delivery is unchanged.",
    showRetry: true,
    showUpdateCard: true,
    severity: 'warning',
  },
  CARD_DECLINED: {
    title: 'Your card was declined',
    description:
      "Your saved card was declined for the new amount. The original authorization is still active and your delivery is unchanged. Save a different card and retry the edit.",
    showRetry: true,
    showUpdateCard: true,
    severity: 'warning',
  },
  CARD_REQUIRES_ACTION: {
    title: 'Bank approval needed (3D Secure)',
    description:
      "Your bank needs you to approve this charge. The new price was not authorized, but your original authorization is still active and the delivery is unchanged. Approve the charge with your bank, then retry the edit.",
    showRetry: true,
    showUpdateCard: true,
    severity: 'warning',
  },
  STRIPE_API_ERROR: {
    title: "We couldn't reach your bank",
    description:
      "Stripe returned an error while trying to authorize the new price. Your original authorization is still active and the delivery is unchanged. Please try again in a moment, or update your card if the issue persists.",
    showRetry: true,
    showUpdateCard: true,
    severity: 'warning',
  },
  INVALID_STATUS: {
    title: "This delivery can't be edited",
    description:
      "This delivery has reached a state where pricing edits are no longer allowed (for example, a driver has already accepted it, or it's been cancelled or closed). Contact support if you need to make changes.",
    showRetry: false,
    showUpdateCard: false,
    severity: 'warning',
  },
  NEW_PI_FAILED_UNKNOWN: {
    title: "We couldn't authorize the new price",
    description:
      "Stripe returned an unexpected status when we tried to authorize the new amount. Your original authorization is still active and the delivery is unchanged. Please contact support if the issue persists.",
    showRetry: true,
    showUpdateCard: false,
    severity: 'warning',
  },
  STRIPE_NOT_CONFIGURED: {
    title: 'Payment processing is unavailable',
    description:
      "Payment processing is not configured on the server. Please contact support before retrying — they can let you know when the issue is resolved.",
    showRetry: false,
    showUpdateCard: false,
    severity: 'danger',
  },
  COMPENSATION_FAILED: {
    title: 'Action needed — contact support',
    description:
      "We couldn't complete the pricing edit, and we couldn't automatically release the temporary authorization hold on your card. Please contact support immediately — they will cancel the pending charge and help you complete the edit. Your delivery is unchanged.",
    showRetry: false,
    showUpdateCard: false,
    severity: 'danger',
  },
}

const DEFAULT_CONFIG = {
  title: 'Something went wrong',
  description: 'An unexpected error occurred. Please try again or contact support.',
  showRetry: true,
  showUpdateCard: false,
  severity: 'warning' as const,
}

export default function PricingEditErrorDialog({
  open,
  code,
  message,
  deliveryId,
  onRetry,
  onUpdateCard,
  updateCardPath = '/dealer-settings',
  onContactSupport,
  contactSupportPath = '/dealer-support-request',
}: PricingEditErrorDialogProps) {
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)

  // Reset retrying state if the dialog re-opens with a new error
  useEffect(() => {
    if (open) setRetrying(false)
  }, [open, code, message])

  const config = (code && ERROR_CODE_CONFIG[code]) || DEFAULT_CONFIG

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await onRetry()
      // Parent will close the dialog by setting open=false on success.
    } catch {
      // Parent will update `message` and `code` with the new error.
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

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport()
    } else {
      // Pass the delivery id + error code as search params so the support
      // request form can prefill them — saves the dealer a step and gives
      // the support team the exact context they need.
      navigate({
        to: contactSupportPath,
        search: {
          deliveryId: deliveryId,
          errorCode: code,
          message,
        } as any,
      })
    }
  }

  const isDanger = config.severity === 'danger'
  const accentClasses = isDanger
    ? 'text-rose-700 dark:text-rose-400'
    : 'text-amber-700 dark:text-amber-400'
  const borderClasses = isDanger
    ? 'border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-900/10'
    : 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10'
  const labelClasses = isDanger
    ? 'text-rose-500'
    : 'text-amber-600 dark:text-amber-500'

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        // Prevent closing via backdrop click or Escape key — dealer must
        // pick one of the buttons.
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
          <DialogTitle className={`flex items-center gap-2 ${accentClasses}`}>
            {isDanger ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {/* Backend message block — shows the exact (user-friendly) message
            returned by the engine, so the dealer has full context. */}
        {message && (
          <div className={`rounded-2xl border p-4 ${borderClasses}`}>
            <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${labelClasses}`}>
              Details
            </p>
            <p className="text-sm text-slate-900 dark:text-white leading-relaxed">
              {message}
            </p>
            {code && (
              <p className={`text-[10px] mt-2 font-mono ${labelClasses}`}>
                Error code: {code}
              </p>
            )}
          </div>
        )}

        {/* Action buttons — vertically stacked, full-width.
            Order: Retry (primary) → Update card (outline) → Contact support (ghost).
            "Contact support" is ALWAYS visible per the dealer spec. */}
        <div className="flex flex-col gap-2 pt-2">
          {config.showRetry && (
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
                  Retry edit
                </>
              )}
            </Button>
          )}

          {config.showUpdateCard && (
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

          {/* Always-visible Contact Support button. */}
          <Button
            onClick={handleContactSupport}
            disabled={retrying}
            variant="ghost"
            className="w-full py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LifeBuoy className="w-4 h-4" />
            Contact support
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
