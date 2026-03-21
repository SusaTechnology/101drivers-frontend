// components/dashboard/SummaryCards.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Truck,
  UserCheck,
  AlertTriangle,
  DollarSign,
  ArrowRight,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { resolveAction } from '@/lib/dashboardRoutes';
import { formatDashboardCurrency, formatDashboardDateTime } from '@/hooks/useAdminDashboard';
import type { SummaryCards as SummaryCardsType, AdminDashboardAction } from '@/types/dashboard';

interface SummaryCardsProps {
  data: SummaryCardsType | undefined;
  isLoading: boolean;
}

type KPIColor = 'primary' | 'amber' | 'green' | 'red';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: KPIColor;
  items?: Array<{
    id: string;
    primary: string;
    secondary?: string;
    badge?: string;
  }>;
  action?: AdminDashboardAction | null;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  items,
  action,
}: KPICardProps) {
  const navProps = resolveAction(action);

  const content = (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-all duration-200 group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {title}
            </p>
            <p className="mt-2 text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
              {value}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
              color === 'amber'
                ? 'bg-amber-500/15'
                : color === 'green'
                ? 'bg-green-500/15'
                : color === 'red'
                ? 'bg-red-500/15'
                : 'bg-primary/15'
            )}
          >
            <Icon
              className={cn(
                'w-6 h-6 font-bold',
                color === 'amber'
                  ? 'text-amber-500'
                  : color === 'green'
                  ? 'text-green-500'
                  : color === 'red'
                  ? 'text-red-500'
                  : 'text-primary'
              )}
            />
          </div>
        </div>

        {/* Preview Items */}
        {items && items.length > 0 && (
          <div className="mt-4 space-y-2">
            {items.slice(0, 3).map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                    {item.primary}
                  </span>
                </div>
                {item.badge && (
                  <Badge
                    variant="outline"
                    className="text-[9px] font-bold px-1.5 py-0.5 ml-2 shrink-0"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Link */}
        {action && navProps && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              to={navProps.to}
              search={navProps.search}
              className={cn(
                'inline-flex items-center gap-2 text-sm font-bold hover:opacity-80 transition',
                color === 'amber'
                  ? 'text-amber-600'
                  : color === 'green'
                  ? 'text-green-600'
                  : color === 'red'
                  ? 'text-red-600'
                  : 'text-primary'
              )}
            >
              {action.label}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return content;
}

function KPICardSkeleton() {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-10 w-16 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const cards: Array<{
    key: string;
    title: string;
    value: string | number;
    subtitle: string;
    icon: React.ElementType;
    color: KPIColor;
    items?: Array<{ id: string; primary: string; secondary?: string; badge?: string }>;
    action?: AdminDashboardAction | null;
  }> = [
    {
      key: 'deliveriesInMotion',
      title: 'Active Deliveries',
      value: data.deliveriesInMotion?.count ?? 0,
      subtitle: 'Currently in progress',
      icon: Truck,
      color: 'primary',
      items: data.deliveriesInMotion?.items?.slice(0, 3).map((d) => ({
        id: d.id,
        primary: d.customer?.businessName || d.customer?.contactName || 'Unknown',
        secondary: `${d.pickupAddress?.split(',')[0]} → ${d.dropoffAddress?.split(',')[0]}`,
        badge: d.serviceType?.replace('_', ' '),
      })),
      action: data.deliveriesInMotion?.action,
    },
    {
      key: 'pendingDriverApprovals',
      title: 'Driver Approvals',
      value: data.pendingDriverApprovals?.count ?? 0,
      subtitle: 'Pending review',
      icon: UserCheck,
      color: (data.pendingDriverApprovals?.count ?? 0) > 0 ? 'amber' : 'primary',
      items: data.pendingDriverApprovals?.items?.slice(0, 3).map((d) => ({
        id: d.id,
        primary: d.user?.fullName || 'Unknown',
        secondary: d.user?.email,
        badge: 'PENDING',
      })),
      action: data.pendingDriverApprovals?.action,
    },
    {
      key: 'openClaims',
      title: 'Open Disputes',
      value: data.openClaims?.count ?? 0,
      subtitle: 'Requires attention',
      icon: AlertTriangle,
      color: (data.openClaims?.count ?? 0) > 0 ? 'red' : 'primary',
      action: data.openClaims?.action,
    },
    {
      key: 'capturedRevenue',
      title: 'Captured Revenue',
      value: formatDashboardCurrency(data.capturedRevenue?.amount ?? 0),
      subtitle: `${data.capturedRevenue?.count ?? 0} payments captured`,
      icon: DollarSign,
      color: 'green',
      action: data.capturedRevenue?.action,
    },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {cards.map((card) => (
        <KPICard key={card.key} {...card} />
      ))}
    </section>
  );
}
