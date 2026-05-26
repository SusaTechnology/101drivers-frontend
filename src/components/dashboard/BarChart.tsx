// components/dashboard/BarChart.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  horizontal?: boolean;
  showValues?: boolean;
  showLabels?: boolean;
  barHeight?: number;
  className?: string;
  maxValue?: number;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export function BarChart({
  data,
  horizontal = true,
  showValues = true,
  showLabels = true,
  barHeight = 24,
  className,
  maxValue,
}: BarChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  if (horizontal) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {showLabels && (
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 w-20 truncate text-right">
                {item.label}
              </span>
            )}
            <div 
              className="flex-1 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden"
              style={{ height: barHeight }}
            >
              <div
                className="h-full rounded transition-all duration-500 flex items-center justify-end px-2"
                style={{ 
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                }}
              >
                {showValues && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm">
                    {item.value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Vertical bar chart
  return (
    <div className={cn('flex items-end gap-2', className)}>
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center gap-1 flex-1">
          <div 
            className="w-full bg-slate-100 dark:bg-slate-800 rounded-t overflow-hidden relative"
            style={{ height: 100 }}
          >
            <div
              className="absolute bottom-0 w-full rounded-t transition-all duration-500"
              style={{ 
                height: `${(item.value / max) * 100}%`,
                backgroundColor: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
              }}
            />
          </div>
          {showLabels && (
            <span className="text-[9px] font-semibold text-slate-500 truncate max-w-full">
              {item.label}
            </span>
          )}
          {showValues && (
            <span className="text-[10px] font-bold text-slate-900 dark:text-white">
              {item.value.toLocaleString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
