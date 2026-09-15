// components/pages/admin-billing-health.tsx
//
// Admin "Billing Health" — the fleet-wide answer to "which dealers need
// payment help right now?" Before this page, the only way to find a
// frozen dealer was opening profiles one by one; /admin/health showed
// counts but no names. This page lists everyone needing attention, by
// name, with one-click actions (retry / unfreeze) that reuse the same
// per-dealer endpoints as the Postpaid Billing profile card.
//
// Sections, ordered by urgency:
//   1. FROZEN — blocked from creating deliveries (3rd consecutive
//      failure, or a critical decline like fraud). The dealer has been
//      emailed + notified in-app; these are the ones who may need a human.
//   2. FAILING (pre-freeze) — 1-2 consecutive failures. The graduated
//      policy hasn't frozen them yet; a retry here can prevent the freeze.
//   3. UNCOLLECTIBLE — remainder charges written off after the 7-day
//      retry window. The system can't collect these; admin decides.
//
// Data: GET /api/postpaid-billing/admin/billing-health (admin-only),
// polled every 60s like the rest of the billing surfaces.

import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Navbar } from '../shared/layout/testNavbar'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import {
  FrozenDealerRow,
  WarningDealerRow,
  formatMoney,
} from '@/components/admin/BillingHealthRows'

const API_URL = import.meta.env.VITE_API_URL

