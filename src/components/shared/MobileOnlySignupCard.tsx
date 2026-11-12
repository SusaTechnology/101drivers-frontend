// components/shared/MobileOnlySignupCard.tsx
//
// Full-screen card replacing the driver signup form on DESKTOPS ONLY —
// phones and tablets always get the form (the server enforces the same
// rule; this card is the client half of it). A desktop visitor gets a
// QR code that a phone camera resolves to the EXACT onboarding URL the
// visitor was trying to use (window.location.href, query state included),
// so scanning lands directly in the driver onboarding flow on the phone.
// The /download page is still linked below for anyone who wants the app
// first — it is NOT removed.

import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, RefreshCw } from 'lucide-react'

import { Brand } from '@/lib/items/brand'

// Fallback when window is unavailable (SSR/pre-hydration) — the primary
// driver onboarding route.
const FALLBACK_ONBOARDING_URL = 'https://101drivers.com/driver-onboarding'

// The app-download link stays available as a secondary path (page kept).
const DOWNLOAD_URL =
  import.meta.env.VITE_PUBLIC_APP_DOWNLOAD_URL || 'https://101drivers.com/download'

export function MobileOnlySignupCard() {
  // The URL the desktop visitor is on right now — scanning resumes the same
  // onboarding page (with its search state) on the phone.
  const onboardingUrl =
    typeof window !== 'undefined' ? window.location.href : FALLBACK_ONBOARDING_URL

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card shadow-sm p-6 sm:p-8 text-center space-y-5">
        <div className="flex justify-center">
          <Brand />
        </div>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Continue on your phone
          </h1>
          <p className="text-sm text-muted-foreground">
            Driver onboarding happens on phones and tablets — scan this QR
            code with your phone or tablet camera to land straight on this
            onboarding page and continue there.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-4">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG
              value={onboardingUrl}
              size={168}
              level="M"
              aria-label={`QR code linking to ${onboardingUrl}`}
            />
          </div>
          <p className="text-xs text-muted-foreground break-all">
            or open{' '}
            <span className="font-medium text-foreground">{onboardingUrl}</span>{' '}
            on your phone
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Prefer the app first?{' '}
          <a
            href={DOWNLOAD_URL}
            className="font-medium text-primary underline underline-offset-2"
          >
            Get the mobile app
          </a>{' '}
          — the onboarding link works there too.
        </p>

        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          Already on a phone or tablet? The signup form should have loaded —
          try refreshing.
        </p>
      </div>
    </div>
  )
}

export default MobileOnlySignupCard
