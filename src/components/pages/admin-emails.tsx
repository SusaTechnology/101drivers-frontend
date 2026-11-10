import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { authFetch, authFetchRaw } from '@/lib/tanstack/dataQuery'
import { useDebouncedValue } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Mail,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  UserPlus,
  BadgeCheck,
  CalendarClock,
  LifeBuoy,
  Download,
} from 'lucide-react'

// Mirrors backend/src/adminEmails — the NotificationEvent ledger is the
// single source of truth for "what did we actually send".
interface EmailRow {
  id: string
  status: 'SENT' | 'FAILED' | 'QUEUED'
  templateCode: string | null
  subject: string | null
  toEmail: string | null
  driverId: string | null
  createdAt: string
  sentAt: string | null
  failedAt: string | null
  errorMessage: string | null
  body: string | null
}

interface EmailsListResponse {
  items: EmailRow[]
  total: number
  page: number
  pageSize: number
}

interface TemplateStat {
  templateCode: string
  sent: number
  failed: number
  queued: number
  total: number
}

interface CampaignStat {
  campaign: string
  sent: number
  total: number
  lastAt: string
}

interface EmailsStatsResponse {
  since: string
  until: string
  totals: { sent: number; failed: number; queued: number; all: number }
  byTemplate: TemplateStat[]
  campaigns: CampaignStat[]
}

// Friendly names for the template codes admins actually pick; unknown codes
// fall back to the raw code in the dropdown.
const TEMPLATE_LABELS: Record<string, string> = {
  'driver-invited': 'Invites',
  'driver-approved': 'Driver approval',
  'dealer-approved': 'Dealer approval',
  'compliance-approved': 'Compliance approval',
  'driver-meeting-request': 'Meeting request',
  'payment-receipt': 'Payment receipt',
  'payment-failed': 'Payment failure',
  'support-created': 'Support ticket',
  'support-replied': 'Support reply',
  'support-assigned': 'Support assignment',
  'support-status': 'Support status',
  'email-verification': 'Email verification',
}

// Same allow-list as backend/scripts/audit-email-urls.ts — anything else in
// an email body is exactly the kind of wrong-domain link (techbee.et) this
// page exists to catch. cdn.101drivers.com is the upload host (license
// images, support attachments) and is always legitimate.
const ALLOWED_HOSTS = new Set([
  '101drivers.com',
  'www.101drivers.com',
  'cdn.101drivers.com',
])

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>)]+/g) ?? []
  return matches.map((u) => u.replace(/[.,;:]+$/, ''))
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function rowUrls(row: EmailRow): string[] {
  return Array.from(new Set(extractUrls(row.body ?? '')))
}

function rowHosts(row: EmailRow): string[] {
  return Array.from(
    new Set(rowUrls(row).map((u) => hostOf(u)).filter((h): h is string => !!h))
  )
}

