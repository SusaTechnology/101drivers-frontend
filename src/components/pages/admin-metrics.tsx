// components/pages/admin-metrics.tsx
//
// Product metrics dashboard (Task 72) — "like big companies do":
// an immutable event ledger (PAGE_VIEW / SIGNUP / LOGIN / DELIVERY_CREATED)
// surfaced as KPI cards with period-over-period deltas, gap-free
// hourly/daily/monthly graphs, cumulative growth curves and the raw
// "track of records" table. Data comes from the ADMIN-only
// /api/analytics/* endpoints; all numbers are server-authoritative.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  CalendarRange,
  Eye,
  Package,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UserPlus,
  LogIn,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Navbar } from '@/components/shared/layout/testNavbar'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { useSocketEvent } from '@/hooks/useSocket'
import { socketJoinStaffOps, socketLeaveStaffOps } from '@/lib/socket'
import {
  LIVE_REFRESH_MS,
  metricsWindow,
  useAnalyticsBlockedSignups,
  useAnalyticsHourly,
  useAnalyticsOverview,
  useAnalyticsRecords,
  type MetricsRange,
} from '@/hooks/useAnalytics'

// ── Metric catalog ────────────────────────────────────────────────────

const METRICS = [
  {
    key: 'PAGE_VIEW' as const,
    label: 'Web Visits',
    color: '#3b82f6',
    icon: Eye,
    blurb: 'Page views across the whole app',
  },
  {
    key: 'SIGNUP' as const,
    label: 'Sign-ups',
    color: '#8b5cf6',
    icon: UserPlus,
    blurb: 'Completed registrations (all roles)',
  },
  {
    key: 'LOGIN' as const,
    label: 'Log-ins',
    color: '#f59e0b',
    icon: LogIn,
    blurb: 'Successful sign-ins',
  },
  {
    key: 'DELIVERY_CREATED' as const,
    label: 'Deliveries Created',
    color: '#22c55e',
    icon: Package,
    blurb: 'Real deliveries (dealer, individual, draft promotion)',
  },
] as const

const chartConfig = {
  PAGE_VIEW: { label: 'Visits', color: '#3b82f6' },
  SIGNUP: { label: 'Sign-ups', color: '#8b5cf6' },
  LOGIN: { label: 'Log-ins', color: '#f59e0b' },
  DELIVERY_CREATED: { label: 'Deliveries', color: '#22c55e' },
} satisfies ChartConfig

const TYPE_CHIP: Record<string, string> = {
  PAGE_VIEW: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  SIGNUP: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  LOGIN: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  DELIVERY_CREATED: 'bg-green-500/10 text-green-600 border-green-500/30',
}

const numFmt = new Intl.NumberFormat('en-US')

