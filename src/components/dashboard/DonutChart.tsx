// components/dashboard/DonutChart.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface DonutChartItem {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartItem[];
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  centerValue?: string | number;
  centerLabel?: string;
  className?: string;
}

export function DonutChart({
  data,
  size = 120,
  thickness = 20,
  showLegend = true,
  centerValue,
  centerLabel,
  className,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate stroke-dasharray for each segment
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const segments = data.map((item, index) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const strokeDasharray = total > 0 
      ? `${(item.value / total) * circumference} ${circumference}`
      : `0 ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += (item.value / total) * circumference;
    
    return {
      ...item,
      percentage,
      strokeDasharray,
      strokeDashoffset,
      index,
    };
  });

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={thickness}
            className="text-slate-100 dark:text-slate-800"
          />
          {/* Segments */}
          {segments.map((segment) => (
            <circle
              key={segment.index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              className="transition-all duration-500"
              strokeLinecap="round"
            />
          ))}
        </svg>
        
        {/* Center content */}
        {(centerValue !== undefined || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Legend */}
      {showLegend && (
        <div className="flex flex-col gap-1">
          {segments.map((segment) => (
            <div key={segment.index} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate">
                {segment.label}
              </span>
              <span className="text-[10px] font-bold text-slate-900 dark:text-white">
                {segment.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Mini donut for inline display
export function MiniDonut({
  data,
  size = 40,
  thickness = 6,
}: Pick<DonutChartProps, 'data' | 'size' | 'thickness'>) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const segments = data.map((item, index) => {
    const strokeDasharray = total > 0 
      ? `${(item.value / total) * circumference} ${circumference}`
      : `0 ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += (item.value / total) * circumference;
    
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      index,
    };
  });

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={thickness}
        className="text-slate-100 dark:text-slate-800"
      />
      {segments.map((segment) => (
        <circle
          key={segment.index}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={segment.color}
          strokeWidth={thickness}
          strokeDasharray={segment.strokeDasharray}
          strokeDashoffset={segment.strokeDashoffset}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
