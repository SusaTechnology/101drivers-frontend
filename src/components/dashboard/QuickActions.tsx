// components/dashboard/QuickActions.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Zap,
  Truck,
  UserCheck,
  AlertTriangle,
  DollarSign,
  Wallet,
  Shield,
  ArrowRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { resolveAction } from '@/lib/dashboardRoutes';
import type { AdminDashboardAction } from '@/types/dashboard';

interface QuickActionsProps {
  data: AdminDashboardAction[] | undefined;
  isLoading: boolean;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  deliveries: Truck,
  drivers: UserCheck,
  disputes: AlertTriangle,
  payments: DollarSign,
  payouts: Wallet,
  'insurance-reporting': Shield,
  customers: UserCheck,
};

const ACTION_COLORS: Record<string, string> = {
  deliveries: 'bg-blue-500/15 text-blue-500',
  drivers: 'bg-green-500/15 text-green-500',
  disputes: 'bg-amber-500/15 text-amber-500',
  payments: 'bg-purple-500/15 text-purple-500',
  payouts: 'bg-teal-500/15 text-teal-500',
  'insurance-reporting': 'bg-indigo-500/15 text-indigo-500',
  customers: 'bg-pink-500/15 text-pink-500',
};

export function QuickActions({ data, isLoading }: QuickActionsProps) {
  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-40 mt-1" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">Quick Actions</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              One-click access to key admin tasks
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {data.map((action, idx) => {
            const navProps = resolveAction(action);
            const Icon = ACTION_ICONS[action.target] || Zap;
            const color = ACTION_COLORS[action.target] || 'bg-slate-500/15 text-slate-500';

            if (!navProps) return null;

            return (
              <Link key={idx} to={navProps.to} search={navProps.search}>
                <Button
                  variant="outline"
                  className="w-full h-11 justify-start rounded-xl hover:bg-primary/5 border-slate-200 dark:border-slate-800"
                >
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mr-2', color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold flex-1 text-left">{action.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
