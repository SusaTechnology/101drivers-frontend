// ChargeBreakdownDialog — reusable "how did we get to this number?" dialog.
//
// A drop-in, money line-item breakdown dialog built for NON-TECHNICAL
// readers seeing it for the first time:
//   • Description / Amount column layout (matches the weekly invoice email)
//   • every row = one real thing (a delivery, a refund, a credit)
//   • a single bold Total at the bottom that the rows actually add up to
//   • plain-English intro sentence — the number and the words always agree
//
// Reuse it anywhere a money figure needs explaining (dealer next charge,
// admin billing previews, refunds summaries...). Nothing in here knows
// about postpaid billing — the caller composes title, intro, sections,
// rows and total.
//
// Usage:
//   <ChargeBreakdownDialog
//     open={open} onOpenChange={setOpen}
//     title="How we get to $447.19"
//     intro="This is the exact amount your next invoice will charge."
//     badge={{ label: 'Estimated', tone: 'amber' }}
//     sections={[{ id: 'deliveries', rows: [{ id, title, subtitle, amountCents }] }]}
//     totalLabel="Total"
//     totalCents={44719}
//     footnote="Tips are charged separately."
//   />

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ChargeBreakdownRow {
  id: string
  /** Main line, e.g. "Delivery #3gifyqd1 — Marina Del Rey, CA → Santa Ana, CA (47.3 mi)" */
  title: string
  /** Small helper line under the title, e.g. "Completed Sep 12, 2026". */
  subtitle?: string | null
  /** Signed cents. Negative = reduces the total (credit / refund). */
  amountCents: number
}

export interface ChargeBreakdownSection {
  id: string
  /** Optional heading above the rows, e.g. "Refunds & credits". */
  heading?: string
  /** Optional plain-English sentence explaining this group. */
  description?: string
  /** "warning" renders the group as an amber callout (attention, not alarm). */
  tone?: 'default' | 'warning'
  rows: ChargeBreakdownRow[]
}

export interface ChargeBreakdownBadge {
  label: string
  tone?: 'amber' | 'blue' | 'green'
}

/** "$138.14" / "−$30.00" — typographic minus for negatives, non-technical friendly. */
export function formatBreakdownMoney(cents: number): string {
  const dollars = Math.abs(cents) / 100
  const formatted = dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return cents < 0 ? `−$${formatted}` : `$${formatted}`
}

const BADGE_STYLES: Record<NonNullable<ChargeBreakdownBadge['tone']>, string> = {
  amber:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  green:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

interface ChargeBreakdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** e.g. "How we get to $818.02" — says what the dialog explains. */
  title: string
  /** Screen-reader-only companion text used when no visible `intro`
   *  is provided (Radix requires a DialogDescription for a11y). */
  description?: string
  /** One plain-English sentence under the title. Keep the words and the
   *  total consistent — never say "nothing due" while totalCents > 0. */
  intro?: React.ReactNode
  /** Small pill next to the title ("Estimated" / "Final amount"). */
  badge?: ChargeBreakdownBadge | null
  /** Row groups, rendered top to bottom. Empty sections are skipped. */
  sections: ChargeBreakdownSection[]
  /** "Total" when the figure is exact, "Estimated total" otherwise. */
  totalLabel: string
  /** THE number the rows add up to, in cents. */
  totalCents: number
  /** Small print at the very bottom (tips, support line...). */
  footnote?: React.ReactNode
}

export default function ChargeBreakdownDialog({
  open,
  onOpenChange,
  title,
  description,
  intro,
  badge,
  sections,
  totalLabel,
  totalCents,
  footnote,
}: ChargeBreakdownDialogProps) {
  const visibleSections = sections.filter((s) => s.rows.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg rounded-2xl max-h-[85dvh] overflow-y-auto"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </DialogTitle>
            {badge && (
              <span
                className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 shrink-0 ${BADGE_STYLES[badge.tone ?? 'blue']}`}
              >
                {badge.label}
              </span>
            )}
          </div>
          {intro ? (
            <DialogDescription className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 text-left">
              {intro}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              {description ?? title}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Line items — the same Description/Amount layout as the
            weekly invoice email, so the dialog and the email agree. */}
        {visibleSections.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Column headers */}
            <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Description
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Amount
              </span>
            </div>

            {visibleSections.map((section, sectionIdx) => {
              const isWarning = section.tone === 'warning'
              const rows = (
                <div
                  className={
                    isWarning
                      ? 'bg-amber-50/70 dark:bg-amber-950/25'
                      : undefined
                  }
                >
                  {(section.heading || section.description) && (
                    <div className="px-3 pt-2.5 pb-1">
                      {section.heading && (
                        <div
                          className={`text-[11px] font-bold ${
                            isWarning
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {section.heading}
                        </div>
                      )}
                      {section.description && (
                        <div
                          className={`text-[10px] mt-0.5 leading-snug ${
                            isWarning
                              ? 'text-amber-600 dark:text-amber-500'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {section.description}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {section.rows.map((row) => {
                      const negative = row.amountCents < 0
                      return (
                        <div
                          key={row.id}
                          className="px-3 py-2.5 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium leading-snug text-slate-800 dark:text-slate-100 break-words">
                              {row.title}
                            </div>
                            {row.subtitle && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {row.subtitle}
                              </div>
                            )}
                          </div>
                          <div
                            className={`text-xs font-bold shrink-0 text-right ${
                              negative
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {formatBreakdownMoney(row.amountCents)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
              // Thin separator between sections (skip before the first).
              return (
                <div key={section.id}>
                  {sectionIdx > 0 && (
                    <div className="border-t-2 border-slate-200 dark:border-slate-800" />
                  )}
                  {rows}
                </div>
              )
            })}

            {/* Total — the rows above must add up to this. */}
            <div className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2.5 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {totalLabel}
              </span>
              <span className="text-base font-black text-slate-900 dark:text-white">
                {formatBreakdownMoney(totalCents)}
              </span>
            </div>
          </div>
        )}

        {footnote && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed -mt-1">
            {footnote}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
