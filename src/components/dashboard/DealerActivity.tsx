// components/dashboard/DealerActivity.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Building2,
  ArrowRight,
  TrendingUp,
  Truck,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { DealerActivity as DealerActivityType } from '@/types/dashboard';

interface DealerActivityProps {
  data: DealerActivityType | undefined;
  isLoading: boolean;
}

function TopDealerRow({
  dealer,
}: {
  dealer: DealerActivityType['topDealersByVolume'][0];
}) {
  return (
    <Link
      to="/admin-dealer-detail"
      search={{ id: dealer.customerId }}
      className="block"
    >
      <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/30 transition-colors cursor-pointer">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarFallback className="bg-purple-500/15 text-purple-600 font-bold text-sm">
            {dealer.businessName?.slice(0, 2).toUpperCase() || 'D'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {dealer.businessName}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
            <span className="flex items-center gap-1">
              <Truck className="w-3 h-3" />
              {dealer.deliveries} total
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              {dealer.activeDeliveries} active
            </span>
            {dealer.disputedDeliveries > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                {dealer.disputedDeliveries} disputed
              </span>
            )}
          </div>
        </div>

        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
    </Link>
  );
}

export function DealerActivity({ data, isLoading }: DealerActivityProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">Dealer Activity</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Top dealers by volume
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Summary Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {data.approvedBusinessCustomers}
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Approved</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xl font-black text-amber-600">
                {data.pendingBusinessCustomers}
              </p>
              <p className="text-[10px] font-bold text-amber-600 uppercase">Pending</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-xl font-black text-green-600">
                {data.activeBusinessCustomersInRange}
              </p>
              <p className="text-[10px] font-bold text-green-600 uppercase">Active</p>
            </div>
          </div>
        )}

        {/* Top Dealers */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.topDealersByVolume && data.topDealersByVolume.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Top Dealers
            </p>
            {data.topDealersByVolume.slice(0, 5).map((dealer) => (
              <TopDealerRow key={dealer.customerId} dealer={dealer} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Building2 className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No dealer activity yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
