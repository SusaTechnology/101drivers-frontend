// components/dashboard/AlertsStrip.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resolveAction, getSeverityStyle } from '@/lib/dashboardRoutes';
import type { Alerts, AlertItem } from '@/types/dashboard';

interface AlertsStripProps {
  data: Alerts | undefined;
  isLoading: boolean;
}

function AlertCard({ item }: { item: AlertItem }) {
  const navProps = resolveAction(item.action);
  const style = getSeverityStyle(item.severity);
  const Icon = item.severity === 'CRITICAL' ? XCircle : AlertTriangle;

  const content = (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-4 rounded-2xl border transition-colors',
        style.bg,
        style.border,
        navProps && 'cursor-pointer hover:opacity-80'
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Icon className={cn('w-5 h-5 shrink-0', style.icon)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-sm font-bold', style.text)}>
              {item.title}
            </p>
            {item.count > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5',
                  item.severity === 'CRITICAL'
                    ? 'bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
                    : 'bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                )}
              >
                {item.count}
              </Badge>
            )}
          </div>
          {item.subtitle && (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              {item.subtitle}
            </p>
          )}
        </div>
      </div>
      {item.action && navProps && (
        <span
          className={cn(
            'text-sm font-bold hover:opacity-90 transition inline-flex items-center gap-1 shrink-0',
            style.text
          )}
        >
          {item.action.label}
          <ArrowRight className="w-4 h-4" />
        </span>
      )}
    </div>
  );

  if (navProps) {
    return (
      <Link to={navProps.to} search={navProps.search} key={item.code}>
        {content}
      </Link>
    );
  }

  return <div key={item.code}>{content}</div>;
}

function AlertSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-5 h-5 rounded" />
      <div className="flex-1">
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-4 w-56" />
      </div>
    </div>
  );
}

export function AlertsStrip({ data, isLoading }: AlertsStripProps) {
  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <AlertSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.items || data.items.length === 0) {
    return null;
  }

  // Only show alerts with count > 0, or show all if all are 0
  const activeAlerts = data.items.filter(item => item.count > 0);
  const displayAlerts = activeAlerts.length > 0 ? activeAlerts : data.items.slice(0, 5);
  
  const criticalAlerts = displayAlerts.filter(a => a.severity === 'CRITICAL');
  const warningAlerts = displayAlerts.filter(a => a.severity === 'WARNING');

  if (displayAlerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
      {/* Header with counts */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Alerts
            </h3>
            <p className="text-xs text-slate-500">
              {(data.criticalCount ?? 0) > 0 && (
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {data.criticalCount} critical
                </span>
              )}
              {(data.criticalCount ?? 0) > 0 && (data.warningCount ?? 0) > 0 && ' • '}
              {(data.warningCount ?? 0) > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {data.warningCount} warnings
                </span>
              )}
              {data.criticalCount === 0 && data.warningCount === 0 && 'All clear'}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Critical alerts first */}
          {criticalAlerts.map((item) => (
            <AlertCard key={item.code} item={item} />
          ))}
          {/* Then warnings */}
          {warningAlerts.map((item) => (
            <AlertCard key={item.code} item={item} />
          ))}
        </div>

        {/* Show count of hidden alerts */}
        {data.items.length > displayAlerts.length && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            +{data.items.length - displayAlerts.length} more alert types
          </p>
        )}
      </CardContent>
    </Card>
  );
}
