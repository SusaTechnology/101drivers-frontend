// components/dashboard/PipelineChart.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, GitBranch } from 'lucide-react';
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
import type { Pipeline } from '@/types/dashboard';

interface PipelineChartProps {
  data: Pipeline | undefined;
  isLoading: boolean;
}

const STAGES = [
  { key: 'draft', label: 'Draft', color: 'bg-slate-400' },
  { key: 'quoted', label: 'Quoted', color: 'bg-blue-500' },
  { key: 'listed', label: 'Listed', color: 'bg-indigo-500' },
  { key: 'booked', label: 'Booked', color: 'bg-purple-500' },
  { key: 'active', label: 'Active', color: 'bg-green-500' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
  { key: 'expired', label: 'Expired', color: 'bg-amber-500' },
  { key: 'disputed', label: 'Disputed', color: 'bg-rose-500' },
] as const;

function StageCard({
  label,
  count,
  color,
  status,
}: {
  label: string;
  count: number;
  color: string;
  status: string;
}) {
  return (
    <Link
      to="/admin-deliveries"
      search={{ statuses: [status.toUpperCase()] }}
      className="block"
    >
      <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer group">
        <div className={cn('w-3 h-3 rounded-full mb-2', color)} />
        <p className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">
          {count}
        </p>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
          {label}
        </p>
      </div>
    </Link>
  );
}

function StageSkeleton() {
  return (
    <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-3 h-3 rounded-full mb-2" />
      <Skeleton className="h-8 w-8" />
      <Skeleton className="h-3 w-12 mt-1" />
    </div>
  );
}

export function PipelineChart({ data, isLoading }: PipelineChartProps) {
  const total = data
    ? Object.values(data).reduce((sum, val) => sum + (val || 0), 0)
    : 0;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-black">Delivery Pipeline</CardTitle>
              <CardDescription className="text-sm mt-1">
                {total} total deliver{total !== 1 ? 'ies' : 'y'} in system
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <StageSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Pipeline Bar */}
            <div className="flex h-4 rounded-full overflow-hidden mb-6">
              {STAGES.map((stage) => {
                const count = data[stage.key as keyof Pipeline] || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                if (percentage === 0) return null;
                return (
                  <div
                    key={stage.key}
                    className={cn('h-full transition-all', stage.color)}
                    style={{ width: `${percentage}%` }}
                    title={`${stage.label}: ${count}`}
                  />
                );
              })}
            </div>

            {/* Stage Cards */}
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
              {STAGES.slice(0, 5).map((stage) => (
                <StageCard
                  key={stage.key}
                  label={stage.label}
                  count={data[stage.key as keyof Pipeline] || 0}
                  color={stage.color}
                  status={stage.key}
                />
              ))}
            </div>

            {/* Secondary Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {STAGES.slice(5).map((stage) => (
                <StageCard
                  key={stage.key}
                  label={stage.label}
                  count={data[stage.key as keyof Pipeline] || 0}
                  color={stage.color}
                  status={stage.key}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-slate-500">No pipeline data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
