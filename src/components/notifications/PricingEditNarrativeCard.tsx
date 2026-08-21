/**
 * PricingEditNarrativeCard
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable card that renders a step-by-step narrative trace of a pricing-edit
 * failure (compensation failed OR system-level failure) for an admin.
 *
 * This is the visual rendering of what the user explicitly asked for:
 *
 *   "the admin should know it but clearly not just compensation.
 *    'this dealer by name tries this and this and this step by step
 *     then the system do this and then this fails this needs you'.
 *    kind of explanation. on there page if any."
 *
 * The card renders:
 *   1. Header — dealer name + role + email + delivery ref + severity badge
 *   2. "What the dealer tried" — price change, address changes, reason
 *   3. "What the system did, step by step" — visual timeline with ✓/✗ icons
 *   4. PaymentIntent ids involved (with copy-to-clipboard)
 *   5. "This needs you" — admin action checklist (with clickable Stripe link)
 *   6. Closing note (if any)
 *
 * Consumes the structured `failureSteps` + `adminAction` arrays stored in the
 * NotificationEvent.payload by the backend notification engine
 * (`notifyAdminCompensationFailed` and `notifyAdminPricingEditSystemFailure`).
 *
 * Reusability:
 *   - Pure presentational component. No data fetching.
 *   - Parent passes the notification `payload` object (typed loosely as
 *     `PricingEditIncidentPayload`); the card does the rest.
 *   - Can be embedded in the NotificationBell dropdown, the admin dashboard's
 *     "Needs Attention" panel, the admin delivery-detail page, or a future
 *     dedicated incident-review page.
 */
import React, { useState } from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronRight,
  User,
  Mail,
  CreditCard,
  ClipboardCopy,
  ExternalLink,
  MapPin,
  DollarSign,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Shape of the NotificationEvent.payload for pricing-edit admin notifications.
 * Mirrors the payload built by `notifyAdminCompensationFailed` and
 * `notifyAdminPricingEditSystemFailure` on the backend. Loosely typed because
 * NotificationEvent.payload is a JSON column.
 */
export interface PricingEditIncidentPayload {
  deliveryId?: string
  deliveryRef?: string
  errorCode?: string
  errorMessage?: string
  severity?: 'critical' | 'warning'
  actorName?: string
  actorEmail?: string
  actorRole?: string
  customerLabel?: string
  reason?: string
  oldPrice?: number | null
  newPrice?: number | null
  oldPaymentIntentId?: string | null
  newPaymentIntentId?: string | null
  orphanedPaymentIntentId?: string | null
  amount?: number
  dbError?: string | null
  stripeError?: string | null
  stripeCode?: string | null
  stripeDeclineCode?: string | null
  stripeDashboardUrl?: string | null
  failureType?: string
  failureSteps?: Array<{
    step: number
    label: string
    outcome: 'ok' | 'failed' | 'skipped'
    detail?: string
  }>
  adminAction?: string[]
  narrative?: {
    oldPickupAddress?: string
    oldDropoffAddress?: string
    newPickupAddress?: string
    newDropoffAddress?: string
    oldQuoteId?: string | null
    newQuoteId?: string
  } | null
}

interface PricingEditNarrativeCardProps {
  /** The notification payload. The card renders nothing if `failureSteps` is
   *  missing — that's the marker that this is a pricing-edit incident. */
  payload: PricingEditIncidentPayload | null | undefined
  /** Optional: compact mode (renders in a tighter card, for dashboard widgets). */
  compact?: boolean
}

function formatUsd(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `$${Number(amount).toFixed(2)}`
}

/** Small sub-component: a copy-to-clipboard chip for PI ids. */
function CopyableId({
  id,
  label,
}: {
  id: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail in insecure contexts — swallow silently.
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 text-[11px] font-mono text-slate-700 dark:text-slate-300 transition"
      title="Click to copy"
    >
      {label && <span className="font-sans font-bold text-slate-500">{label}:</span>}
      <span className="truncate max-w-[180px]">{id}</span>
      <ClipboardCopy className="h-3 w-3 text-slate-400" />
      {copied && <span className="text-emerald-600 font-sans">Copied!</span>}
    </button>
  )
}

