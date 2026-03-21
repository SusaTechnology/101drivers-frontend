// components/dashboard/PricingSnapshot.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  DollarSign,
  Layers,
  Tag,
  Calculator,
  ArrowRight,
  Shield,
  Percent,
  TrendingUp,
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
import { formatDashboardCurrency, formatDashboardPercent } from '@/hooks/useAdminDashboard';
import type { PricingSnapshot as PricingSnapshotType } from '@/types/dashboard';

interface PricingSnapshotProps {
  data: PricingSnapshotType | undefined;
  isLoading: boolean;
}

const MODE_CONFIG = {
  PER_MILE: {
    icon: Calculator,
    label: 'Per Mile',
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
  FLAT_TIER: {
    icon: Layers,
    label: 'Flat Tier',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  CATEGORY_ABC: {
    icon: Tag,
    label: 'Category A/B/C',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
};

function PricingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function PricingSnapshot({ data, isLoading }: PricingSnapshotProps) {
  const modeConfig = data?.pricingMode ? MODE_CONFIG[data.pricingMode] : null;
  const ModeIcon = modeConfig?.icon || DollarSign;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-green-500/15 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black">Pricing Config</CardTitle>
              <CardDescription className="text-sm mt-1">
                {data?.name || 'Current pricing configuration'}
              </CardDescription>
            </div>
          </div>
          {data?.active && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-bold">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {isLoading ? (
          <PricingSkeleton />
        ) : data ? (
          <>
            {/* Mode Badge */}
            <div className="flex items-center gap-2 mb-4">
              {modeConfig && (
                <Badge variant="outline" className={cn('text-xs font-bold', modeConfig.color)}>
                  <ModeIcon className="w-3.5 h-3.5 mr-1" />
                  {modeConfig.label}
                </Badge>
              )}
            </div>

            {/* Core Pricing Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Base Fee</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {formatDashboardCurrency(data.baseFee)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Insurance</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {formatDashboardCurrency(data.insuranceFee)}
                </p>
              </div>
              {data.pricingMode === 'PER_MILE' && data.perMileRate && (
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                  <p className="text-[10px] font-bold text-teal-600 uppercase">Per Mile Rate</p>
                  <p className="text-lg font-black text-teal-700 dark:text-teal-300">
                    {formatDashboardCurrency(data.perMileRate)}/mi
                  </p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Driver Share</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {data.driverSharePct}%
                </p>
              </div>
            </div>

            {/* Tiers Summary */}
            {data.pricingMode === 'FLAT_TIER' && data.tiers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                  Tiers ({data.tiers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.tiers.slice(0, 3).map((tier, idx) => (
                    <Badge key={tier.id || idx} variant="outline" className="text-[10px] font-bold">
                      {tier.minMiles}-{tier.maxMiles || '∞'} mi: {formatDashboardCurrency(tier.flatPrice)}
                    </Badge>
                  ))}
                  {data.tiers.length > 3 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{data.tiers.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Category Rules Summary */}
            {data.pricingMode === 'CATEGORY_ABC' && data.categoryRules.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                  Categories ({data.categoryRules.length})
                </p>
                <div className="flex gap-2">
                  {['A', 'B', 'C'].map((cat) => {
                    const rule = data.categoryRules.find(r => r.category === cat);
                    return (
                      <Badge
                        key={cat}
                        variant="outline"
                        className={cn(
                          'text-[10px] font-bold',
                          cat === 'A' ? 'bg-green-50 text-green-700 border-green-200' :
                          cat === 'B' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        )}
                      >
                        Cat {cat}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Transaction Fees */}
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1">
                <Percent className="w-3 h-3" />
                <span>{data.transactionFeePct}% + ${data.transactionFeeFixed}</span>
              </div>
              {data.feePassThrough && (
                <Badge variant="outline" className="text-[9px]">
                  Fee Pass-through
                </Badge>
              )}
            </div>

            {/* CTA */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Link to="/admin-pricing-config">
                <Button variant="outline" size="sm" className="w-full rounded-xl">
                  Manage Pricing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <DollarSign className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No pricing config set</p>
            <Link to="/admin-pricing-config">
              <Button variant="link" size="sm" className="mt-2 text-primary">
                Configure pricing
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
