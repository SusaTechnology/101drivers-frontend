// components/dashboard/PipelineChart.tsx
import React, { useState } from 'react';
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
import { ViewSwitcher } from './ViewSwitcher';
import type { ViewType } from './ViewSwitcher';
import { DonutChart } from './DonutChart';
import { BarChart } from './BarChart';
import type { Pipeline } from '@/types/dashboard';

interface PipelineChartProps {
  data: Pipeline | undefined;
  isLoading: boolean;
}

const STAGES = [
  { key: 'draft', label: 'Draft', color: '#64748b' },
  { key: 'quoted', label: 'Quoted', color: '#3b82f6' },
  { key: 'listed', label: 'Listed', color: '#6366f1' },
  { key: 'booked', label: 'Booked', color: '#8b5cf6' },
  { key: 'active', label: 'Active', color: '#22c55e' },
  { key: 'completed', label: 'Completed', color: '#10b981' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444' },
  { key: 'expired', label: 'Expired', color: '#f59e0b' },
  { key: 'disputed', label: 'Disputed', color: '#f43f5e' },
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
      <div className="flex flex-col items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer group">
        <div className="w-2.5 h-2.5 rounded-full mb-1" style={{ backgroundColor: color }} />
        <p className="text-lg font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">
          {count}
        </p>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </p>
      </div>
    </Link>
  );
}

function StageSkeleton() {
  return (
    <div className="flex flex-col items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-2.5 h-2.5 rounded-full mb-1" />
      <Skeleton className="h-6 w-6" />
      <Skeleton className="h-2.5 w-10 mt-1" />
    </div>
  );
}

export function PipelineChart({ data, isLoading }: PipelineChartProps) {
  const [view, setView] = useState<ViewType>('bar');

  const total = data
    ? Object.values(data).reduce((sum, val) => sum + (val || 0), 0)
    : 0;

  // Prepare chart data
  const chartData = STAGES.map((stage) => ({
    label: stage.label,
    value: data?.[stage.key as keyof Pipeline] || 0,
    color: stage.color,
  })).filter((item) => item.value > 0);

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-md">
      <CardHeader className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-sm">
              <GitBranch className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <CardTitle className="text-sm font-black">Delivery Pipeline</CardTitle>
              <CardDescription className="text-[10px] mt-0.5">
                {total} total deliveries
              </CardDescription>
            </div>
          </div>
          <ViewSwitcher value={view} onChange={setView} />
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <StageSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : data ? (
          <>
            {/* Pipeline Bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
              {STAGES.map((stage) => {
                const count = data[stage.key as keyof Pipeline] || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                if (percentage === 0) return null;
                return (
                  <div
                    key={stage.key}
                    className="h-full transition-all"
                    style={{ width: `${percentage}%`, backgroundColor: stage.color }}
                    title={`${stage.label}: ${count}`}
                  />
                );
              })}
            </div>

            {/* View Content */}
            {view === 'donut' && (
              <div className="flex justify-center py-2">
                <DonutChart
                  data={chartData}
                  size={140}
                  thickness={24}
                  centerValue={total}
                  centerLabel="Total"
                  showLegend
                />
              </div>
            )}

            {view === 'bar' && (
              <div className="space-y-3">
                {/* Main Stages Row */}
                <div className="grid grid-cols-5 gap-2">
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
                <div className="grid grid-cols-4 gap-2">
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
              </div>
            )}

            {view === 'table' && (
              <div className="grid grid-cols-3 gap-2">
                {STAGES.map((stage) => (
                  <Link
                    key={stage.key}
                    to="/admin-deliveries"
                    search={{ statuses: [stage.key.toUpperCase()] }}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {data[stage.key as keyof Pipeline] || 0}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <GitBranch className="w-6 h-6 text-slate-300 mb-1" />
            <p className="text-xs text-slate-500">No pipeline data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
