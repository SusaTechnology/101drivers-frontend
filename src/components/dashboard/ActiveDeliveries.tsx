// components/dashboard/ActiveDeliveries.tsx
import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Truck, ArrowRight, Clock, MapPin, User } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActiveDeliveries as ActiveDeliveriesType, Delivery, DashboardAction } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface ActiveDeliveriesProps {
  data: ActiveDeliveriesType | undefined;
  isLoading: boolean;
  onActionClick?: (action: DashboardAction) => void;
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    ACTIVE: {
      bg: 'bg-primary/10 border-primary/25',
      text: 'text-primary',
      icon: Truck,
    },
    BOOKED: {
      bg: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
      text: 'text-slate-700 dark:text-slate-300',
      icon: Clock,
    },
    LISTED: {
      bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      icon: Clock,
    },
    DISPUTED: {
      bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      icon: Truck,
    },
  };

  const config = statusConfig[status] || statusConfig.ACTIVE;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold', config.bg, config.text)}
    >
      <Icon className="w-3.5 h-3.5" />
      {status}
    </Badge>
  );
}

function DeliveryCard({ delivery }: { delivery: Delivery }) {
  const driver = delivery.assignments?.[0]?.driver;
  const customerName = delivery.customer.businessName || delivery.customer.contactName;

  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar className="w-10 h-10 rounded-xl">
            <AvatarImage src={driver?.profilePhotoUrl} />
            <AvatarFallback className="rounded-xl bg-primary/15 text-primary font-bold">
              {driver?.user.fullName?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {customerName}
              </p>
              <DeliveryStatusBadge status={delivery.status} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {delivery.pickupAddress?.split(',')[0]} → {delivery.dropoffAddress?.split(',')[0]}
              </span>
            </p>
            {driver && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                {driver.user.fullName}
              </p>
            )}
          </div>
        </div>
        <Link
          to={`/admin-delivery/${delivery.id}`}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm"
        >
          Open
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function DeliveryCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-48 mb-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ action }: { action?: DashboardAction }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (action?.target) {
      navigate({ to: `/${action.target}` });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Truck className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
        No active deliveries
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
        All deliveries are currently idle
      </p>
      {action && (
        <button
          onClick={handleClick}
          className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:opacity-90 transition"
        >
          {action.label}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function ActiveDeliveries({ data, isLoading, onActionClick }: ActiveDeliveriesProps) {
  const deliveries = data?.items || [];
  const action = data?.action;
  const navigate = useNavigate();

  const handleActionClick = () => {
    if (action?.target) {
      navigate({ to: `/${action.target}` });
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
      <CardHeader className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Active deliveries</CardTitle>
            <CardDescription className="text-sm mt-1">
              Quick view. Open details for evidence, status timeline, and actions.
            </CardDescription>
          </div>
          {action && (
            <button
              onClick={handleActionClick}
              className="inline-flex items-center gap-2 text-sm font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2 rounded-2xl hover:opacity-90 transition"
            >
              {action.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-7">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <DeliveryCardSkeleton key={i} />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <EmptyState action={action} />
        ) : (
          <div className="space-y-3">
            {deliveries.slice(0, 5).map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} />
            ))}
            {deliveries.length > 5 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2">
                Showing 5 of {deliveries.length} deliveries
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
