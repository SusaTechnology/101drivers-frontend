// components/dashboard/PricingSnapshot.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import { Sliders, ArrowRight, DollarSign } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PricingSnapshot as PricingSnapshotType } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface PricingSnapshotProps {
  data: PricingSnapshotType | null | undefined;
  isLoading: boolean;
}

function PricingSnapshotSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </>
  );
}

function CategoryRateRow({ category, rate }: { category: string; rate: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
        {category}
      </span>
      <span className="text-sm font-black text-slate-900 dark:text-white">{rate}</span>
    </div>
  );
}

export function PricingSnapshot({ data, isLoading }: PricingSnapshotProps) {
  const renderPricingInfo = () => {
    if (!data) return null;

    switch (data.pricingMode) {
      case 'CATEGORY_ABC':
        return (
          <>
            {data.categoryRules.map((rule, idx) => (
              <CategoryRateRow
                key={rule.id || idx}
                category={`Category ${rule.category}`}
                rate={
                  rule.flatPrice
                    ? `$${rule.flatPrice} flat`
                    : rule.perMileRate
                    ? `$${rule.perMileRate}/mi`
                    : `$${rule.baseFee} base`
                }
              />
            ))}
          </>
        );
      case 'FLAT_TIER':
        return (
          <>
            {data.tiers.map((tier, idx) => (
              <CategoryRateRow
                key={tier.id || idx}
                category={`${tier.minMiles}-${tier.maxMiles || '∞'} miles`}
                rate={`$${tier.flatPrice}`}
              />
            ))}
          </>
        );
      case 'PER_MILE':
      default:
        return (
          <>
            <CategoryRateRow category="Base fee" rate={`$${data.baseFee}`} />
            <CategoryRateRow
              category="Per mile rate"
              rate={data.perMileRate ? `$${data.perMileRate}/mi` : 'N/A'}
            />
          </>
        );
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Pricing snapshot</CardTitle>
            <CardDescription className="text-sm mt-1">
              Current pricing configuration overview.
            </CardDescription>
          </div>
          <Link
            to="/admin-pricing"
            className="inline-flex items-center gap-2 text-sm font-extrabold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl hover:bg-primary/5 transition"
          >
            Edit
            <Sliders className="w-4 h-4 text-primary" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        <div className="space-y-4">
          {isLoading ? (
            <PricingSnapshotSkeleton />
          ) : data ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  Config name
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {data.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-bold',
                      data.active
                        ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    )}
                  >
                    {data.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {renderPricingInfo()}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Insurance fee
                  </span>
                  <span className="text-sm font-black text-primary">${data.insuranceFee}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Transaction fee
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {data.transactionFeePct}% + ${data.transactionFeeFixed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Driver share
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {data.driverSharePct}%
                  </span>
                </div>
              </div>

              <Badge
                variant="outline"
                className="text-[10px] font-bold mt-2 bg-primary/5 text-primary border-primary/20"
              >
                {data.pricingMode.replace('_', ' ')} mode
              </Badge>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <DollarSign className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                No pricing config
              </p>
              <Link
                to="/admin-pricing"
                className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:opacity-90 transition"
              >
                Configure pricing
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
