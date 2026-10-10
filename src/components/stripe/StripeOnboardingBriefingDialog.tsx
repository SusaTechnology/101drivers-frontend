import {
  ClipboardCheck,
  ShieldCheck,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * StripeOnboardingBriefingDialog
 *
 * Presentation-only briefing shown BEFORE the driver is redirected to
 * Stripe's hosted onboarding. It exists because Stripe's hosted form lets
 * the account holder type ANY name (real case: a driver entered
 * "Just A Driver"), which later triggers identity-verification holds and
 * tax-form mismatches. The dialog tells drivers exactly what to enter so
 * the problem is prevented at the source. It also explains that the
 * platform pre-fills most fields (name, address, business details), so
 * drivers leave fields that don't apply to them (like the website)
 * untouched instead of guessing.
 *
 * Decoupled by design:
 *  - Fully controlled via props (open / onOpenChange) — no internal state.
 *  - Knows nothing about the wallet page, the API, or Stripe's SDK.
 *    The host decides what "confirm" does (usually: fire the onboarding
 *    mutation and redirect).
 *  - Reusable from any surface that starts Connect onboarding
 *    (driver wallet, driver onboarding, future flows).
 */

interface BriefingItem {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const BRIEFING_ITEMS: BriefingItem[] = [
  {
    icon: ClipboardCheck,
    title: 'We pre-fill your details',
    description:
      "Your name, address, and business details (like the website) are filled in for you. If the name shown is already your legal name, don't edit it — and leave any fields that don't apply to you just as they are.",
  },
  {
    icon: ShieldCheck,
    title: 'If you edit the name, use your legal name',
    description:
      "If you do need to change it, it must be your full legal name exactly as it appears on your government ID and bank account — not a nickname or a role like “Just A Driver”.",
  },
  {
    icon: Banknote,
    title: 'Link your own bank account',
    description:
      'You\'ll either log in to your online banking or confirm two small test deposits. The account must be yours — payouts always go to the bank account you verify.',
  },
  {
    icon: Smartphone,
    title: 'Keep your phone nearby',
    description:
      'Stripe may text you a one-time code to verify your identity. It only takes a few minutes.',
  },
  {
    icon: CheckCircle2,
    title: 'You\'ll come right back',
    description:
      'When you finish, you\'ll return to this page and your payouts switch on automatically.',
  },
]

interface StripeOnboardingBriefingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the driver taps "Continue to Stripe" — fire your onboarding flow here. */
  onConfirm: () => void
  /** While true, the confirm button shows a spinner and the dialog can't be dismissed. */
  confirmPending?: boolean
}

export function StripeOnboardingBriefingDialog({
  open,
  onOpenChange,
  onConfirm,
  confirmPending = false,
}: StripeOnboardingBriefingDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!confirmPending) onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md rounded-3xl border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">
            Before you continue to Stripe
          </DialogTitle>
          <DialogDescription className="text-sm">
            Here&apos;s exactly what to expect — it takes about 5 minutes.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {BRIEFING_ITEMS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lime-100 dark:bg-lime-900/20">
                <Icon className="h-4 w-4 text-lime-600 dark:text-lime-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <span className="font-bold">Why the legal name matters:</span> Stripe
              compares it against your ID during identity checks, and your year-end
              tax form uses this exact name. A mismatch can pause your payouts.
              Stripe never charges drivers — 101 Drivers covers all Stripe fees.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => onOpenChange(false)}
            disabled={confirmPending}
          >
            Go back
          </Button>
          <Button
            className="lime-btn rounded-2xl font-bold"
            onClick={onConfirm}
            disabled={confirmPending}
          >
            {confirmPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : null}
            {confirmPending ? 'Connecting...' : 'Continue to Stripe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
