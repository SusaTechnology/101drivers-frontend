// components/shared/MobileOnlySignupCard.tsx
//
// Full-screen card replacing the driver signup form on desktop. The
// signup itself is mobile-only (server enforces it too — this card is
// the client half of the same rule), so a desktop visitor gets a QR
// code that a phone camera resolves to 101drivers.com/download, where
// the phone is sent to the right store for its OS.

import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, RefreshCw } from 'lucide-react'

import { Brand } from '@/lib/items/brand'

// The smart link: scanning it with a phone opens the /download page,
// which resolves to the correct store based on the PHONE's OS.
const DOWNLOAD_URL =
  import.meta.env.VITE_PUBLIC_APP_DOWNLOAD_URL || 'https://101drivers.com/download'

export function MobileOnlySignupCard() {
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
            Signup is mobile only
          </h1>
          <p className="text-sm text-muted-foreground">
            Driver signup happens on your phone — scan this QR code with
            your camera to continue on your mobile device.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-4">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG
              value={DOWNLOAD_URL}
              size={168}
              level="M"
              aria-label={`QR code linking to ${DOWNLOAD_URL}`}
            />
          </div>
          <p className="text-xs text-muted-foreground break-all">
            or open{' '}
            <span className="font-medium text-foreground">{DOWNLOAD_URL}</span>{' '}
            on your phone
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          Already on your phone? The signup form should have loaded — try
          refreshing.
        </p>
      </div>
    </div>
  )
}

export default MobileOnlySignupCard
