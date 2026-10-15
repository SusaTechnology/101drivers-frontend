// Shared support-conversation sender identity pieces.
//
// Task 27 follow-up: seeing only the sender's NAME was not enough — ops asked
// for the email, the phone number and the selfie of whoever sends each
// message. The backend enriches note.authorUser / request.user /
// request.assignedTo with phone + role-profile photo/business data; these
// components render it consistently on all three detail pages (admin /
// dealer / driver).
import React from 'react'
import { Mail, Phone, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  resolveSupportIdentity,
  type ResolvedSupportIdentity,
  type SupportUserIdentity,
} from '@/types/support'

// ── Avatar ──────────────────────────────────────────────────────────────────
// The sender's selfie when one exists (drivers), otherwise initials on a
// neutral disc. Tap → full-size preview via the page's PhotoDialog.
export function SupportAvatar({
  identity,
  className,
  onOpenPhoto,
}: {
  identity?: SupportUserIdentity | null
  className?: string
  /** Called with the photo URL on tap — only when a photo exists */
  onOpenPhoto?: (url: string) => void
}) {
  const resolved: ResolvedSupportIdentity = resolveSupportIdentity(identity)
  const content = resolved.photoUrl ? (
    <img
      src={resolved.photoUrl}
      alt={resolved.name}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center font-black',
        className?.includes('text-') ? '' : 'text-[11px]'
      )}
    >
      {resolved.initials}
    </span>
  )

  const base = cn(
    'shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    className || 'h-8 w-8'
  )

  if (!onOpenPhoto || !resolved.photoUrl) {
    return <div className={base}>{content}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onOpenPhoto(resolved.photoUrl!)}
      className={cn(base, 'transition hover:ring-2 hover:ring-lime-500/60 focus:outline-none')}
      aria-label={`Open photo of ${resolved.name}`}
    >
      {content}
    </button>
  )
}

// ── Contact line ────────────────────────────────────────────────────────────
// Tiny "email · phone" strip rendered inside/under a chat bubble. Renders
// nothing when the author has neither field (e.g. system-shaped rows).
export function SupportContactLine({
  identity,
  variant = 'light',
  className,
}: {
  identity?: SupportUserIdentity | null
  /** light = on a light bubble surface, dark = on a saturated (blue/lime) bubble */
  variant?: 'light' | 'dark'
  className?: string
}) {
  const resolved = resolveSupportIdentity(identity)
  const hasEmail = !!resolved.email
  const hasPhone = !!resolved.phone
  if (!hasEmail && !hasPhone) return null

  return (
    <div
      className={cn(
        'mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-tight',
        variant === 'dark' ? 'text-white/75' : 'text-slate-400 dark:text-slate-500',
        className
      )}
    >
      {hasEmail && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{resolved.email}</span>
        </span>
      )}
      {hasEmail && hasPhone && <span aria-hidden="true">·</span>}
      {hasPhone && (
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3 shrink-0" />
          {resolved.phone}
        </span>
      )}
    </div>
  )
}

// ── Identity card ───────────────────────────────────────────────────────────
// Fuller block for "who am I talking to": avatar + name (+ business name for
// dealers) + tap-to-call / tap-to-email rows. Used in the admin sidebar and
// anywhere a standalone identity summary is needed.
export function SupportIdentityCard({
  identity,
  title,
  className,
  onOpenPhoto,
}: {
  identity?: SupportUserIdentity | null
  /** Small uppercase heading above the card, e.g. "Requested by" */
  title?: string
  className?: string
  onOpenPhoto?: (url: string) => void
}) {
  const resolved = resolveSupportIdentity(identity)
  const hasAny =
    !!identity && (resolved.photoUrl || resolved.email || resolved.phone || resolved.name !== 'Unknown')
  if (!hasAny) return null

  return (
    <div className={cn('space-y-2', className)}>
      {title && (
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {title}
        </div>
      )}
      <div className="flex items-start gap-3">
        <SupportAvatar
          identity={identity}
          className="h-12 w-12"
          onOpenPhoto={onOpenPhoto}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
            {resolved.name}
          </div>
          {resolved.businessName && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{resolved.businessName}</span>
            </div>
          )}
          {resolved.email && (
            <a
              href={`mailto:${resolved.email}`}
              className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-lime-600 dark:hover:text-lime-400"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{resolved.email}</span>
            </a>
          )}
          {resolved.phone && (
            <a
              href={`tel:${resolved.phone.replace(/[^+\d]/g, '')}`}
              className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-lime-600 dark:hover:text-lime-400"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {resolved.phone}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
