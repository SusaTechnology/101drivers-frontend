// components/dashboard/DriverOperations.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Car,
  UserCheck,
  Clock,
  Ban,
  ArrowRight,
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
import { formatDashboardDateTime } from '@/hooks/useAdminDashboard';
import type { DriverOperations as DriverOperationsType } from '@/types/dashboard';

interface DriverOperationsProps {
  data: DriverOperationsType | undefined;
  isLoading: boolean;
}

function PendingDriverRow({ driver }: { driver: DriverOperationsType['recentPendingDrivers'][0] }) {
  return (
    <Link
      to="/admin-user-detail"
      search={{ id: driver.id }}
      className="block"
    >
      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 hover:border-primary/30 transition-colors cursor-pointer">
        <Avatar className="w-9 h-9 shrink-0">
          <AvatarImage src={driver.profilePhotoUrl || undefined} />
          <AvatarFallback className="bg-amber-100 text-amber-700 font-bold text-xs">
            {driver.user?.fullName?.split(' ').map(n => n[0]).join('') || 'D'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {driver.user?.fullName || 'Unknown'}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {driver.user?.email}
          </p>
        </div>

        <div className="text-right shrink-0">
          <Badge variant="outline" className="text-[10px] font-bold bg-amber-100 text-amber-700 border-amber-200">
            Pending
          </Badge>
          <p className="text-[10px] text-slate-500 mt-1">
            {formatDashboardDateTime(driver.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function DriverOperations({ data, isLoading }: DriverOperationsProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
              <Car className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-black">Driver Operations</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Driver stats and pending approvals
              </CardDescription>
            </div>
          </div>
          <Link to="/admin-users" search={{ tab: 'drivers' }}>
            <Badge variant="outline" className="chip cursor-pointer hover:bg-primary/10">
              View All
              <ArrowRight className="w-3 h-3 ml-1" />
            </Badge>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Driver Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-xl font-black text-green-600">
              {data?.approvedDrivers ?? 0}
            </p>
            <p className="text-[9px] font-bold text-green-600 uppercase">Approved</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xl font-black text-amber-600">
              {data?.pendingDrivers ?? 0}
            </p>
            <p className="text-[9px] font-bold text-amber-600 uppercase">Pending</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xl font-black text-slate-600">
              {data?.suspendedDrivers ?? 0}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase">Suspended</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xl font-black text-blue-600">
              {data?.driversWithActiveTrips ?? 0}
            </p>
            <p className="text-[9px] font-bold text-blue-600 uppercase">On Trip</p>
          </div>
        </div>

        {/* Recent Pending Drivers */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.recentPendingDrivers && data.recentPendingDrivers.length > 0 ? (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Pending Approvals ({data.recentPendingDrivers.length})
            </p>
            <div className="space-y-2">
              {data.recentPendingDrivers.slice(0, 3).map((driver) => (
                <PendingDriverRow key={driver.id} driver={driver} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <UserCheck className="w-8 h-8 text-green-300 mb-2" />
            <p className="text-sm text-slate-500">No pending drivers</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