export default function PricingEditNarrativeCard({
  payload,
  compact = false,
}: PricingEditNarrativeCardProps) {
  if (!payload || !payload.failureSteps) {
    // Not a pricing-edit incident — render nothing.
    return null
  }

  const isCritical = payload.severity === 'critical'
  const isCompensation = payload.failureType === 'COMPENSATION_FAILED'

  // Resolve the relevant PI ids to display.
  const orphanedPi =
    payload.orphanedPaymentIntentId ?? payload.newPaymentIntentId ?? null
  const oldPi = payload.oldPaymentIntentId ?? null

  // Determine the headline based on failure type.
  const headline = isCompensation
    ? 'Phantom authorization hold — manual Stripe cancel required'
    : payload.errorCode === 'STRIPE_NOT_CONFIGURED'
      ? 'Pricing edits broken — Stripe not configured on the server'
      : `Pricing edit system failure (${payload.errorCode ?? 'UNKNOWN'})`

  return (
    <div
      className={`rounded-2xl border-2 overflow-hidden ${
        isCritical
          ? 'border-rose-200 dark:border-rose-800/50 bg-rose-50/50 dark:bg-rose-900/10'
          : 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10'
      }`}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className={`px-4 py-3 flex items-start gap-3 ${
          isCritical
            ? 'bg-rose-100/70 dark:bg-rose-900/20'
            : 'bg-amber-100/70 dark:bg-amber-900/20'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isCritical
              ? 'bg-rose-600 text-white'
              : 'bg-amber-500 text-white'
          }`}
        >
          {isCritical ? (
            <ShieldAlert className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge
              variant="outline"
              className={`text-[10px] font-black uppercase tracking-wider ${
                isCritical
                  ? 'border-rose-400 text-rose-700 dark:text-rose-300'
                  : 'border-amber-400 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isCritical ? 'Critical' : 'Warning'}
            </Badge>
            {payload.failureType && (
              <Badge
                variant="outline"
                className="text-[10px] font-mono font-bold border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              >
                {payload.failureType}
              </Badge>
            )}
            {payload.deliveryRef && (
              <Badge
                variant="outline"
                className="text-[10px] font-extrabold border-slate-300 dark:border-slate-700 text-slate-500"
              >
                Delivery #{payload.deliveryRef}
              </Badge>
            )}
          </div>
          <p
            className={`text-sm font-black ${
              isCritical
                ? 'text-rose-900 dark:text-rose-200'
                : 'text-amber-900 dark:text-amber-200'
            }`}
          >
            {headline}
          </p>
        </div>
      </div>

      {/* ── Body: step-by-step narrative ───────────────────────────────── */}
      <div className="px-4 py-3 space-y-4">
        {/* Dealer + actor info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold">{payload.actorName ?? 'Unknown dealer'}</span>
            {payload.actorRole && (
              <span className="text-[10px] font-mono text-slate-500 ml-1">
                ({payload.actorRole})
              </span>
            )}
          </span>
          {payload.actorEmail && (
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              {payload.actorEmail}
            </span>
          )}
          {payload.customerLabel && (
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              {payload.customerLabel}
            </span>
          )}
        </div>

        {/* What the dealer tried */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
            What the dealer tried
          </p>
          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            {payload.oldPrice != null && payload.newPrice != null && (
              <li className="flex items-start gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  Change the price from{' '}
                  <span className="font-bold">{formatUsd(payload.oldPrice)}</span>{' '}
                  →{' '}
                  <span className="font-bold">{formatUsd(payload.newPrice)}</span>{' '}
                  <span className="text-slate-500">
                    (delta{' '}
                    {payload.newPrice > payload.oldPrice ? '+' : '−'}
                    {formatUsd(Math.abs(payload.newPrice - payload.oldPrice))})
                  </span>
                </span>
              </li>
            )}
            {payload.narrative?.oldPickupAddress &&
              payload.narrative?.newPickupAddress &&
              payload.narrative.oldPickupAddress !==
                payload.narrative.newPickupAddress && (
                <li className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>
                    Change pickup:{' '}
                    <span className="text-slate-500 line-through">
                      {payload.narrative.oldPickupAddress}
                    </span>{' '}
                    →{' '}
                    <span className="font-medium">
                      {payload.narrative.newPickupAddress}
                    </span>
                  </span>
                </li>
              )}
            {payload.narrative?.oldDropoffAddress &&
              payload.narrative?.newDropoffAddress &&
              payload.narrative.oldDropoffAddress !==
                payload.narrative.newDropoffAddress && (
                <li className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>
                    Change dropoff:{' '}
                    <span className="text-slate-500 line-through">
                      {payload.narrative.oldDropoffAddress}
                    </span>{' '}
                    →{' '}
                    <span className="font-medium">
                      {payload.narrative.newDropoffAddress}
                    </span>
                  </span>
                </li>
              )}
            {payload.reason && (
              <li className="flex items-start gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  Reason: <span className="italic">"{payload.reason}"</span>
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Step-by-step timeline */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
            What the system did, step by step
          </p>
          <ol className="space-y-2">
            {payload.failureSteps.map((step, idx) => {
              const isFailed = step.outcome === 'failed'
              const isOk = step.outcome === 'ok'
              const isSkipped = step.outcome === 'skipped'
              return (
                <li key={idx} className="flex items-start gap-2.5">
                  {/* Step number / icon */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                      isFailed
                        ? 'bg-rose-600 text-white'
                        : isOk
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isFailed ? (
                      <XCircle className="h-4 w-4" />
                    ) : isOk ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      step.step
                    )}
                  </div>
                  {/* Step body */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p
                      className={`text-xs font-medium ${
                        isFailed
                          ? 'text-rose-800 dark:text-rose-200'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {step.label}
                      {isFailed && (
                        <span className="ml-2 text-[10px] font-black uppercase text-rose-600">
                          FAILED
                        </span>
                      )}
                    </p>
                    {step.detail && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono break-all">
                        → {step.detail}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {/* PaymentIntent ids involved */}
        {(oldPi || orphanedPi) && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
              PaymentIntent ids involved
            </p>
            <div className="flex flex-wrap gap-2">
              {oldPi && (
                <CopyableId
                  id={oldPi}
                  label={isCompensation ? 'Old (still active)' : 'Original'}
                />
              )}
              {orphanedPi && (
                <CopyableId
                  id={orphanedPi}
                  label={isCompensation ? 'New (orphaned)' : 'New'}
                />
              )}
            </div>
          </div>
        )}

        {/* This needs you */}
        {payload.adminAction && payload.adminAction.length > 0 && (
          <div
            className={`rounded-xl p-3 ${
              isCritical
                ? 'bg-rose-100/60 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40'
                : 'bg-amber-100/60 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40'
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${
                isCritical
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              This needs you
            </p>
            <ol className="space-y-1.5">
              {payload.adminAction.map((action, idx) => {
                // Detect Stripe dashboard URLs and render them as clickable links.
                const urlMatch = action.match(
                  /(https:\/\/dashboard\.stripe\.com\/payments\/[^\s,]+)/,
                )
                const url = urlMatch?.[0]
                const urlIndex = url ? action.indexOf(url) : -1
                return (
                  <li
                    key={idx}
                    className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <span
                      className={`font-black ${
                        isCritical ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    >
                      {idx + 1}.
                    </span>
                    <span className="flex-1">
                      {urlIndex >= 0 && url ? (
                        <>
                          {action.slice(0, urlIndex)}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 font-mono text-sky-700 dark:text-sky-400 hover:underline break-all"
                          >
                            {url}
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                          {action.slice(urlIndex + url.length)}
                        </>
                      ) : (
                        action
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* Primary CTA: Stripe dashboard (if compensation failed) */}
        {isCompensation && orphanedPi && payload.stripeDashboardUrl && (
          <a
            href={payload.stripeDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold transition"
          >
            <CreditCard className="h-4 w-4" />
            Open in Stripe dashboard
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {/* Closing note */}
        {isCompensation && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
            The original PaymentIntent is still active and the delivery row is
            unchanged, so the customer is NOT double-charged. Only the orphaned
            hold above needs manual release.
          </p>
        )}
        {!isCompensation && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
            The dealer saw a friendly error dialog and can retry. The original
            authorization (if any) is still active — no orphan hold was created.
          </p>
        )}
      </div>

      {/* Footer: incident metadata */}
      {!compact && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {payload.deliveryId && (
              <span>
                deliveryId:{' '}
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {payload.deliveryId.slice(0, 8)}…
                </span>
              </span>
            )}
            {payload.stripeCode && (
              <span>
                stripeCode:{' '}
                <span className="font-bold text-rose-700 dark:text-rose-400">
                  {payload.stripeCode}
                </span>
              </span>
            )}
            {payload.stripeDeclineCode && (
              <span>
                declineCode:{' '}
                <span className="font-bold text-rose-700 dark:text-rose-400">
                  {payload.stripeDeclineCode}
                </span>
              </span>
            )}
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span>See server logs for full stack trace.</span>
          </div>
        </div>
      )}
    </div>
  )
}
