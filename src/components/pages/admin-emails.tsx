import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/lib/tanstack/dataQuery'
import { useDebouncedValue } from '@/hooks/useDebounce'
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

// Same allow-list as backend/scripts/audit-email-urls.ts — anything else in
// an email body is exactly the kind of wrong-domain link (techbee.et) this
// page exists to catch.
const ALLOWED_HOSTS = new Set(['101drivers.com', 'www.101drivers.com'])

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

export default function AdminEmailsPage() {
  const [status, setStatus] = useState<string>('ALL')
  const [audience, setAudience] = useState<string>('all')
  const [days, setDays] = useState<string>('7')
  const [search, setSearch] = useState('')
  const [template, setTemplate] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [selected, setSelected] = useState<EmailRow | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const debouncedTemplate = useDebouncedValue(template, 400)

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('days', days)
    if (status !== 'ALL') params.set('status', status)
    if (audience === 'drivers') params.set('audience', 'drivers')
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
    if (debouncedTemplate.trim()) params.set('templateCode', debouncedTemplate.trim())
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return params.toString()
  }, [days, status, audience, debouncedSearch, debouncedTemplate, page])

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
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const flaggedCount = useMemo(
    () =>
      items.filter((row) =>
        rowHosts(row).some((host) => !isCompliantHost(host))
      ).length,
    [items]
  )

  const resetFilters = () => {
    setStatus('ALL')
    setAudience('all')
    setDays('7')
    setSearch('')
    setTemplate('')
    setPage(1)
  }

  const activeFilterCount = [
    status !== 'ALL',
    audience !== 'all',
    days !== '7',
    search.trim() !== '',
    template.trim() !== '',
  ].filter(Boolean).length

  if (isError) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
              <p className="mt-4 text-slate-600 dark:text-slate-400">
                Failed to load sent emails.
              </p>
              <Button
                onClick={() => refetch()}
                className="mt-4 bg-lime-500 text-slate-950 hover:bg-lime-600"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Mail className="w-7 h-7 text-lime-500" />
              Emails Sent
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Every email the system sent, exactly as recorded in the
              notification ledger. URLs outside 101drivers.com are flagged.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {flaggedCount > 0 && (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-100">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {flaggedCount} flagged on this page
              </Badge>
            )}
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
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <Label className="text-xs text-slate-500">Window</Label>
              <Select
                value={days}
                onValueChange={(v) => {
                  setDays(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="mt-1">
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
              <Label className="text-xs text-slate-500">Template contains</Label>
              <Input
                value={template}
                onChange={(e) => {
                  setTemplate(e.target.value)
                  setPage(1)
                }}
                placeholder="driver-invited"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
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
                      const badHosts = hosts.filter((h) => !isCompliantHost(h))
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-slate-100 dark:border-slate-800 ${
                            badHosts.length > 0
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
                <div className="flex gap-2">
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
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold pr-6">
                  {selected.subject ?? '(no subject)'}
                </DialogTitle>
                <DialogDescription className="text-sm">
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
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
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
                        <li key={url} className="flex items-start gap-2 text-sm">
                          {ok ? (
                            <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                          )}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-lime-600 hover:text-lime-700 dark:text-lime-400 underline underline-offset-2"
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
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                  Full body
                </p>
                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">
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