function fmtBucket(iso: string, interval: 'hour' | 'day' | 'month'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  if (interval === 'hour')
    return d.toLocaleTimeString('en-US', { hour: 'numeric' })
  if (interval === 'month')
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────

const RANGE_CHIPS: { value: MetricsRange; label: string }[] = [
  { value: '24H', label: '24 hours' },
  { value: '7D', label: '7 days' },
  { value: '30D', label: '30 days' },
  { value: '12M', label: '12 months' },
  { value: 'CUSTOM', label: 'Custom' },
]

/** Records table rows per page. */
const RECORDS_PAGE_SIZE = 10

export default function AdminMetricsPage() {
  const { actionItems, signOut } = useAdminActions()

  const [range, setRange] = useState<MetricsRange>('30D')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [recordsType, setRecordsType] = useState('ALL')
  const [recordsPage, setRecordsPage] = useState(1)
  const [blockedPage, setBlockedPage] = useState(1)

  const win = useMemo(
    () => metricsWindow(range, customFrom, customTo),
    [range, customFrom, customTo]
  )

  const overview = useAnalyticsOverview(win)
  const hourly = useAnalyticsHourly(win, range === '24H')
  const records = useAnalyticsRecords(win, recordsType, recordsPage, RECORDS_PAGE_SIZE)
  const blocked = useAnalyticsBlockedSignups(win, blockedPage)

  // Ticking clock so the "Updated Ns ago" readout stays honest between polls.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  const data = overview.data

  // Main chart rows: hourly for 24H, daily for 7D/30D, monthly for 12M.
  const mainRows: Record<string, number | string>[] = useMemo(() => {
    if (range === '24H') return Array.isArray(hourly.data) ? hourly.data : []
    if (range === '12M') return data?.monthly ?? []
    return data?.daily ?? []
  }, [range, hourly.data, data])

  // Cumulative growth rows (24H derives from hourly; others come ready).
  const cumulativeRows: Record<string, number | string>[] = useMemo(() => {
    if (range === '24H') {
      const rows = Array.isArray(hourly.data) ? hourly.data : []
      const running: Record<string, number> = {}
      return rows.map((row) => {
        const entry: Record<string, number | string> = { bucket: row.bucket }
        for (const m of METRICS) {
          running[m.key] = (running[m.key] ?? 0) + (Number(row[m.key] ?? 0) as number)
          entry[m.key] = running[m.key]
        }
        return entry
      })
    }
    return data?.cumulative ?? []
  }, [range, hourly.data, data])

  const isFetching = overview.isFetching || (range === '24H' && hourly.isFetching)

  // Live readout: seconds since the last successful overview poll.
  const secondsAgo =
    overview.dataUpdatedAt > 0
      ? Math.max(0, Math.round((nowTick - overview.dataUpdatedAt) / 1000))
      : null

  const changeRange = (next: MetricsRange) => {
    setRange(next)
    setRecordsPage(1)
    setBlockedPage(1)
  }

  // ── Socket live updates (real-time, not just the 15s poll) ────────────
  // The backend emits a contentless "metrics:changed" ping to the
  // staff:ops room whenever the analytics ledger (visits / signups /
  // logins / deliveries) or the blocked-signups ledger gains a row
  // (throttled server-side to one per few seconds). We join the room
  // while this page is mounted and debounce invalidations so a burst is
  // ONE refetch. The 15s refetchInterval stays as the safety net for a
  // dropped socket.
  const queryClient = useQueryClient()
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMetricsChanged = useCallback(() => {
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current)
    invalidateTimer.current = setTimeout(() => {
      invalidateTimer.current = null
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    }, 1500)
  }, [queryClient])

  useEffect(() => {
    socketJoinStaffOps()
    return () => {
      socketLeaveStaffOps()
      if (invalidateTimer.current) {
        clearTimeout(invalidateTimer.current)
        invalidateTimer.current = null
      }
    }
  }, [])
  useSocketEvent('metrics:changed', handleMetricsChanged)

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      <main className="w-full max-w-[1600px] mx-auto px-4 lg:px-5 py-4 lg:py-5 space-y-4">
        {/* Header + range controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Metrics
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every visit, sign-up, log-in and delivery — tracked as permanent
              records, not just today&apos;s snapshot.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {range === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 text-xs">
                <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1"
                  aria-label="From date"
                />
                <span className="text-muted-foreground">→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1"
                  aria-label="To date"
                />
              </div>
            )}
            <div className="flex rounded-lg border p-0.5 bg-muted/40">
              {RANGE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => changeRange(chip.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    range === chip.value
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div
              className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs"
              title={`Auto-refreshes every ${LIVE_REFRESH_MS / 1000}s while this tab is open`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="font-semibold text-green-600">Live</span>
              {secondsAgo !== null && (
                <span className="text-muted-foreground tabular-nums">
                  · {secondsAgo}s ago
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                overview.refetch()
                hourly.refetch()
                records.refetch()
              }}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {METRICS.map((m) => {
            const totals = data?.totals?.[m.key]
            return (
              <div
                key={m.key}
                className="rounded-xl border bg-card p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                      style={{ backgroundColor: `${m.color}1a` }}
                    >
                      <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {m.label}
                    </span>
                  </div>
                  <DeltaBadge
                    deltaPct={totals?.deltaPct}
                    prevLabel={win.prevLabel}
                  />
                </div>
                <div className="text-2xl font-semibold tabular-nums leading-none">
                  {totals ? numFmt.format(totals.current) : '—'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {totals
                    ? `Today ${numFmt.format(totals.today)} · Yesterday ${numFmt.format(
                        totals.yesterday
                      )}`
                    : m.blurb}
                </div>
              </div>
            )
          })}
        </div>

        {/* Main activity chart */}
        <ChartPanel
          title="Activity over time"
          subtitle={`${RANGE_CHIPS.find((c) => c.value === range)?.label ?? ''} — ${
            range === '24H' ? 'hourly' : range === '12M' ? 'monthly' : 'daily'
          } buckets, gap-free`}
          loading={!data && !overview.isError}
        >
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <AreaChart data={mainRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v: any) => fmtBucket(String(v), win.interval)}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label: any) => fmtBucket(String(label), win.interval)}
                  />
                }
              />
              {METRICS.map((m) => (
                <Area
                  key={m.key}
                  dataKey={m.key}
                  type="monotone"
                  stroke={`var(--color-${m.key})`}
                  fill={`var(--color-${m.key})`}
                  fillOpacity={0.12}
                  strokeWidth={2}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ChartContainer>
        </ChartPanel>

        {/* Growth + monthly charts */}
        <div className="grid xl:grid-cols-2 gap-4">
          <ChartPanel
            title="Cumulative growth"
            subtitle={`Running totals across the selected window (${win.prevLabel.replace('vs ', '')})`}
            loading={!data && !overview.isError}
          >
            <ChartContainer config={chartConfig} className="h-60 w-full">
              <AreaChart data={cumulativeRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(v: any) => fmtBucket(String(v), win.interval)}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label: any) => fmtBucket(String(label), win.interval)}
                    />
                  }
                />
                {METRICS.map((m) => (
                  <Area
                    key={m.key}
                    dataKey={m.key}
                    type="monotone"
                    stroke={`var(--color-${m.key})`}
                    fill={`var(--color-${m.key})`}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </ChartPanel>

          <ChartPanel
            title="Monthly volume"
            subtitle="Last 12 months, per metric — the long-run record"
            loading={!data && !overview.isError}
          >
            <ChartContainer config={chartConfig} className="h-60 w-full">
              <BarChart data={data?.monthly ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(v: any) => fmtBucket(String(v), 'month')}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label: any) => fmtBucket(String(label), 'month')}
                    />
                  }
                />
                {METRICS.map((m) => (
                  <Bar
                    key={m.key}
                    dataKey={m.key}
                    fill={`var(--color-${m.key})`}
                    fillOpacity={0.85}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </ChartPanel>
        </div>

        {/* Records — the raw track of records */}
        <div className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" />
                Records
              </h2>
              <p className="text-[11px] text-muted-foreground">
                The raw event ledger — append-only, never pruned. {numFmt.format(records.data?.total ?? 0)} rows in window.
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {['ALL', ...METRICS.map((m) => m.key)].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setRecordsType(t)
                    setRecordsPage(1)
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    recordsType === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'ALL' ? 'All' : (chartConfig as any)[t]?.label ?? t}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3.5 py-2 font-medium">When</th>
                  <th className="px-3.5 py-2 font-medium">Event</th>
                  <th className="px-3.5 py-2 font-medium">Detail</th>
                  <th className="px-3.5 py-2 font-medium">User</th>
                  <th className="px-3.5 py-2 font-medium">Session</th>
                  <th className="px-3.5 py-2 font-medium">IP</th>
                  <th className="px-3.5 py-2 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody>
                {records.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3.5 py-8 text-center text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : (records.data?.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3.5 py-8 text-center text-muted-foreground">
                      No events recorded in this window yet — records appear as
                      people visit, sign up, log in and create deliveries.
                    </td>
                  </tr>
                ) : (
                  (records.data?.rows ?? []).map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3.5 py-2 whitespace-nowrap tabular-nums">
                        {fmtDateTime(row.occurredAt)}
                      </td>
                      <td className="px-3.5 py-2">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            TYPE_CHIP[row.type] ?? 'border-border'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 max-w-[280px] truncate text-muted-foreground">
                        {row.path ||
                          describeMetadata(row.type, row.metadata, row.role)}
                      </td>
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        <UserNameCell
                          userName={row.userName}
                          userId={row.userId}
                          role={row.role}
                        />
                      </td>
                      <td className="px-3.5 py-2 font-mono text-[10px] text-muted-foreground">
                        {row.sessionId ? shortId(row.sessionId) : '—'}
                      </td>
                      <td className="px-3.5 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {row.ip || '—'}
                      </td>
                      <td className="px-3.5 py-2 max-w-[200px] truncate text-[10px] text-muted-foreground" title={row.userAgent || undefined}>
                        {row.userAgent || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-3.5 py-2 text-xs">
            <span className="text-muted-foreground">
              Page {recordsPage}
              {records.data
                ? ` of ${Math.max(1, Math.ceil(records.data.total / RECORDS_PAGE_SIZE))} · ${numFmt.format(records.data.total)} total`
                : ''}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={recordsPage <= 1}
                onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !records.data ||
                  recordsPage * RECORDS_PAGE_SIZE >= records.data.total
                }
                onClick={() => setRecordsPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Blocked signups — the spam radar */}
        <div className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                Blocked signups
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Driver-registration attempts rejected because they came from
                a desktop browser (signup is mobile only). {numFmt.format(blocked.data?.total ?? 0)}{' '}
                in window — repeated IPs with rotating emails are your spam
                radar.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3.5 py-2 font-medium">When</th>
                  <th className="px-3.5 py-2 font-medium">IP</th>
                  <th className="px-3.5 py-2 font-medium">Attempted email</th>
                  <th className="px-3.5 py-2 font-medium">Reason</th>
                  <th className="px-3.5 py-2 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody>
                {blocked.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3.5 py-8 text-center text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : (blocked.data?.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3.5 py-8 text-center text-muted-foreground">
                      No blocked attempts in this window — desktop visitors
                      see the &ldquo;Signup is mobile only&rdquo; card and
                      never reach the form.
                    </td>
                  </tr>
                ) : (
                  (blocked.data?.rows ?? []).map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3.5 py-2 whitespace-nowrap tabular-nums">
                        {fmtDateTime(row.createdAt)}
                      </td>
                      <td className="px-3.5 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {row.ip || '—'}
                      </td>
                      <td className="px-3.5 py-2 max-w-[220px] truncate text-muted-foreground">
                        {row.email || '—'}
                      </td>
                      <td className="px-3.5 py-2">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            row.reason === 'DESKTOP_UA' || row.reason === 'TABLET_UA'
                              ? 'bg-red-500/10 text-red-600 border-red-500/30'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          }`}
                        >
                          {row.reason || 'UNKNOWN'}
                        </span>
                      </td>
                      <td
                        className="px-3.5 py-2 max-w-[260px] truncate text-[10px] text-muted-foreground"
                        title={row.userAgent || undefined}
                      >
                        {row.userAgent || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-3.5 py-2 text-xs">
            <span className="text-muted-foreground">
              Page {blockedPage}
              {blocked.data ? ` · ${numFmt.format(blocked.data.total)} total` : ''}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={blockedPage <= 1}
                onClick={() => setBlockedPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !blocked.data ||
                  blockedPage * 20 >= blocked.data.total
                }
                onClick={() => setBlockedPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Small building blocks ─────────────────────────────────────────────

function DeltaBadge({
  deltaPct,
  prevLabel,
}: {
  deltaPct: number | null | undefined
  prevLabel: string
}) {
  if (deltaPct === undefined) return null
  if (deltaPct === null) {
    return (
      <Badge variant="outline" className="text-[10px] font-semibold border-blue-500/40 text-blue-600">
        new
      </Badge>
    )
  }
  const rounded = Math.round(deltaPct * 10) / 10
  const up = rounded > 0
  const flat = rounded === 0
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
      title={prevLabel}
    >
      {flat ? null : up ? (
        <TrendingUp className="h-3 w-3 text-green-600" />
      ) : (
        <TrendingDown className="h-3 w-3 text-red-500" />
      )}
      <span className={flat ? 'text-muted-foreground' : up ? 'text-green-600' : 'text-red-500'}>
        {up ? '+' : ''}
        {rounded}%
      </span>
    </span>
  )
}

function ChartPanel({
  title,
  subtitle,
  loading,
  children,
}: {
  title: string
  subtitle: string
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="px-3.5 py-2.5 border-b">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="px-2 pb-2 pt-3">
        {loading ? (
          <div className="h-72 w-full animate-pulse rounded-lg bg-muted/50" />
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

/**
 * Records table "User" cell — full name (+ role at event time) resolved
 * server-side from the ledger's userId. Falls back to the short id for
 * rows whose user no longer resolves, and to "Visitor" for anonymous
 * traffic (e.g. logged-out PAGE_VIEW rows). Hover shows the raw id.
 */
function UserNameCell({
  userName,
  userId,
  role,
}: {
  userName?: string | null
  userId?: string | null
  role?: string | null
}) {
  const name = userName ?? (userId ? shortId(userId) : null)
  if (!name) {
    return <span className="text-muted-foreground">Visitor</span>
  }
  return (
    <div
      className="flex items-center gap-1.5 whitespace-nowrap"
      title={userId ?? undefined}
    >
      <span className="font-medium text-foreground">{name}</span>
      {role ? (
        <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {role}
        </span>
      ) : null}
    </div>
  )
}

function describeMetadata(
  type: string,
  metadata: Record<string, unknown> | null,
  role?: string | null
): string {
  // Server-side auth events carry no metadata — describe them from the
  // event type + role so the Detail column never reads as a bare "—".
  if (type === 'SIGNUP') {
    return role ? `New ${role} account created` : 'New account created'
  }
  if (type === 'LOGIN') {
    return role ? `Signed in as ${role}` : 'Signed in'
  }
  if (!metadata) return '—'
  if (type === 'DELIVERY_CREATED') {
    const source = typeof metadata.source === 'string' ? metadata.source : 'unknown'
    const status = typeof metadata.status === 'string' ? metadata.status : ''
    return `delivery via ${source}${status ? ` · ${status}` : ''}`
  }
  const parts: string[] = []
  for (const [k, v] of Object.entries(metadata)) {
    if (v !== null && v !== undefined) parts.push(`${k}=${String(v)}`)
  }
  return parts.length ? parts.join(' · ') : '—'
}
