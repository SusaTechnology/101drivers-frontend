// components/dashboard/SchedulingPolicy.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle,
  XCircle,
  MapPin,
  Sunrise,
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
import { formatDashboardMiles } from '@/hooks/useAdminDashboard';
import type { SchedulingPolicy as SchedulingPolicyType } from '@/types/dashboard';

interface SchedulingPolicyProps {
  data: SchedulingPolicyType | undefined;
  isLoading: boolean;
}

function PolicySkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function SchedulingPolicy({ data, isLoading }: SchedulingPolicyProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">Scheduling Policy</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {data ? `${data.customerType} • ${data.serviceType?.replace('_', ' ')}` : 'Current policy settings'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {isLoading ? (
          <PolicySkeleton />
        ) : data ? (
          <>
            {/* Mode Badge */}
            <div className="flex items-center gap-2 mb-4">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-bold',
                  data.defaultMode === 'SAME_DAY'
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                )}
              >
                {data.defaultMode === 'SAME_DAY' ? 'Same Day Default' : 'Next Day Default'}
              </Badge>
            </div>

            {/* Policy Details */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-1">
                  <Sunrise className="w-3.5 h-3.5" />
                  Same Day
                </div>
                <div className="flex items-center gap-1.5">
                  {data.sameDayAllowed ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {data.sameDayAllowed ? 'Allowed' : 'Not allowed'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Cutoff Time
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {data.sameDayCutoffTime || 'N/A'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Buffer
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {data.bufferMinutes} min
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Max Same Day
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatDashboardMiles(data.maxSameDayMiles)}
                </p>
              </div>
            </div>

            {/* Additional Flags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.afterHoursEnabled && (
                <Badge variant="outline" className="text-[10px] font-bold bg-purple-50 text-purple-700 border-purple-200">
                  After Hours
                </Badge>
              )}
              {data.requiresOpsConfirmation && (
                <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                  Ops Confirmation Required
                </Badge>
              )}
            </div>

            {/* CTA */}
            <Link to="/admin-scheduling-policy">
              <Button variant="outline" size="sm" className="w-full rounded-xl">
                Manage Policy
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Calendar className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No scheduling policy set</p>
            <Link to="/admin-scheduling-policy">
              <Button variant="link" size="sm" className="mt-2 text-primary">
                Configure policy
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