interface BillingHealthData {
  frozenDealers: Array<
    import('@/components/admin/BillingHealthRows').FrozenDealerRowData
  >
  warningDealers: Array<
    import('@/components/admin/BillingHealthRows').WarningDealerRowData
  >
  uncollectiblePayments: Array<{
    paymentId: string
    deliveryId: string
    dealerId: string
    businessName: string | null
    amount: number
    amountDollars: number
    writtenOffAt: string | null
  }>
  totals: {
    frozenCount: number
    warningCount: number
    uncollectibleCount: number
    frozenOutstandingCents: number
    frozenOutstandingDollars: number
  }
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string | number
  sub?: string
  tone: 'red' | 'amber' | 'rose' | 'dark'
}) {
  const tones = {
    red: 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20',
    amber:
      'border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20',
    rose: 'border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20',
    dark: 'border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-950',
  }
  const valueTones = {
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    dark: 'text-white',
  }
  const labelTones = {
    red: 'text-red-500/80',
    amber: 'text-amber-500/80',
    rose: 'text-rose-500/80',
    dark: 'text-slate-400',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div
        className={`text-[10px] font-bold uppercase tracking-widest ${labelTones[tone]}`}
      >
        {label}
      </div>
      <div className={`text-2xl font-black mt-1 ${valueTones[tone]}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

function SectionHeader({
  title,
  count,
  description,
}: {
  title: string
  count: number
  description: string
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
          {title}
        </h2>
        <Badge
          className={
            count > 0
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] h-5'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 text-[10px] h-5'
          }
        >
          {count}
        </Badge>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {description}
      </p>
    </div>
  )
}

export default function AdminBillingHealthPage() {
  const { actionItems, signOut } = useAdminActions()

  const {
    data: health,
    isLoading,
    isFetching,
    refetch,
  } = useDataQuery<BillingHealthData>({
    apiEndPoint: `${API_URL}/api/postpaid-billing/admin/billing-health`,
    noFilter: true,
    refetchInterval: 60 * 1000,
  })

  const allClear =
    health &&
    health.totals.frozenCount === 0 &&
    health.totals.warningCount === 0 &&
    health.totals.uncollectibleCount === 0

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header — same shell as the other admin pages */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="bg-primary/10 border-primary/25 text-primary-foreground"
              >
                <HeartPulse className="w-3.5 h-3.5 mr-1" />
                Finance
              </Badge>
              <Badge
                variant="outline"
                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                Dealer Billing
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Billing Health</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-3xl">
              Every dealer who needs payment help right now — frozen, failing,
              or written off — with one-click actions. Dealers are notified
              automatically at each failure stage; this is the escalation view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin-payments">
              <Button variant="outline" size="sm" className="rounded-xl">
                All Payments
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              size="sm"
              className="bg-primary text-slate-950 hover:bg-primary/90 rounded-xl"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </section>

        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : !health ? (
          <Card className="rounded-xl border-red-200 dark:border-red-900/40">
            <CardContent className="p-6 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              Couldn't load billing health. Check that the backend is running
              and you're signed in as an admin, then refresh.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI row */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <KpiCard
                label="Frozen dealers"
                value={health.totals.frozenCount}
                sub={
                  health.totals.frozenCount > 0
                    ? `${formatMoney(health.totals.frozenOutstandingDollars)} outstanding`
                    : 'none — all dealers can create deliveries'
                }
                tone="red"
              />
              <KpiCard
                label="Failing (pre-freeze)"
                value={health.totals.warningCount}
                sub="1-2 consecutive failures"
                tone="amber"
              />
              <KpiCard
                label="Uncollectible"
                value={health.totals.uncollectibleCount}
                sub="written-off remainders"
                tone="rose"
              />
              <KpiCard
                label="Frozen outstanding"
                value={formatMoney(health.totals.frozenOutstandingDollars)}
                sub="owed by frozen dealers"
                tone="dark"
              />
            </section>

            {allClear && (
              <Card className="rounded-xl border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20 mb-6">
                <CardContent className="p-5 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-green-800 dark:text-green-200 text-sm">
                      All clear — no dealer needs billing help right now
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Failed charges, self-healing sweeps, and write-offs are
                      all handled automatically. This page updates every
                      minute; the daily auto-retry runs at 6AM server time.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 1 — frozen */}
            {health.frozenDealers.length > 0 && (
              <section className="mb-8">
                <SectionHeader
                  title="Frozen — cannot create deliveries"
                  count={health.totals.frozenCount}
                  description="3rd consecutive failure (or a critical decline). Retry the charge once their card is fixed, or unfreeze manually if you've confirmed payment another way."
                />
                <div className="space-y-3">
                  {health.frozenDealers.map((dealer) => (
                    <FrozenDealerRow
                      key={dealer.dealerId}
                      dealer={dealer}
                      refetch={() => refetch()}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Section 2 — failing but not frozen */}
            {health.warningDealers.length > 0 && (
              <section className="mb-8">
                <SectionHeader
                  title="Failing — not frozen yet"
                  count={health.totals.warningCount}
                  description="1-2 consecutive failures. The dealer has been emailed and notified in-app with an Update card button. A successful retry here prevents the freeze entirely."
                />
                <div className="space-y-3">
                  {health.warningDealers.map((dealer) => (
                    <WarningDealerRow
                      key={dealer.dealerId}
                      dealer={dealer}
                      refetch={() => refetch()}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Section 3 — uncollectible remainders */}
            {health.uncollectiblePayments.length > 0 && (
              <section className="mb-8">
                <SectionHeader
                  title="Uncollectible — written off"
                  count={health.totals.uncollectibleCount}
                  description="Mid-trip remainder charges that failed for 7+ days (customer removed their card and never replaced it). The system can't collect these — contact the dealer or invoice manually."
                />
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/10 divide-y divide-rose-100 dark:divide-rose-900/30">
                  {health.uncollectiblePayments.map((p) => (
                    <div
                      key={p.paymentId}
                      className="flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {p.businessName || 'Unnamed dealer'}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {p.paymentId}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs font-black text-rose-600 dark:text-rose-400">
                          <DollarSign className="w-3 h-3" />
                          {p.amountDollars.toFixed(2)}
                        </div>
                        <Link
                          to={`/admin-payment-detail?paymentId=${p.paymentId}`}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-7 text-xs"
                          >
                            View payment
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Footer note — what the system already does on its own */}
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-700 dark:text-slate-200">
                  Running without you:
                </strong>{' '}
                dealers get emailed + notified in-app at each failure stage and
                can update their card themselves; the 6AM cron retries every
                frozen dealer with a saved card and auto-unfreezes on success;
                the 3AM sweep + boot catch-up heal stranded charges; written-off
                invoices unfreeze automatically. Step in here when a dealer has
                no card, keeps declining, or asks for help.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
