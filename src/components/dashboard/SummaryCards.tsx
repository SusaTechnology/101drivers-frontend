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
  TrendingDown,
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
  trend?: {
    value: number;
    label?: string;
  };
  items?: Array<{
    id: string;
    primary: string;
    secondary?: string;
    badge?: string;
  }>;
  action?: AdminDashboardAction | null;
}

// Gradient background styles for icons
const getGradientStyle = (color: KPIColor) => {
  switch (color) {
    case 'amber':
      return 'bg-gradient-to-br from-amber-400 to-orange-500';
    case 'green':
      return 'bg-gradient-to-br from-green-400 to-emerald-600';
    case 'red':
      return 'bg-gradient-to-br from-red-400 to-rose-600';
    default:
      return 'bg-gradient-to-br from-lime-400 to-green-500';
  }
};

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  items,
  action,
}: KPICardProps) {
  const navProps = resolveAction(action);

  const content = (
    <Card className="border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                {title}
              </p>
              {trend && (
                <div className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                  trend.value >= 0 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                )}>
                  {trend.value >= 0 ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(0)}%
                </div>
              )}
            </div>
            <p className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
              {value}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
              getGradientStyle(color)
            )}
          >
            <Icon className="w-5 h-5 text-white drop-shadow-sm" />
          </div>
        </div>

        {/* Preview Items */}
        {items && items.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {items.slice(0, 2).map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                    {item.primary}
                  </span>
                </div>
                {item.badge && (
                  <Badge
                    variant="outline"
                    className="text-[8px] font-bold px-1 py-0 ml-1.5 shrink-0"
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
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Link
              to={navProps.to}
              search={navProps.search}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-bold hover:opacity-80 transition',
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
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
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
    <Card className="border-slate-200 dark:border-slate-800 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-8 w-14 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
    trend?: { value: number; label?: string };
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
      trend: { value: 8, label: 'vs yesterday' },
      items: data.deliveriesInMotion?.items?.slice(0, 2).map((d) => ({
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
      trend: { value: -15, label: 'vs yesterday' },
      items: data.pendingDriverApprovals?.items?.slice(0, 2).map((d) => ({
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
      trend: { value: 5, label: 'vs yesterday' },
      action: data.openClaims?.action,
    },
    {
      key: 'capturedRevenue',
      title: 'Captured Revenue',
      value: formatDashboardCurrency(data.capturedRevenue?.amount ?? 0),
      subtitle: `${data.capturedRevenue?.count ?? 0} payments`,
      icon: DollarSign,
      color: 'green',
      trend: { value: 12, label: 'vs yesterday' },
      action: data.capturedRevenue?.action,
    },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <KPICard key={card.key} {...card} />
      ))}
    </section>
  );
}
