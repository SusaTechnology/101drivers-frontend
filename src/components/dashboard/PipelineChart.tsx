// components/dashboard/PipelineChart.tsx
import React from 'react';
import {
  FileText,
  Quote,
  List,
  CalendarCheck,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
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
import type { Pipeline as PipelineType } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface PipelineChartProps {
  data: PipelineType | undefined;
  isLoading: boolean;
}

interface PipelineStage {
  key: keyof PipelineType;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const STAGES: PipelineStage[] = [
  {
    key: 'draft',
    label: 'Draft',
    icon: FileText,
    color: 'text-slate-500',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
  {
    key: 'quoted',
    label: 'Quoted',
    icon: Quote,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    key: 'listed',
    label: 'Listed',
    icon: List,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  {
    key: 'booked',
    label: 'Booked',
    icon: CalendarCheck,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  {
    key: 'active',
    label: 'Active',
    icon: Truck,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/25',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  {
    key: 'disputed',
    label: 'Disputed',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
];

function PipelineStageCard({
  stage,
  count,
  total,
}: {
  stage: PipelineStage;
  count: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const Icon = stage.icon;

  return (
    <div
      className={cn(
        'relative p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.02]',
        stage.bgColor,
        stage.borderColor,
        count === 0 && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-white/50 dark:bg-black/20', stage.color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {stage.label}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {count}
            </span>
            {total > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {percentage}%
              </span>
            )}
          </div>
        </div>
      </div>
      {count > 0 && (
        <div
          className={cn(
            'absolute bottom-0 left-0 h-1 rounded-b-2xl transition-all duration-300',
            stage.color.replace('text-', 'bg-')
          )}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      )}
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {STAGES.map((stage) => (
        <div
          key={stage.key}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        >
          <Skeleton className="w-10 h-10 rounded-xl mb-3" />
          <Skeleton className="h-3 w-12 mb-2" />
          <Skeleton className="h-6 w-8" />
        </div>
      ))}
    </div>
  );
}

export function PipelineChart({ data, isLoading }: PipelineChartProps) {
  const total = data
    ? Object.values(data).reduce((sum, val) => sum + val, 0)
    : 0;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Delivery pipeline</CardTitle>
            <CardDescription className="text-sm mt-1">
              Current status distribution across all deliveries.
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Total
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {total}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        {isLoading ? (
          <PipelineSkeleton />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {STAGES.map((stage) => (
              <PipelineStageCard
                key={stage.key}
                stage={stage}
                count={data?.[stage.key] || 0}
                total={total}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
