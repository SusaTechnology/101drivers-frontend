// components/dashboard/SummaryCards.tsx
import React from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import {
  Truck,
  UserCheck,
  AlertTriangle,
  DollarSign,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SummaryCards as SummaryCardsType, DashboardAction } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { getRouteFromTarget } from '@/lib/dashboardRoutes';

interface SummaryCardsProps {
  data: SummaryCardsType | undefined;
  isLoading: boolean;
  onActionClick?: (action: DashboardAction) => void;
}

type KPIColor = 'primary' | 'amber' | 'green';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: KPIColor;
  chips?: { icon: React.ElementType; label: string }[];
  action?: DashboardAction;
  onActionClick?: (action: DashboardAction) => void;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  chips,
  action,
}: KPICardProps) {
  const routePath = action?.target ? getRouteFromTarget(action.target) : null;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift transition-all duration-200">
      <CardContent className="p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              {title}
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
              {value}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center',
              color === 'amber'
                ? 'bg-amber-500/15'
                : color === 'green'
                ? 'bg-green-500/15'
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
                  : 'text-primary'
              )}
            />
          </div>
        </div>

        {chips && (
          <div className="mt-6 flex gap-2 flex-wrap">
            {chips.map((chip, idx) => (
              <Badge key={idx} variant="outline" className="chip-gray">
                <chip.icon className="w-3.5 h-3.5 text-primary mr-1" />
                {chip.label}
              </Badge>
            ))}
          </div>
        )}

        {action && routePath && (
          <div className="mt-6">
            <Link
              to={routePath}
              className={cn(
                'inline-flex items-center gap-2 text-sm font-extrabold hover:opacity-90 transition',
                color === 'amber'
                  ? 'text-amber-600'
                  : color === 'green'
                  ? 'text-green-600'
                  : 'text-primary'
              )}
            >
              {action.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KPICardSkeleton() {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardContent className="p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-9 w-16 mb-2" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="w-12 h-12 rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
    chips?: { icon: React.ElementType; label: string }[];
    action?: DashboardAction;
  }> = [
    {
      key: 'deliveriesInMotion',
      title: 'Active',
      value: data.deliveriesInMotion.count,
      subtitle: 'Deliveries in progress',
      icon: Truck,
      color: 'primary',
      chips: data.deliveriesInMotion.count > 0 ? [
        { icon: Clock, label: 'In transit' },
      ] : undefined,
      action: data.deliveriesInMotion.action,
    },
    {
      key: 'pendingDriverApprovals',
      title: 'Pending',
      value: data.pendingDriverApprovals.count,
      subtitle: 'Driver approvals',
      icon: UserCheck,
      color: data.pendingDriverApprovals.count > 0 ? 'amber' : 'primary',
      action: data.pendingDriverApprovals.action,
    },
    {
      key: 'openClaims',
      title: 'Disputes',
      value: data.openClaims.count,
      subtitle: 'Open cases',
      icon: AlertTriangle,
      color: data.openClaims.count > 0 ? 'amber' : 'primary',
      action: data.openClaims.action,
    },
    {
      key: 'capturedRevenue',
      title: 'Payments',
      value: `$${data.capturedRevenue.amount.toLocaleString()}`,
      subtitle: 'Captured revenue',
      icon: DollarSign,
      color: 'green',
      action: data.capturedRevenue.action,
    },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <KPICard
          key={card.key}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          color={card.color}
          chips={card.chips}
          action={card.action}
        />
      ))}
    </section>
  );
}
