// components/pages/admin-payout-detail.tsx
//
// Full-detail view for a single driver payout, reached from the payouts
// report table via the "View" button (/admin-payout-detail?payoutId=...).
//
// Surfaces:
//   - Payout core: gross/net amounts, driver share, insurance + platform
//     fees, status, created/paid timestamps
//   - Driver: name + email
//   - Delivery: addresses, service type, current status (linked)
//   - Payout batches the payout was settled through (type, status, Stripe
//     transfer id, failure reason)
//
// Backend: GET /api/driverPayouts/admin/payouts/:id
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
import { usePayoutDetail, formatReportCurrency, formatReportDateTime } from '@/hooks/useAdminReports';
import {
  AlertCircle,
  ArrowLeft,
  Wallet,
  User,
  Truck,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  ELIGIBLE: 'bg-blue-50 text-blue-700 border-blue-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
  LOCK_IN_FEE: 'bg-purple-50 text-purple-700 border-purple-200',
};

const BATCH_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function AdminPayoutDetailPage({ payoutId }: { payoutId: string }) {
  const { actionItems, signOut } = useAdminActions();
  const { data, isLoading, isError, refetch } = usePayoutDetail(payoutId || null);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />

      <main className="max-w-[1100px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Link to="/admin-report-payouts" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Payouts Report
              </Link>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black">Payout Detail</h1>
            {data?.payout && (
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm font-mono">{data.payout.id}</p>
            )}
          </div>
        </section>

        {!payoutId ? (
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="font-bold">No payout selected</p>
              <p className="text-sm text-slate-500 mt-1">Open this page from the payouts report "View" button.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
          </div>
        ) : isError || !data ? (
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="text-rose-700 dark:text-rose-300 font-bold">Failed to load payout</p>
              <button onClick={() => refetch()} className="mt-4 px-4 py-2 text-sm border rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Payout core */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-black">Payout</CardTitle>
                  </div>
                  <Badge className={cn('text-[10px] font-bold border', PAYOUT_STATUS_COLORS[data.payout.status] || 'bg-slate-50 text-slate-600 border-slate-200')}>
                    {data.payout.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gross</div>
                  <div className="text-sm font-bold mt-1">{formatReportCurrency(data.payout.grossAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Driver share</div>
                  <div className="text-sm font-bold mt-1">{(data.payout.driverSharePct * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Insurance fee</div>
                  <div className="text-sm font-bold mt-1">{formatReportCurrency(data.payout.insuranceFee)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Platform fee</div>
                  <div className="text-sm font-bold mt-1">{formatReportCurrency(data.payout.platformFee)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Net amount</div>
                  <div className="text-lg font-black text-emerald-600 mt-1">{formatReportCurrency(data.payout.netAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</div>
                  <div className="text-sm font-bold mt-1">{formatReportDateTime(data.payout.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paid at</div>
                  <div className="text-sm font-bold mt-1">{formatReportDateTime(data.payout.paidAt)}</div>
                </div>
              </CardContent>
            </Card>

            {/* Driver */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-black">Driver</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</div>
                  <div className="text-sm font-bold mt-1">{data.driver.name || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</div>
                  <div className="text-sm font-bold mt-1 break-all">{data.driver.email || '—'}</div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery */}
            {data.delivery && (
              <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-black">Delivery</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Delivery</div>
                    <Link
                      to="/admin-delivery-detail"
                      search={{ deliveryId: data.delivery.id }}
                      className="text-sm font-black text-primary hover:underline mt-1 inline-block"
                    >
                      {data.delivery.id}
                    </Link>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</div>
                    <div className="text-sm font-bold mt-1">{data.delivery.status}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pickup</div>
                    <div className="text-sm mt-1">{data.delivery.pickupAddress || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dropoff</div>
                    <div className="text-sm mt-1">{data.delivery.dropoffAddress || '—'}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payout batches this payout settled through */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base font-black">Settlement Batches</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.batches.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500 text-center">
                    Not yet settled into a payout batch — waiting for the weekly sweep.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Type</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Status</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Amount</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Stripe transfer</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">Initiated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.batches.map((b) => (
                          <tr key={b.batchId} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-3 text-xs font-bold">{b.type}</td>
                            <td className="px-4 py-3">
                              <Badge className={cn('text-[10px] font-bold border', BATCH_STATUS_COLORS[b.status] || 'bg-slate-50 text-slate-600 border-slate-200')}>
                                {b.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm font-bold">{formatReportCurrency(b.amount)}</td>
                            <td className="px-4 py-3 text-xs font-mono">{b.stripeTransferId || '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{formatReportDateTime(b.initiatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {data.batches.some((b) => b.failureReason) && (
                  <div className="px-4 pb-4 space-y-2">
                    {data.batches.filter((b) => b.failureReason).map((b) => (
                      <div key={b.batchId} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/40">
                        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                            Batch {b.batchId} failed ({b.type})
                          </p>
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{b.failureReason}</p>
                        </div>
                      </div>
                    ))}
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
