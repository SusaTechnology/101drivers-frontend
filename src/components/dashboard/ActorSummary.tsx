// components/dashboard/ActorSummary.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Users,
  Building2,
  UserCheck,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle,
  Ban,
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
import { cn } from '@/lib/utils';
import type { ActorSummary as ActorSummaryType } from '@/types/dashboard';

interface ActorSummaryProps {
  data: ActorSummaryType | undefined;
  isLoading: boolean;
}

interface ActorCardProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  stats: {
    pending: number;
    approved: number;
    rejected?: number;
    suspended: number;
  };
  linkTo: string;
  linkParams?: Record<string, string>;
}

function ActorCard({ title, icon: Icon, iconColor, stats, linkTo, linkParams }: ActorCardProps) {
  const total = stats.pending + stats.approved + (stats.rejected || 0) + stats.suspended;

  return (
    <Link to={linkTo} search={linkParams}>
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className={cn('w-5 h-5', iconColor)} />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold">
            {total} total
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            <span className="text-slate-600 dark:text-slate-400">Approved:</span>
            <span className="font-bold text-slate-900 dark:text-white">{stats.approved}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-600 dark:text-slate-400">Pending:</span>
            <span className="font-bold text-slate-900 dark:text-white">{stats.pending}</span>
          </div>
          {stats.rejected !== undefined && (
            <div className="flex items-center gap-2 text-xs">
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-slate-600 dark:text-slate-400">Rejected:</span>
              <span className="font-bold text-slate-900 dark:text-white">{stats.rejected}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs">
            <Ban className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400">Suspended:</span>
            <span className="font-bold text-slate-900 dark:text-white">{stats.suspended}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-primary flex items-center gap-1">
            View details <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ActorSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

export function ActorSummary({ data, isLoading }: ActorSummaryProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-black">Platform Users</CardTitle>
            <CardDescription className="text-sm mt-1">
              Customers, dealers, and drivers
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <ActorSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-3">
            <ActorCard
              title="Business Customers"
              icon={Building2}
              iconColor="text-purple-500"
              stats={{
                pending: data.businessCustomers?.pending ?? 0,
                approved: data.businessCustomers?.approved ?? 0,
                rejected: data.businessCustomers?.rejected ?? 0,
                suspended: data.businessCustomers?.suspended ?? 0,
              }}
              linkTo="/admin-users"
              linkParams={{ tab: 'customers', customerType: 'BUSINESS' }}
            />

            <ActorCard
              title="Private Customers"
              icon={Users}
              iconColor="text-blue-500"
              stats={{
                pending: data.privateCustomers?.pending ?? 0,
                approved: data.privateCustomers?.approved ?? 0,
                rejected: data.privateCustomers?.rejected ?? 0,
                suspended: data.privateCustomers?.suspended ?? 0,
              }}
              linkTo="/admin-users"
              linkParams={{ tab: 'customers', customerType: 'PRIVATE' }}
            />

            <ActorCard
              title="Drivers"
              icon={UserCheck}
              iconColor="text-green-500"
              stats={{
                pending: data.drivers?.pending ?? 0,
                approved: data.drivers?.approved ?? 0,
                suspended: data.drivers?.suspended ?? 0,
              }}
              linkTo="/admin-users"
              linkParams={{ tab: 'drivers' }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-slate-500">No user data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
