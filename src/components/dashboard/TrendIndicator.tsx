// components/dashboard/TrendIndicator.tsx
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendIndicatorProps {
  value: number; // percentage change, e.g., 12 means +12%
  label?: string;
  size?: 'sm' | 'md';
  showValue?: boolean;
}

export function TrendIndicator({ 
  value, 
  label = 'vs last period',
  size = 'sm',
  showValue = true
}: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  
  const colorClass = isNeutral
    ? 'text-slate-400'
    : isPositive
    ? 'text-green-500'
    : 'text-red-500';

  const bgClass = isNeutral
    ? 'bg-slate-50 dark:bg-slate-800'
    : isPositive
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-red-50 dark:bg-red-900/20';

  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div className={cn(
      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full',
      bgClass,
      colorClass
    )}>
      <Icon className={iconSize} />
      {showValue && (
        <span className={cn('font-bold', textSize)}>
          {isNeutral ? '0%' : `${isPositive ? '+' : ''}${value.toFixed(1)}%`}
        </span>
      )}
    </div>
  );
}

// Skeleton for loading state
export function TrendIndicatorSkeleton() {
  return (
    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
      <div className="w-2.5 h-2.5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="w-8 h-2.5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
    </div>
  );
}
