// components/dashboard/FinanceSnapshot.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CreditCard,
  Wallet,
  Receipt,
  Shield,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDashboardCurrency } from '@/hooks/useAdminDashboard';
import type { Finance, FinancialSnapshot } from '@/types/dashboard';

interface FinanceSnapshotProps {
  finance: Finance | undefined;
  financialSnapshot: FinancialSnapshot | undefined;
  isLoading: boolean;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color: 'green' | 'blue' | 'amber' | 'purple' | 'red';
}

function MetricCard({ icon: Icon, label, value, subValue, color }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-lg font-black text-slate-900 dark:text-white truncate">
          {value}
        </p>
        {subValue && (
          <p className="text-xs text-slate-500">{subValue}</p>
        )}
      </div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="h-3 w-16 mb-1" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
}

export function FinanceSnapshot({ finance, financialSnapshot, isLoading }: FinanceSnapshotProps) {
  // Use financialSnapshot for cleaner summary if available, else fall back to finance
  const displayData = financialSnapshot || finance;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-green-500/15 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black">Finance Overview</CardTitle>
              <CardDescription className="text-sm mt-1">
                Revenue, payments, and payouts
              </CardDescription>
            </div>
          </div>
          <Link to="/admin-payments">
            <Badge variant="outline" className="chip cursor-pointer hover:bg-primary/10">
              View All
              <ArrowRight className="w-3 h-3 ml-1" />
            </Badge>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <MetricSkeleton key={i} />
            ))}
          </div>
        ) : displayData ? (
          <>
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              <div className="col-span-2 lg:col-span-1">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                      Gross Revenue
                    </span>
                  </div>
                  <p className="text-3xl font-black">
                    {formatDashboardCurrency(displayData.grossRevenue)}
                  </p>
                  <p className="text-xs opacity-80 mt-1">
                    Total revenue for period
                  </p>
                </div>
              </div>

              <MetricCard
                icon={DollarSign}
                label="Captured"
                value={formatDashboardCurrency(displayData.capturedRevenue)}
                subValue={`${finance?.capturedPaymentsCount ?? 0} payments`}
                color="green"
              />

              <MetricCard
                icon={Receipt}
                label="Postpaid Receivable"
                value={formatDashboardCurrency(displayData.postpaidReceivable)}
                subValue={`${finance?.invoicedPostpaidCount ?? 0} invoices`}
                color="blue"
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                icon={Wallet}
                label="Paid Out"
                value={formatDashboardCurrency(displayData.paidOutAmount)}
                subValue={`${finance?.paidPayoutCount ?? 0} payouts`}
                color="purple"
              />

              <MetricCard
                icon={CreditCard}
                label="Pending Payout"
                value={formatDashboardCurrency(displayData.pendingPayoutAmount ?? 0)}
                subValue={`${finance?.eligiblePayoutCount ?? 0} eligible`}
                color="amber"
              />

              <MetricCard
                icon={Shield}
                label="Insurance Fees"
                value={formatDashboardCurrency(financialSnapshot?.insuranceFeesEstimated ?? 0)}
                subValue="Estimated"
                color="blue"
              />

              <MetricCard
                icon={TrendingDown}
                label="Failed Payments"
                value={finance?.failedPaymentsCount ?? 0}
                subValue="Needs review"
                color={finance?.failedPaymentsCount ? 'red' : 'green'}
              />
            </div>

            {/* Payment Counts Row */}
            {finance && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Badge variant="outline" className="text-[10px]">
                  {finance.authorizedPaymentsCount} authorized
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {finance.capturedPaymentsCount} captured
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {finance.paidPostpaidCount} postpaid paid
                </Badge>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-slate-500">No finance data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
