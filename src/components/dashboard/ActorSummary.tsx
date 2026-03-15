// components/dashboard/ActorSummary.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import { Users, Building2, Truck, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActorSummary as ActorSummaryType } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface ActorSummaryProps {
  data: ActorSummaryType | undefined;
  isLoading: boolean;
}

interface ActorCardProps {
  title: string;
  icon: React.ElementType;
  stats: {
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
  linkTo: string;
}

function ActorCard({ title, icon: Icon, stats, linkTo }: ActorCardProps) {
  const total = stats.pending + stats.approved + stats.rejected + stats.suspended;

  return (
    <Link
      to={linkTo}
      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition block"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
            {title}
          </p>
        </div>
        <span className="text-lg font-black text-slate-900 dark:text-white">
          {total}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {stats.pending > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
          >
            {stats.pending} pending
          </Badge>
        )}
        <Badge
          variant="outline"
          className="text-[10px] font-bold bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
        >
          {stats.approved} approved
        </Badge>
        {stats.rejected > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
          >
            {stats.rejected} rejected
          </Badge>
        )}
        {stats.suspended > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
          >
            {stats.suspended} suspended
          </Badge>
        )}
      </div>
    </Link>
  );
}

function ActorSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-6 w-8" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActorSummary({ data, isLoading }: ActorSummaryProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Actors overview</CardTitle>
            <CardDescription className="text-sm mt-1">
              Quick summary of customers and drivers in the system.
            </CardDescription>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary font-bold" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        {isLoading ? (
          <ActorSummarySkeleton />
        ) : data ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ActorCard
              title="Private Customers"
              icon={Users}
              stats={data.privateCustomers}
              linkTo="/admin-users"
            />
            <ActorCard
              title="Business Customers"
              icon={Building2}
              stats={data.businessCustomers}
              linkTo="/admin-users"
            />
            <ActorCard
              title="Drivers"
              icon={Truck}
              stats={{
                pending: data.drivers.pending,
                approved: data.drivers.approved,
                rejected: 0,
                suspended: data.drivers.suspended,
              }}
              linkTo="/admin-users"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
