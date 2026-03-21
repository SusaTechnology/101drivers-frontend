// components/dashboard/ReportsPreview.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Truck,
  DollarSign,
  Shield,
  ArrowRight,
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDashboardPercent, formatDashboardMiles, formatDashboardDate } from '@/hooks/useAdminDashboard';
import type { ReportsPreview as ReportsPreviewType } from '@/types/dashboard';

interface ReportsPreviewProps {
  data: ReportsPreviewType | undefined;
  isLoading: boolean;
}

const REPORT_LINKS = [
  { label: 'Deliveries', to: '/admin-report-deliveries', icon: Truck, color: 'text-blue-500' },
  { label: 'Compliance', to: '/admin-report-compliance', icon: Shield, color: 'text-green-500' },
  { label: 'Disputes', to: '/admin-report-disputes', icon: AlertTriangle, color: 'text-amber-500' },
  { label: 'Payments', to: '/admin-report-payments', icon: DollarSign, color: 'text-purple-500' },
  { label: 'Ops Summary', to: '/admin-report-ops-summary', icon: BarChart3, color: 'text-teal-500' },
  { label: 'Insurance', to: '/admin-insurance-reporting', icon: Shield, color: 'text-indigo-500' },
];

export function ReportsPreview({ data, isLoading }: ReportsPreviewProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-black">Reports Preview</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {data?.from && data?.to
                  ? `${formatDashboardDate(data.from)} - ${formatDashboardDate(data.to)}`
                  : 'Quick metrics and reports'}
              </CardDescription>
            </div>
          </div>
          <Link to="/admin-reports">
            <Badge variant="outline" className="chip cursor-pointer hover:bg-primary/10">
              View All
              <ArrowRight className="w-3 h-3 ml-1" />
            </Badge>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Quick Metrics */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <Truck className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-blue-600">{data.deliveriesToday}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase">Today</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-green-600">{formatDashboardPercent(data.completionRate)}</p>
              <p className="text-[10px] font-bold text-green-600 uppercase">Completion</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-amber-600">{formatDashboardPercent(data.disputeRate)}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase">Dispute Rate</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <BarChart3 className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-purple-600">{formatDashboardMiles(data.avgDrivenMilesCompleted)}</p>
              <p className="text-[10px] font-bold text-purple-600 uppercase">Avg Miles</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Truck className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-2xl font-black text-slate-400">-</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Today</p>
            </div>
          </div>
        )}

        {/* Report Links */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Quick Access
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {REPORT_LINKS.map((link) => (
              <Link key={link.to} to={link.to}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-10 justify-start rounded-xl hover:bg-primary/5"
                >
                  <link.icon className={cn('w-4 h-4 mr-2', link.color)} />
                  <span className="text-xs font-bold">{link.label}</span>
                  <ArrowRight className="w-3 h-3 ml-auto text-slate-400" />
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
