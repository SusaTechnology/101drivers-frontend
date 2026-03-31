// components/dashboard/OperationsSummary.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  Clock,
  Truck,
  FileWarning,
  CalendarClock,
  AlertCircle,
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
import type { Operations as OperationsType } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface OperationsSummaryProps {
  data: OperationsType | undefined;
  isLoading: boolean;
}

interface OpsMetricProps {
  label: string;
  value: number;
  icon: React.ElementType;
  isWarning?: boolean;
  linkTo?: string;
}

function OpsMetric({ label, value, icon: Icon, isWarning, linkTo }: OpsMetricProps) {
  const content = (
    <div
      className={cn(
        'p-4 rounded-2xl border transition-all duration-200',
        linkTo && 'cursor-pointer hover:scale-[1.02]',
        isWarning && value > 0
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            isWarning && value > 0
              ? 'bg-amber-500/15 text-amber-500'
              : 'bg-primary/15 text-primary'
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-2xl font-black',
                isWarning && value > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              )}
            >
              {value}
            </span>
            {isWarning && value > 0 && (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} key={label}>
        {content}
      </Link>
    );
  }

  return <div key={label}>{content}</div>;
}

function OperationsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-6 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperationsSummary({ data, isLoading }: OperationsSummaryProps) {
  const hasWarnings = data && (
    data.listedWithoutAssignment > 0 ||
    data.bookedWithoutComplianceReady > 0 ||
    data.activeWithoutTracking > 0 ||
    data.deliveriesMissingCompliance > 0 ||
    data.staleQuotedDeliveries > 0 ||
    data.staleBookedDeliveries > 0
  );

  const metrics: OpsMetricProps[] = data ? [
    {
      label: 'Listed unassigned',
      value: data.listedWithoutAssignment,
      icon: Truck,
      isWarning: true,
      linkTo: '/admin-deliveries',
    },
    {
      label: 'Booked not ready',
      value: data.bookedWithoutComplianceReady,
      icon: Clock,
      isWarning: true,
      linkTo: '/admin-deliveries',
    },
    {
      label: 'Active no tracking',
      value: data.activeWithoutTracking,
      icon: AlertCircle,
      isWarning: true,
      linkTo: '/admin-deliveries',
    },
    {
      label: 'Missing compliance',
      value: data.deliveriesMissingCompliance,
      icon: FileWarning,
      isWarning: true,
      linkTo: '/admin-deliveries',
    },
    {
      label: 'Stale quoted',
      value: data.staleQuotedDeliveries,
      icon: CalendarClock,
      isWarning: true,
      linkTo: '/admin-deliveries',
    },
    {
      label: 'Stale booked',
      value: data.staleBookedDeliveries,
      icon: CalendarClock,
      isWarning: true,
      linkTo: '/admin-deliveries',
    },
  ] : [];

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Operations health</CardTitle>
            <CardDescription className="text-sm mt-1">
              Operational metrics requiring attention.
            </CardDescription>
          </div>
          {hasWarnings && (
            <Badge
              variant="outline"
              className="bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Needs attention
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        {isLoading ? (
          <OperationsSkeleton />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <OpsMetric key={metric.label} {...metric} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
