// components/dashboard/OperationsHealth.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  Truck,
  FileWarning,
  Clock,
  AlertCircle,
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
import { cn } from '@/lib/utils';
import type { Operations } from '@/types/dashboard';

interface OperationsHealthProps {
  data: Operations | undefined;
  isLoading: boolean;
}

const METRICS = [
  {
    key: 'listedWithoutAssignment',
    label: 'Listed w/o Assignment',
    description: 'Listed jobs without a driver',
    icon: Truck,
    color: 'amber',
  },
  {
    key: 'bookedWithoutComplianceReady',
    label: 'Booked Not Ready',
    description: 'Booked but compliance not ready',
    icon: FileWarning,
    color: 'amber',
  },
  {
    key: 'activeWithoutTracking',
    label: 'Active w/o Tracking',
    description: 'Active trips with no tracking',
    icon: Activity,
    color: 'red',
  },
  {
    key: 'deliveriesMissingCompliance',
    label: 'Missing Compliance',
    description: 'Missing VIN or proof',
    icon: AlertTriangle,
    color: 'red',
  },
  {
    key: 'staleQuotedDeliveries',
    label: 'Stale Quoted',
    description: 'Quotes pending too long',
    icon: Clock,
    color: 'amber',
  },
  {
    key: 'staleBookedDeliveries',
    label: 'Stale Booked',
    description: 'Bookings pending too long',
    icon: Clock,
    color: 'amber',
  },
] as const;

function HealthMetric({
  label,
  description,
  count,
  icon: Icon,
  color,
  filterKey,
}: {
  label: string;
  description: string;
  count: number;
  icon: React.ElementType;
  color: 'red' | 'amber' | 'green';
  filterKey: string;
}) {
  const bgColors = {
    red: 'bg-red-50 dark:bg-red-900/10',
    amber: 'bg-amber-50 dark:bg-amber-900/10',
    green: 'bg-green-50 dark:bg-green-900/10',
  };

  const borderColors = {
    red: 'border-red-200 dark:border-red-900/30',
    amber: 'border-amber-200 dark:border-amber-900/30',
    green: 'border-green-200 dark:border-green-900/30',
  };

  const gradientColors = {
    red: 'bg-gradient-to-br from-red-400 to-rose-600',
    amber: 'bg-gradient-to-br from-amber-400 to-orange-600',
    green: 'bg-gradient-to-br from-green-400 to-emerald-600',
  };

  return (
    <Link
      to="/admin-deliveries"
      search={{ [filterKey]: true }}
      className="block"
    >
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer hover:opacity-80',
          bgColors[color],
          borderColors[color]
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shadow-sm',
            gradientColors[color]
          )}
        >
          <Icon className="w-4 h-4 text-white drop-shadow-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {label}
            </p>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] font-bold px-1.5 py-0',
                count > 0
                  ? color === 'red'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-green-100 text-green-700 border-green-200'
              )}
            >
              {count}
            </Badge>
          </div>
          <p className="text-[10px] text-slate-500 truncate">{description}</p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </div>
    </Link>
  );
}

function MetricSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="h-3 w-28 mb-0.5" />
        <Skeleton className="h-2.5 w-40" />
      </div>
    </div>
  );
}

export function OperationsHealth({ data, isLoading }: OperationsHealthProps) {
  const totalIssues = data
    ? Object.values(data).reduce((sum, val) => sum + (val || 0), 0)
    : 0;

  const getStatusColor = (count: number): 'red' | 'amber' | 'green' => {
    if (count === 0) return 'green';
    return count > 5 ? 'red' : 'amber';
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-md">
      <CardHeader className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-sm">
            <Activity className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <CardTitle className="text-sm font-black">Operations Health</CardTitle>
            <CardDescription className="text-[10px] mt-0.5">
              {totalIssues > 0
                ? `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} detected`
                : 'All systems healthy'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <MetricSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-2">
            {METRICS.map((metric) => {
              const count = data[metric.key as keyof Operations] || 0;
              return (
                <HealthMetric
                  key={metric.key}
                  label={metric.label}
                  description={metric.description}
                  count={count}
                  icon={metric.icon}
                  color={getStatusColor(count)}
                  filterKey={metric.key}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-6 h-6 text-slate-300 mb-1" />
            <p className="text-xs text-slate-500">No operations data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
