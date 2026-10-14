// Renders a support message body, lifting embedded CDN image URLs out of
// the text into a tappable thumbnail grid.
//
// Why: SupportRequest has no attachments column — uploads are embedded in
// the message text as an [Attachments] block of "Photo N: URL" lines (and
// users may paste bare image links too). Rendering those as raw text was
// the difference between "Ops sees a wall of URLs" and "Ops sees the
// photo". This component shows the prose as prose and the photos as a
// thumbnail grid (tap to open the shared full-size preview dialog).
import React from 'react'
import { cn } from '@/lib/utils'

const IMAGE_EXT = /\.(jpe?g|png|webp)(\?.*)?$/i
// `Photo 1: https://...` lines produced by the attachment upload block
const PHOTO_LINE = /^Photo\s*\d+:\s*(\S+)\s*$/i

function isImageUrl(url: string): boolean {
  if (IMAGE_EXT.test(url)) return true
  // CDN-scoped evidence/support images may lack a recognizable extension
  return /\/(delivery-evidence|support|driver-profile|driver-selfie)\//.test(url)
}

/** Split a message into prose lines and extracted image URLs. */
function splitMessage(message: string): { prose: string; images: string[] } {
  const images: string[] = []
  const proseLines: string[] = []

  for (const rawLine of (message || '').split('\n')) {
    const line = rawLine.trim()

    // "Photo N: <url>" lines from the attachment block
    const photoMatch = PHOTO_LINE.exec(line)
    if (photoMatch && isImageUrl(photoMatch[1])) {
      images.push(photoMatch[1])
      continue
    }

    // Bare image URLs pasted on their own line
    if (/^https?:\/\/\S+$/.test(line) && isImageUrl(line)) {
      images.push(line)
      continue
    }

    proseLines.push(rawLine)
  }

  // Drop a dangling "[Attachments]" header that no longer has content under it
  const prose = proseLines
    .join('\n')
    .replace(/\n*\[Attachments\]\s*$/, '')
    .trimEnd()

  return { prose, images }
}

interface SupportMessageBodyProps {
  message: string
  /** Classes for the prose block (colors differ per bubble side). */
  proseClassName?: string
  /** Called when a thumbnail is tapped — host page opens its preview dialog. */
  onOpenImage: (url: string) => void
}

export function SupportMessageBody({
  message,
  proseClassName,
  onOpenImage,
}: SupportMessageBodyProps) {
  const { prose, images } = splitMessage(message)

  return (
    <div>
      {prose && (
        <p className={cn('text-sm whitespace-pre-wrap break-words', proseClassName)}>
          {prose}
        </p>
      )}
      {images.length > 0 && (
        <div className={cn('flex flex-wrap gap-2', prose && 'mt-2')}>
          {images.map((url, i) => (
            <img
              key={`${i}-${url}`}
              src={url}
              alt={`Attachment ${i + 1}`}
              loading="lazy"
              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-black/10 dark:border-white/10 cursor-pointer hover:opacity-85 transition-opacity"
              onClick={() => onOpenImage(url)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
