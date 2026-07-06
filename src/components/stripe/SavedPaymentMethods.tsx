import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CreditCard, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getStripe } from '@/lib/stripe'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery'

const API_URL = import.meta.env.VITE_API_URL

interface CardInfo {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

// ── Setup Form (collect card without charging) ──────────────────
function SetupCardForm({ customerId, onSuccess, onCancel }: { customerId: string; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)

    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
      })

      if (result.setupIntent?.status === 'succeeded' || result.setupIntent?.status === 'requires_action') {
        // Webhook will save the card to our DB
        toast.success('Card saved!', { description: 'Your card is now saved for faster checkout.' })
        onSuccess()
      } else {
        toast.error('Card not saved', { description: 'Please try again.' })
      }
    } catch (err: any) {
      toast.error('Failed to save card', { description: err.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl" disabled={loading}>Cancel</Button>
        <Button type="submit" className="flex-1 rounded-xl bg-lime-500 text-slate-950 hover:bg-lime-600" disabled={loading || !stripe}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Card'}
        </Button>
      </div>
    </form>
  )
}

// ── Main Component ──────────────────────────────────────────────
export default function SavedPaymentMethods({ customerId }: { customerId: string }) {
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null)

  // Fetch saved cards
  const { data: cardsData, isLoading: cardsLoading, refetch: refetchCards } = useDataQuery<{ cards: CardInfo[] }>({
    apiEndPoint: `${API_URL}/api/payments/stripe/saved-cards/${customerId}`,
    enabled: !!customerId,
    noFilter: true,
    select: (data) => data,
  })
  const cards = cardsData?.cards || []

  // Fetch customer to check postpaid status
  const { data: customerData } = useDataQuery<{ postpaidEnabled?: boolean }>({
    apiEndPoint: `${API_URL}/api/customers/${customerId}`,
    enabled: !!customerId,
    noFilter: true,
    select: (data) => data,
  })
  const postpaidEnabled = customerData?.postpaidEnabled || false

  // Save card mutation
  const saveCardMutation = useDataMutation<{ clientSecret: string; setupIntentId: string; stripeCustomerId: string }, { customerId: string }>({
    apiEndPoint: `${API_URL}/api/payments/stripe/save-card`,
    method: 'POST',
    onSuccess: (data) => {
      if (data.clientSecret) {
        setSetupClientSecret(data.clientSecret)
      }
    },
    onError: (error: any) => {
      toast.error('Failed to initialize card save', { description: error?.message || 'Unknown error' })
    },
  })

  // Remove card mutation
  const removeCardMutation = useDataMutation<void, { customerId: string; paymentMethodId: string }>({
    apiEndPoint: `${API_URL}/api/payments/stripe/remove-card`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Card removed')
      refetchCards()
    },
    onError: (error: any) => {
      toast.error('Failed to remove card', { description: error?.message })
    },
  })

  const handleSetupSuccess = () => {
    setSetupClientSecret(null)
    // Give webhook a moment to process, then refetch
    setTimeout(() => refetchCards(), 2000)
  }

  // Postpaid dealers don't need a saved card
  if (postpaidEnabled) {
    return (
      <div className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/10 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-blue-500" />
          <p className="font-bold text-blue-700 dark:text-blue-300">Postpaid billing</p>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Your account is billed after delivery. No card on file needed.
        </p>
      </div>
    )
  }

  if (cardsLoading) {
    return <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /><span>Loading...</span></div>
  }

  // If we're showing the setup form
  if (setupClientSecret) {
    const stripePromise = getStripe()
    return stripePromise ? (
      <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret, appearance: { theme: 'stripe' } }}>
        <SetupCardForm customerId={customerId} onSuccess={handleSetupSuccess} onCancel={() => setSetupClientSecret(null)} />
      </Elements>
    ) : null
  }

  return (
    <div className="space-y-3">
      {cards.length > 0 ? (
        cards.map(card => (
          <div key={card.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                card.isDefault ? "bg-lime-100 dark:bg-lime-900/20" : "bg-slate-100 dark:bg-slate-800"
              )}>
                <CreditCard className={cn("w-5 h-5", card.isDefault ? "text-lime-600" : "text-slate-400")} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold capitalize text-slate-900 dark:text-white">{card.brand}</span>
                  {card.isDefault && (
                    <span className="text-[9px] font-black uppercase bg-lime-100 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400 px-1.5 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  •••• {card.last4} &middot; {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => removeCardMutation.mutate({ customerId, paymentMethodId: card.id })}
              disabled={removeCardMutation.isPending}
            >
              {removeCardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center">
          <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No saved card</p>
          <p className="text-xs text-slate-400 mt-1">Save a card for faster checkout on future deliveries.</p>
        </div>
      )}

      <Button
        onClick={() => saveCardMutation.mutate({ customerId })}
        disabled={saveCardMutation.isPending}
        className="w-full rounded-xl bg-lime-500 text-slate-950 hover:bg-lime-600"
      >
        {saveCardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        <span className="ml-2 font-bold">{cards.length > 0 ? 'Replace card' : 'Add payment method'}</span>
      </Button>
    </div>
  )
}
