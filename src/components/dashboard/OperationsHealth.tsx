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

  const iconColors = {
    red: 'text-red-500',
    amber: 'text-amber-500',
    green: 'text-green-500',
  };

  return (
    <Link
      to="/admin-deliveries"
      search={{ [filterKey]: true }}
      className="block"
    >
      <div
        className={cn(
          'flex items-center gap-4 p-4 rounded-2xl border transition-colors cursor-pointer hover:opacity-80',
          bgColors[color],
          borderColors[color]
        )}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            bgColors[color]
          )}
        >
          <Icon className={cn('w-5 h-5', iconColors[color])} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {label}
            </p>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-bold',
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
          <p className="text-xs text-slate-500 truncate">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
    </Link>
  );
}

function MetricSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-48" />
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
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-black">Operations Health</CardTitle>
            <CardDescription className="text-sm mt-1">
              {totalIssues > 0
                ? `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} detected`
                : 'All systems healthy'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <MetricSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-3">
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
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No operations data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