function isCompliantHost(host: string): boolean {
  return ALLOWED_HOSTS.has(host)
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i

// Attachment images uploaded through the app live on the CDN with real
// extensions (…/101-drivers/<file>.png) — render those in the dialog instead
// of just another link row.
function isImageUrl(url: string): boolean {
  try {
    return IMAGE_EXT_RE.test(new URL(url).pathname)
  } catch {
    return false
  }
}

function rowImages(row: EmailRow): string[] {
  return rowUrls(row).filter(isImageUrl)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Campaign ids are stamped by the bulk script as
// "campaign-2026-11-08T14-30-…Z" — show a readable date ("Nov 8, 2026"),
// preferring the campaign's last event time from the stats endpoint.
function campaignLabel(id: string, lastAt?: string): string {
  const fmt = (d: Date) =>
    isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
  if (lastAt) {
    const s = fmt(new Date(lastAt))
    if (s) return s
  }
  const m = id.match(/^campaign-(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const s = fmt(new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`))
    if (s) return s
  }
  return id
}

function StatusBadge({ status }: { status: EmailRow['status'] }) {
  const map = {
    SENT: {
      cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      icon: <CheckCircle className="w-3.5 h-3.5 mr-1" />,
      label: 'Sent',
    },
    FAILED: {
      cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      icon: <XCircle className="w-3.5 h-3.5 mr-1" />,
      label: 'Failed',
    },
    QUEUED: {
      cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      icon: <Clock className="w-3.5 h-3.5 mr-1" />,
      label: 'Queued',
    },
  } as const
  const s = map[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}
    >
      {s.icon}
      {s.label}
    </span>
  )
}

// Tiny inline spinner shown next to the Prev/Next buttons while the table
// (or stats) request is in flight — the rows stay on screen during
// refetch, this is the "it is loading" cue.
function FetchSpinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-lime-500"
    />
  )
}

// ==================== STAT CARDS (admin-users ERP style) ====================
// Same compact card anatomy as the admin-users page: icon chip + uppercase
// title + big animated total on ONE row, per-status chips underneath. The
// section is ALWAYS mounted — while stats load or refetch the numbers show
// "…"/"–" dots instead of the cards disappearing.

// requestAnimationFrame count-up, ease-out cubic, reduced-motion aware
// (same behavior as the admin-users AnimatedNumber).
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = value
    if (from === to) return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(to)
      return
    }
    const duration = 600
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [value])

  return <span className={cn('tabular-nums', className)}>{display}</span>
}

// Chip palette mirrors the status badges (sent=emerald, failed=rose,
// queued=amber) using the admin-users chip colors.
const STATUS_CHIP_STYLES = {
  SENT: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  FAILED: {
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  QUEUED: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
} as const

type MiniStatChip = {
  key: string
  label: string
  count: number
  active: boolean
  onClick: () => void
  color: string
  bgColor: string
  borderColor: string
}

function MiniStatCard({
  icon,
  accent,
  title,
  total,
  loading,
  active,
  onHeaderClick,
  chips,
}: {
  icon: ReactNode
  accent: string
  title: string
  total: number
  loading: boolean
  active: boolean
  onHeaderClick: () => void
  chips: MiniStatChip[]
}) {
  return (
    <Card
      className={cn(
        'flex flex-col rounded-2xl p-2 transition-all duration-200',
        active
          ? 'border-primary/40 shadow-md ring-2 ring-primary/30'
          : 'border-slate-200 hover:shadow-sm dark:border-slate-800'
      )}
    >
      <button
        type="button"
        onClick={onHeaderClick}
        title={active ? 'Click to clear this filter' : `Filter table to ${title.toLowerCase()}`}
        aria-pressed={active}
        className={cn(
          'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors duration-200',
          active
            ? 'bg-slate-100 dark:bg-slate-800/60'
            : 'hover:bg-slate-50 dark:hover:bg-slate-900'
        )}
      >
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
            accent
          )}
        >
          {icon}
        </div>
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase leading-tight tracking-widest text-slate-400">
          {title}
        </span>
        <span className="text-xl font-black leading-none text-slate-900 dark:text-white">
          {loading ? '…' : <AnimatedNumber value={total} />}
        </span>
        <span
          aria-hidden
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full transition-opacity duration-200',
            active ? 'bg-primary opacity-100' : 'opacity-0'
          )}
        />
      </button>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-100 px-1 pt-1 dark:border-slate-800">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onClick}
            title={chip.active ? 'Click to clear filter' : `Filter to ${chip.label.toLowerCase()}`}
            aria-pressed={chip.active}
            className={cn(
              'inline-flex cursor-pointer select-none items-baseline gap-1 rounded px-1 py-0.5 transition-colors duration-200',
              chip.active
                ? `${chip.bgColor} ${chip.borderColor} border ring-1 ring-primary/40`
                : 'hover:bg-slate-50 dark:hover:bg-slate-900'
            )}
          >
            <span className={cn('text-xs font-bold leading-none', chip.color)}>
              {loading ? '–' : <AnimatedNumber value={chip.count} />}
            </span>
            <span className="whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-wider text-slate-400">
              {chip.label}
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

// Sum the byTemplate entries whose templateCode CONTAINS the group needle —
// the same match the backend's templateCode contains-filter applies, so a
// card's total always equals what clicking it shows in the table.
function groupStat(
  byTemplate: TemplateStat[] | undefined,
  needle: string
): { total: number; sent: number; failed: number; queued: number } {
  const acc = { total: 0, sent: 0, failed: 0, queued: 0 }
  for (const t of byTemplate ?? []) {
    if (!t.templateCode.includes(needle)) continue
    acc.total += t.total
    acc.sent += t.sent
    acc.failed += t.failed
    acc.queued += t.queued
  }
  return acc
}

export default function AdminEmailsPage() {
  const [status, setStatus] = useState<string>('ALL')
  const [audience, setAudience] = useState<string>('all')
  const [days, setDays] = useState<string>('7')
  const [search, setSearch] = useState('')
  const [template, setTemplate] = useState('')
  const [campaign, setCampaign] = useState<string>('all')
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [selected, setSelected] = useState<EmailRow | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null)
  const [exportError, setExportError] = useState('')

  const debouncedSearch = useDebouncedValue(search, 400)

  // A campaign is its own time scope (it ran on one day) — when one is
  // selected the window param is dropped for BOTH the table and the stats,
  // so last month's campaign is fully browsable and the cards count that
  // campaign only (table total == "All emails" card).
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (campaign === 'all') params.set('days', days)
    if (status !== 'ALL') params.set('status', status)
    if (audience === 'drivers') params.set('audience', 'drivers')
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
    if (template.trim()) params.set('templateCode', template.trim())
    if (campaign !== 'all') params.set('campaign', campaign)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return params.toString()
  }, [days, status, audience, debouncedSearch, template, campaign, page])

  // Stats follow the same scope as the table: window + audience + recipient
  // search when no campaign is picked, campaign-only when one is — the
  // cards always agree with the table total.
  const statsParams = useMemo(() => {
    const params = new URLSearchParams()
    if (campaign === 'all') params.set('days', days)
    if (audience === 'drivers') params.set('audience', 'drivers')
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
    if (campaign !== 'all') params.set('campaign', campaign)
    return params.toString()
  }, [days, audience, debouncedSearch, campaign])

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['adminEmailsStats', statsParams],
    queryFn: () =>
      authFetch<EmailsStatsResponse>(
        `${import.meta.env.VITE_API_URL}/api/adminEmails/stats?${statsParams}`
      ),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  })

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['adminEmails', queryParams],
    queryFn: () =>
      authFetch<EmailsListResponse>(
        `${import.meta.env.VITE_API_URL}/api/adminEmails?${queryParams}`
      ),
    staleTime: 30000,
    // Keep the previous page's rows while the next page loads — pagination
    // must never blank out or drop the filter bar.
    placeholderData: keepPreviousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const failedCount = useMemo(
    () => items.filter((row) => row.status === 'FAILED').length,
    [items]
  )

  // Template dropdown options: the codes actually active in the current
  // scope (window or selected campaign), busiest first. "(no template)" is
  // a stats-side label for null codes and can't be filtered on.
  const codeOptions = useMemo(
    () =>
      (statsData?.byTemplate ?? [])
        .filter((t) => t.templateCode !== '(no template)')
        .map((t) => ({
          code: t.templateCode,
          label: `${TEMPLATE_LABELS[t.templateCode] ?? t.templateCode} · ${t.total}`,
        })),
    [statsData]
  )

  // Export uses the EXACT filter set the table is showing (same scope rules,
  // campaign beats window) minus pagination — the backend exports every
  // matching row, not just the current page.
  const exportParams = useMemo(() => {
    const params = new URLSearchParams(queryParams)
    params.delete('page')
    params.delete('pageSize')
    return params.toString()
  }, [queryParams])

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(format)
    setExportError('')
    try {
      const res = await authFetchRaw(
        `${import.meta.env.VITE_API_URL}/api/adminEmails/export?format=${format}&${exportParams}`
      )
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const dispo = res.headers.get('Content-Disposition') ?? ''
      const match = dispo.match(/filename="?([^";]+)"?/)
      const filename = match
        ? match[1]
        : `email-log.${format === 'xlsx' ? 'xlsx' : 'csv'}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  const resetFilters = () => {
    setStatus('ALL')
    setAudience('all')
    setDays('7')
    setSearch('')
    setTemplate('')
    setCampaign('all')
    setPage(1)
  }

  const activeFilterCount = [
    status !== 'ALL',
    audience !== 'all',
    days !== '7',
    search.trim() !== '',
    template.trim() !== '',
    campaign !== 'all',
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Mail className="w-7 h-7 text-lime-500" />
              Email &amp; Support Log
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Every email the system sent — invites, approvals, meeting
              requests, support tickets — exactly as recorded in the
              notification ledger. Failed sends are highlighted; URLs outside
              101drivers.com are flagged.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {failedCount > 0 && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-100">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                {failedCount} failed on this page
              </Badge>
            )}
            {exportError && (
              <span className="text-xs text-red-600 dark:text-red-400 max-w-[220px] truncate" title={exportError}>
                {exportError}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
              className="rounded-xl"
              title="Download EVERY email matching the current filters (not just this page) as CSV"
            >
              {exporting === 'csv' ? (
                <FetchSpinner />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('xlsx')}
              disabled={exporting !== null}
              className="rounded-xl"
              title="Download EVERY email matching the current filters (not just this page) as Excel"
            >
              {exporting === 'xlsx' ? (
                <FetchSpinner />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-xl"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stat cards — admin-users ERP style, one row of five. ALWAYS
            mounted: while stats load or refetch the totals show "…" and the
            chips show "–" instead of the cards disappearing. The big total
            filters the table to the card's template group (same contains-
            match the backend applies); the Sent/Failed/Queued chips stack a
            status filter on top; clicking an active card or chip clears. */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(
            [
              {
                key: 'all',
                title: 'All emails',
                icon: <Mail className="h-3.5 w-3.5" />,
                accent:
                  'bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800 text-lime-600 dark:text-lime-400',
                needle: '',
              },
              {
                key: 'invites',
                title: 'Invites',
                icon: <UserPlus className="h-3.5 w-3.5" />,
                accent:
                  'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400',
                needle: 'driver-invited',
              },
              {
                key: 'approvals',
                title: 'Approvals',
                icon: <BadgeCheck className="h-3.5 w-3.5" />,
                accent:
                  'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
                needle: 'approved',
              },
              {
                key: 'meetings',
                title: 'Meeting requests',
                icon: <CalendarClock className="h-3.5 w-3.5" />,
                accent:
                  'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400',
                needle: 'driver-meeting-request',
              },
              {
                key: 'support',
                title: 'Support',
                icon: <LifeBuoy className="h-3.5 w-3.5" />,
                accent:
                  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
                needle: 'support',
              },
            ] as const
          ).map((group) => {
            const stat =
              group.needle === ''
                ? {
                    total: statsData?.totals.all ?? 0,
                    sent: statsData?.totals.sent ?? 0,
                    failed: statsData?.totals.failed ?? 0,
                    queued: statsData?.totals.queued ?? 0,
                  }
                : groupStat(statsData?.byTemplate, group.needle)
            const templateActive = template === group.needle
            return (
              <MiniStatCard
                key={group.key}
                icon={group.icon}
                accent={group.accent}
                title={group.title}
                total={stat.total}
                loading={statsLoading}
                active={templateActive && status === 'ALL'}
                onHeaderClick={() => {
                  if (templateActive && status === 'ALL') {
                    setTemplate('')
                    setStatus('ALL')
                  } else {
                    setTemplate(group.needle)
                    setStatus('ALL')
                  }
                  setPage(1)
                }}
                chips={(['SENT', 'FAILED', 'QUEUED'] as const).map((s) => ({
                  key: s,
                  label: s === 'SENT' ? 'Sent' : s === 'FAILED' ? 'Failed' : 'Queued',
                  count: stat[s.toLowerCase() as 'sent' | 'failed' | 'queued'],
                  active: templateActive && status === s,
                  onClick: () => {
                    if (templateActive && status === s) {
                      setTemplate('')
                      setStatus('ALL')
                    } else {
                      setTemplate(group.needle)
                      setStatus(s)
                    }
                    setPage(1)
                  },
                  color: STATUS_CHIP_STYLES[s].color,
                  bgColor: STATUS_CHIP_STYLES[s].bgColor,
                  borderColor: STATUS_CHIP_STYLES[s].borderColor,
                }))}
              />
            )
          })}
        </section>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center justify-between">
              Filters
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-slate-500"
                >
                  Clear ({activeFilterCount})
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="QUEUED">Queued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Recipients</Label>
              <Select
                value={audience}
                onValueChange={(v) => {
                  setAudience(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="drivers">Drivers only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">
                Window{campaign !== 'all' && ' (campaign overrides)'}
              </Label>
              <Select
                value={days}
                disabled={campaign !== 'all'}
                onValueChange={(v) => {
                  setDays(v)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="mt-1"
                  title={
                    campaign !== 'all'
                      ? 'A campaign is its own time window — clear the campaign filter to use the window'
                      : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Recipient email</Label>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="driver@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Template</Label>
              <Select
                value={template === '' ? '__all__' : template}
                onValueChange={(v) => {
                  setTemplate(v === '__all__' ? '' : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All templates</SelectItem>
                  {template !== '' &&
                    !codeOptions.some((o) => o.code === template) && (
                      <SelectItem value={template}>
                        {`Filter: ${template}`}
                      </SelectItem>
                    )}
                  {codeOptions.map((o) => (
                    <SelectItem key={o.code} value={o.code} title={o.code}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Campaign</Label>
              <Select
                value={campaign}
                onValueChange={(v) => {
                  setCampaign(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All campaigns</SelectItem>
                  {(statsData?.campaigns ?? []).map((c) => (
                    <SelectItem key={c.campaign} value={c.campaign} title={c.campaign}>
                      {`${campaignLabel(c.campaign, c.lastAt)} · ${c.sent} sent`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isError && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3">
            <p className="text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Failed to load emails
              {campaign !== 'all' ? ' for this campaign' : ''}. Filters are
              kept — try again.
            </p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {/* Top toolbar — pagination + the loading cue the user asked
                for: a spinner right where the Prev/Next buttons are, shown
                on BOTH bars while a table/stats request is in flight. */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {total > 0
                  ? `Page ${page} of ${totalPages} · ${total} email${total === 1 ? '' : 's'}${campaign !== 'all' ? ' in campaign' : ''}`
                  : 'No emails in the current scope'}
                {isFetching && ' · updating…'}
              </p>
              <div className="flex items-center gap-2">
                {isFetching && <FetchSpinner />}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-500 mx-auto" />
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  Loading emails...
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center">
                <Mail className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  No emails in this window. Widen the window or clear filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3 font-medium">Sent</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Template</th>
                      <th className="px-4 py-3 font-medium">Recipient</th>
                      <th className="px-4 py-3 font-medium">Subject</th>
                      <th className="px-4 py-3 font-medium">Links</th>
                      <th className="px-4 py-3 font-medium text-right">Body</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const hosts = rowHosts(row)
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-slate-100 dark:border-slate-800 ${
                            row.status === 'FAILED'
                              ? 'bg-red-50/60 dark:bg-red-950/20'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {fmtDate(row.sentAt ?? row.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {row.templateCode ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {row.toEmail ?? '—'}
                          </td>
                          <td className="px-4 py-3 max-w-[240px] truncate text-slate-700 dark:text-slate-300">
                            {row.subject ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            {hosts.length === 0 ? (
                              <span className="text-slate-400 dark:text-slate-500 text-xs">
                                no links
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {hosts.map((host) => (
                                  <Badge
                                    key={host}
                                    variant="outline"
                                    className={
                                      isCompliantHost(host)
                                        ? 'text-slate-600 dark:text-slate-300'
                                        : 'border-red-300 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700'
                                    }
                                  >
                                    {!isCompliantHost(host) && (
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                    )}
                                    {host}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(row)}
                              className="text-lime-600 hover:text-lime-700 dark:text-lime-400"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {total > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Page {page} of {totalPages} · {total} email
                  {total === 1 ? '' : 's'}
                </p>
                <div className="flex items-center gap-2">
                  {isFetching && <FetchSpinner />}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="rounded-2xl w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold pr-10 break-words">
                  {selected.subject ?? '(no subject)'}
                </DialogTitle>
                <DialogDescription className="text-sm break-all pr-10">
                  To {selected.toEmail ?? '—'} · {selected.templateCode ?? 'no template'} ·{' '}
                  <StatusBadge status={selected.status} />
                </DialogDescription>
              </DialogHeader>
              {selected.errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-300">
                  <p className="font-medium">Send error</p>
                  <p className="mt-1 break-words">{selected.errorMessage}</p>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 overflow-hidden">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                  Links in this email
                </p>
                {rowUrls(selected).length === 0 ? (
                  <p className="text-sm text-slate-400">No links in the body.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {rowUrls(selected).map((url) => {
                      const host = hostOf(url)
                      const ok = host ? isCompliantHost(host) : false
                      return (
                        <li key={url} className="flex items-start gap-2 text-sm min-w-0">
                          {ok ? (
                            <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                          )}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 break-all text-lime-600 hover:text-lime-700 dark:text-lime-400 underline underline-offset-2"
                          >
                            {url}
                          </a>
                          <ExternalLink className="w-3.5 h-3.5 mt-1 text-slate-400 shrink-0" />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              {rowImages(selected).length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 overflow-hidden">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                    Images in this email
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {rowImages(selected).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block min-w-0"
                        title={url}
                      >
                        <img
                          src={url}
                          alt="Attachment image from this email"
                          loading="lazy"
                          className="w-full h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700 group-hover:border-lime-400 transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 overflow-hidden">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                  Full body
                </p>
                <pre className="whitespace-pre-wrap break-all text-sm text-slate-700 dark:text-slate-300 font-sans">
                  {selected.body ?? '(no body recorded)'}
                </pre>
              </div>
              <p className="text-xs text-slate-400">
                Created {fmtDate(selected.createdAt)}
                {selected.sentAt ? ` · sent ${fmtDate(selected.sentAt)}` : ''}
                {selected.failedAt ? ` · failed ${fmtDate(selected.failedAt)}` : ''}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
