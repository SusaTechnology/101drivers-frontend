// components/dashboard/FinanceSummary.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  DollarSign,
  CreditCard,
  FileText,
  ArrowRight,
  TrendingUp,
  Wallet,
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
import type { Finance as FinanceType } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface FinanceSummaryProps {
  data: FinanceType | undefined;
  isLoading: boolean;
}

interface FinanceMetricProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: 'primary' | 'green' | 'blue' | 'amber';
}

function FinanceMetric({ label, value, icon: Icon, color = 'primary' }: FinanceMetricProps) {
  const colorClasses = {
    primary: 'bg-primary/15 text-primary',
    green: 'bg-green-500/15 text-green-500',
    blue: 'bg-blue-500/15 text-blue-500',
    amber: 'bg-amber-500/15 text-amber-500',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colorClasses[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="text-lg font-black text-slate-900 dark:text-white">
          {typeof value === 'number' && label.toLowerCase().includes('revenue') || label.toLowerCase().includes('amount') || label.toLowerCase().includes('receivable')
            ? `$${value.toLocaleString()}`
            : value}
        </p>
      </div>
    </div>
  );
}

function FinanceSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div>
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FinanceSummary({ data, isLoading }: FinanceSummaryProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Finance overview</CardTitle>
            <CardDescription className="text-sm mt-1">
              Payments, payouts, and revenue metrics.
            </CardDescription>
          </div>
          <Link
            to="/admin-payments"
            className="inline-flex items-center gap-2 text-sm font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2 rounded-2xl hover:opacity-90 transition"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        {isLoading ? (
          <FinanceSummarySkeleton />
        ) : data ? (
          <div className="space-y-4">
            {/* Revenue Section */}
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Revenue
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FinanceMetric
                  label="Gross Revenue"
                  value={data.grossRevenue}
                  icon={DollarSign}
                  color="green"
                />
                <FinanceMetric
                  label="Captured"
                  value={data.capturedRevenue}
                  icon={CreditCard}
                  color="green"
                />
                <FinanceMetric
                  label="Postpaid Receivable"
                  value={data.postpaidReceivable}
                  icon={FileText}
                  color="amber"
                />
                <FinanceMetric
                  label="Paid Out"
                  value={data.paidOutAmount}
                  icon={Wallet}
                  color="blue"
                />
              </div>
            </div>

            {/* Counts Section */}
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" />
                Transaction Counts
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Authorized payments
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.authorizedPaymentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Captured payments
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.capturedPaymentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Eligible payouts
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.eligiblePayoutCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
