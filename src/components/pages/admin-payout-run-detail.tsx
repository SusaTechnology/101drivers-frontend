// components/pages/admin-payout-run-detail.tsx
//
// Per-driver results of one weekly payout sweep run, reached from the
// payouts report "Weekly Transfer Runs" table via the "View" button
// (/admin-payout-run-detail?runId=...).
//
// Surfaces:
//   - Run summary: trigger (scheduled/manual), status, started/finished,
//     counts (candidates, processed, succeeded, failed, skipped)
//   - Per-driver results: driver name/email, amount, final batch status,
//     Stripe transfer id, and the failure reason for any transfer that
//     did not go through
//
// Backend: GET /api/driverPayouts/admin/payout-runs/:id
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Navbar } from '../shared/layout/testNavbar';
import { navItems } from '@/lib/items/navItems';
import { Brand } from '@/lib/items/brand';
import { useAdminActions } from '@/hooks/useAdminActions';
import { usePayoutRunDetail, formatReportCurrency, formatReportDateTime } from '@/hooks/useAdminReports';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  XCircle,
  SkipForward,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RESULT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function AdminPayoutRunDetailPage({ runId }: { runId: string }) {
  const { actionItems, signOut } = useAdminActions();
  const { data, isLoading, isError, refetch } = usePayoutRunDetail(runId || null);

  const run = data?.run;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />

      <main className="max-w-[1300px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Link to="/admin-report-payouts" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Payouts Report
              </Link>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Weekly Transfer Run</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              Per-driver results for the sweep started {run ? formatReportDateTime(run.startedAt) : '—'}.
            </p>
          </div>
        </section>

        {!runId ? (
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="font-bold">No run selected</p>
              <p className="text-sm text-slate-500 mt-1">Open this page from the Weekly Transfer Runs "View" button.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
        ) : isError || !data || !run ? (
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load run</p>
              <button onClick={() => refetch()} className="mt-4 px-4 py-2 text-sm border rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Run summary */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trigger</div>
                <div className="text-sm font-black mt-1">{run.trigger === 'MANUAL' ? 'Manual' : 'Scheduled'}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {run.status === 'RUNNING' ? 'In progress' : 'Completed'}
                </div>
              </Card>
              <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Candidates</div>
                <div className="text-xl font-black mt-1">{run.candidateCount}</div>
              </Card>
              <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Succeeded
                </div>
                <div className="text-xl font-black mt-1 text-emerald-600">{run.succeededCount}</div>
              </Card>
              <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-900/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Failed
                </div>
                <div className="text-xl font-black mt-1 text-rose-600">{run.failedCount}</div>
              </Card>
              <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <SkipForward className="w-3 h-3" /> Skipped
                </div>
                <div className="text-xl font-black mt-1">{run.skippedCount}</div>
              </Card>
              <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finished</div>
                <div className="text-xs font-bold mt-1">{formatReportDateTime(run.finishedAt)}</div>
              </Card>
            </section>

            {/* Per-driver results */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-black">Driver Transfer Results</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.results.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500 text-center">
                    No driver transfers were created in this run — every candidate was skipped (below the minimum, no Stripe Connect setup, or an in-flight batch).
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Driver</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Amount</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Status</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Reason</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Stripe transfer</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.results.map((r) => (
                          <tr key={r.batchId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-bold">{r.driverName || 'Unknown driver'}</div>
                              <div className="text-xs text-slate-500">{r.driverEmail || '—'}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-black">{formatReportCurrency(r.amount)}</td>
                            <td className="px-4 py-3">
                              <Badge className={cn('text-[10px] font-bold border', RESULT_STATUS_COLORS[r.status] || 'bg-slate-50 text-slate-600 border-slate-200')}>
                                {r.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 max-w-[280px]">
                              {r.failureReason ? (
                                <div className="flex items-start gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-xs text-rose-600 dark:text-rose-400">{r.failureReason}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs font-mono">{r.stripeTransferId || '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{formatReportDateTime(r.completedAt || r.failedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
