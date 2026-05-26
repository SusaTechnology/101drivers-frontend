// components/dashboard/LiveTrackingSection.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  MapPin,
  Truck,
  Navigation,
  ArrowRight,
  Clock,
  User,
  Radio,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { resolveAction, getStatusColor } from '@/lib/dashboardRoutes';
import { formatDashboardMiles, formatDashboardDateTime } from '@/hooks/useAdminDashboard';
import type { LiveTrackingOverview, ActiveDeliveries, AdminDashboardAction } from '@/types/dashboard';

interface LiveTrackingSectionProps {
  liveTrackingOverview: LiveTrackingOverview | undefined;
  activeDeliveries: ActiveDeliveries | undefined;
  isLoading: boolean;
}

function TrackingStatusCard({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: 'green' | 'amber' | 'red';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl',
        color === 'green'
          ? 'bg-green-50 dark:bg-green-900/20'
          : color === 'amber'
          ? 'bg-amber-50 dark:bg-amber-900/20'
          : 'bg-red-50 dark:bg-red-900/20'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          color === 'green'
            ? 'bg-green-100 dark:bg-green-900/30'
            : color === 'amber'
            ? 'bg-amber-100 dark:bg-amber-900/30'
            : 'bg-red-100 dark:bg-red-900/30'
        )}
      >
        <Icon
          className={cn(
            'w-5 h-5',
            color === 'green'
              ? 'text-green-600'
              : color === 'amber'
              ? 'text-amber-600'
              : 'text-red-600'
          )}
        />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">{count}</p>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function DeliveryListItem({
  item,
}: {
  item: LiveTrackingOverview['items'][0];
}) {
  const isStale = !item.latestPointAt || 
    new Date().getTime() - new Date(item.latestPointAt).getTime() > 30 * 60 * 1000; // 30 min

  return (
    <Link
      to="/admin-delivery-details"
      search={{ id: item.deliveryId }}
      className="block"
    >
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        {/* Driver Avatar */}
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={undefined} alt={item.driverName || 'Driver'} />
          <AvatarFallback className="bg-primary/15 text-primary font-bold">
            {item.driverName?.split(' ').map(n => n[0]).join('') || 'D'}
          </AvatarFallback>
        </Avatar>

        {/* Delivery Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {item.driverName || 'Unassigned'}
            </p>
            <Badge
              variant="outline"
              className={cn('text-[10px] font-bold', getStatusColor(item.trackingStatus || 'UNKNOWN'))}
            >
              {item.trackingStatus || 'No tracking'}
            </Badge>
            {isStale && item.trackingStatus === 'STARTED' && (
              <Badge variant="outline" className="text-[10px] font-bold bg-amber-100 text-amber-700 border-amber-200">
                Stale
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 truncate">
            {item.pickupAddress?.split(',')[0]} → {item.dropoffAddress?.split(',')[0]}
          </p>
        </div>

        {/* Stats */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {formatDashboardMiles(item.drivenMiles)}
          </p>
          <p className="text-[10px] text-slate-500">
            {item.latestPointAt ? formatDashboardDateTime(item.latestPointAt) : 'No data'}
          </p>
        </div>

        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
    </Link>
  );
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function LiveTrackingSection({
  liveTrackingOverview,
  activeDeliveries,
  isLoading,
}: LiveTrackingSectionProps) {
  const navProps = resolveAction(liveTrackingOverview?.action || activeDeliveries?.action);
  
  // Merge data from both sources
  const trackedCount = liveTrackingOverview?.activeTrackedCount ?? 0;
  const untrackedCount = liveTrackingOverview?.activeUntrackedCount ?? 0;
  const staleCount = liveTrackingOverview?.staleTrackingCount ?? 0;
  const totalActive = activeDeliveries?.count ?? trackedCount + untrackedCount;
  const trackingItems = liveTrackingOverview?.items ?? [];

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Navigation className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-black">Live Operations</CardTitle>
              <CardDescription className="text-sm mt-1">
                {totalActive} active delivery{totalActive !== 1 ? 's' : ''} in progress
              </CardDescription>
            </div>
          </div>
          {navProps && (
            <Link to={navProps.to} search={navProps.search}>
              <Button variant="outline" size="sm" className="rounded-xl">
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Tracking Status Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <TrackingStatusCard
            icon={Radio}
            label="Tracked"
            count={trackedCount}
            color="green"
          />
          <TrackingStatusCard
            icon={AlertTriangle}
            label="Stale"
            count={staleCount}
            color="amber"
          />
          <TrackingStatusCard
            icon={WifiOff}
            label="Untracked"
            count={untrackedCount}
            color="red"
          />
        </div>

        {/* Active Deliveries List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : trackingItems.length > 0 ? (
          <div className="space-y-3">
            {trackingItems.slice(0, 5).map((item) => (
              <DeliveryListItem key={item.deliveryId} item={item} />
            ))}
            {trackingItems.length > 5 && (
              <p className="text-xs text-slate-500 text-center pt-2">
                +{trackingItems.length - 5} more active deliveries
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <Truck className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              No active deliveries
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Active deliveries will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
