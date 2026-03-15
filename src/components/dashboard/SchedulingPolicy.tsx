// components/dashboard/SchedulingPolicy.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import { Calendar, ArrowRight, Clock, MapPin } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SchedulingPolicy as SchedulingPolicyType } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface SchedulingPolicyProps {
  data: SchedulingPolicyType | null | undefined;
  isLoading: boolean;
}

function PolicyCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: { icon: React.ElementType; label: string }[];
}) {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">
        {description}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400"
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SchedulingPolicySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
        >
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-5 w-32 mb-3" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SchedulingPolicy({ data, isLoading }: SchedulingPolicyProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Scheduling policy</CardTitle>
            <CardDescription className="text-sm mt-1">
              Same-day/next-day defaults, cutoffs, and time windows.
            </CardDescription>
          </div>
          <Link
            to="/admin-scheduling-policy"
            className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
          >
            Edit
            <Calendar className="w-4 h-4 text-primary" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        {isLoading ? (
          <SchedulingPolicySkeleton />
        ) : data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PolicyCard
              title={data.customerType === 'BUSINESS' ? 'Dealer' : 'Individual'}
              description={data.defaultMode === 'SAME_DAY' ? 'Same-day allowed' : 'Next-day default'}
              items={[
                { icon: Clock, label: `Cutoff: ${data.sameDayCutoffTime}` },
                { icon: MapPin, label: `Max: ${data.maxSameDayMiles} mi` },
              ]}
            />
            <PolicyCard
              title="Configuration"
              description={`${data.bufferMinutes} min buffer`}
              items={[
                {
                  icon: data.sameDayAllowed ? Calendar : Clock,
                  label: data.sameDayAllowed ? 'Same-day enabled' : 'Same-day disabled',
                },
                {
                  icon: data.afterHoursEnabled ? Clock : Calendar,
                  label: data.afterHoursEnabled ? 'After-hours enabled' : 'After-hours disabled',
                },
              ]}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <Calendar className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              No scheduling policy
            </p>
            <Link
              to="/admin-scheduling-policy"
              className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:opacity-90 transition"
            >
              Configure policy
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
