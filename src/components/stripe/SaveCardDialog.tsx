/**
 * SaveCardDialog — first-delivery card capture.
 *
 * Opened on the review-delivery page when a prepaid customer clicks
 * "Request Delivery" without a saved card. Instead of the old dead-end
 * backend error ("No saved payment method on file. Please save a card
 * under Payment Methods first, then retry the delivery."), the customer
 * enters their card right here as the natural next step.
 *
 * Uses the exact same backend endpoint and SetupIntent flow as
 * Settings → Payment method (POST /api/payments/stripe/save-card), so the
 * moment `confirmSetup` succeeds the card is attached to the customer's
 * Stripe account. Every future delivery, tip, and postpaid invoice is then
 * charged silently in the background — the customer never types card
 * details again unless they replace the card in Settings.
 *
 * The parent flow continues automatically after onSuccess() — the delivery
 * submission that triggered this dialog is resumed without extra clicks.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getStripe } from '@/lib/stripe'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { authFetch } from '@/lib/tanstack/dataQuery'

const API_URL = import.meta.env.VITE_API_URL

// Strip Stripe's internal "Request req_xxx:" prefixes / ids from error
// messages so the customer sees a human-readable reason (same approach as
// SavedPaymentMethods.tsx).
function stripStripePrefix(s: string | undefined | null): string {
  if (!s) return 'Unknown error'
  let cleaned = String(s)
    .replace(/^Request req_[A-Za-z0-9]+:\s*/i, '')
    .trim()
  const looksUnsafe = /(pm_|in_|sub_|cust|req_|ch_|pi_)[A-Za-z0-9]+/i.test(cleaned)
  if (!cleaned || looksUnsafe) {
    return 'We could not save your card at this time. Please try again or contact support.'
  }
  return cleaned
}

// ── Inner form (needs to live inside <Elements>) ─────────────────
function SaveCardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSaving(true)

    try {
      // redirect: 'if_required' keeps everything inline — the resolved
      // promise tells us the outcome and any 3DS challenge renders inside
      // the dialog (an 'always' redirect would reload the page and break
      // the automatic "continue submission" handoff).
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      })

      // Discriminated union — destructure so TS narrows error vs setupIntent.
      const { error: setupError, setupIntent } = result as
        | { error: import('@stripe/stripe-js').StripeError; setupIntent?: undefined }
        | { error?: undefined; setupIntent: { status: string } }

      if (setupError) {
        toast.error('Card not saved', {
          description: stripStripePrefix(setupError.message) || 'Please try again with a different card.',
        })
      } else if (
        setupIntent?.status === 'succeeded' ||
        setupIntent?.status === 'requires_action'
      ) {
        // The card is now attached to the customer's Stripe account.
        // Parent continues the paused delivery submission.
        onSaved()
      } else {
        toast.error('Card not saved', { description: 'Please try again with a different card.' })
      }
    } catch (err: any) {
      toast.error('Failed to save card', { description: stripStripePrefix(err?.message) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        Secured by Stripe. Your full card number never touches our servers.
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 rounded-xl"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 rounded-xl bg-lime-500 text-slate-950 hover:bg-lime-600"
          disabled={saving || !stripe}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Card & Continue'
          )}
        </Button>
      </div>
    </form>
  )
}

// ── Dialog ───────────────────────────────────────────────────────
interface SaveCardDialogProps {
  open: boolean
  /** DB Customer id (the logged-in user's profileId) */
  customerId: string
  /** Card was saved — parent resumes the delivery submission */
  onSuccess: () => void
  /** User dismissed the dialog — parent stays on the review page */
  onCancel: () => void
}

export default function SaveCardDialog({ open, customerId, onSuccess, onCancel }: SaveCardDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)

  // POST /save-card → { setupIntentId, clientSecret, stripeCustomerId }.
  // NOTE: authFetch resolves with the PARSED BODY (not a Response) and
  // THROWS a friendly Error (message extracted from the API body) on any
  // non-OK status — so the catch branch is the error path.
  // Returns the clientSecret, or null on failure (initError is set).
  const fetchClientSecret = async (): Promise<string | null> => {
    try {
      const data = await authFetch<any>(`${API_URL}/api/payments/stripe/save-card`, {
        method: 'POST',
        body: JSON.stringify({ customerId }),
      })
      if (!data?.clientSecret) {
        setInitError(stripStripePrefix(data?.message || data?.details || 'Failed to initialize the card form.'))
        return null
      }
      setInitError(null)
      return data.clientSecret as string
    } catch (err: any) {
      setInitError(stripStripePrefix(err?.message))
      return null
    }
  }

  // Fetch a SetupIntent client secret each time the dialog opens.
  // Fresh per-open: SetupIntents are single-use, and a re-open after a
  // cancel must not reuse a stale one.
  useEffect(() => {
    if (!open || !customerId) return
    let cancelled = false
    setClientSecret(null)
    setInitError(null)
    setInitializing(true)

    fetchClientSecret().then((secret) => {
      if (cancelled) return
      if (secret) setClientSecret(secret)
      setInitializing(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId])

  const stripePromise = open ? getStripe() : null

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !initializing) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-lime-500" />
            Add your card to continue
          </DialogTitle>
          <DialogDescription>
            This is the only time you&apos;ll need to do this.
          </DialogDescription>
        </DialogHeader>

        {/* Education copy — set expectations: one-time entry, everything
            after this runs automatically. */}
        <div className="rounded-xl border border-lime-200 dark:border-lime-800/40 bg-lime-50 dark:bg-lime-900/10 p-3">
          <p className="text-xs font-bold text-lime-800 dark:text-lime-300">
            Your card will be saved to your account.
          </p>
          <p className="text-[11px] text-lime-700/90 dark:text-lime-400/90 mt-0.5">
            From your next delivery on, everything runs automatically — no card
            entry again. You can change or remove your card anytime in{' '}
            <span className="font-bold">Settings → Payment method</span>.
          </p>
        </div>

        {initializing && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {!initializing && initError && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">{initError}</p>
            <button
              onClick={async () => {
                setInitializing(true)
                const secret = await fetchClientSecret()
                if (secret) setClientSecret(secret)
                setInitializing(false)
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}

        {!initializing && !initError && clientSecret && stripePromise && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <SaveCardForm onSaved={onSuccess} onCancel={onCancel} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  )
}
