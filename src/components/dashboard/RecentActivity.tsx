// components/dashboard/RecentActivity.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Clock,
  UserCheck,
  Building2,
  AlertTriangle,
  DollarSign,
  Wallet,
  Truck,
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
import { formatDashboardCurrency, formatDashboardDateTime } from '@/hooks/useAdminDashboard';
import type { Recent as RecentType } from '@/types/dashboard';

interface RecentActivityProps {
  data: RecentType | undefined;
  isLoading: boolean;
}

function ActivityItem({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  badge,
  linkTo,
  linkParams,
  time,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  linkTo: string;
  linkParams?: Record<string, unknown>;
  time?: string;
}) {
  return (
    <Link to={linkTo} search={linkParams} className="block">
      <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
        {badge}
        {time && (
          <span className="text-[10px] text-slate-400 shrink-0">{time}</span>
        )}
      </div>
    </Link>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2.5">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentActivity({ data, isLoading }: RecentActivityProps) {
  // Check if there's any activity
  const hasActivity = data && (
    (data.pendingDrivers?.length > 0) ||
    (data.pendingBusinessCustomers?.length > 0) ||
    (data.recentDisputes?.length > 0) ||
    (data.recentPayments?.length > 0) ||
    (data.recentPayouts?.length > 0) ||
    (data.deliveriesNeedingOpsConfirmation?.length > 0)
  );

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-500/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">Recent Activity</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Latest events requiring attention
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {isLoading ? (
          <ActivitySkeleton />
        ) : hasActivity ? (
          <div className="space-y-2">
            {/* Pending Drivers */}
            {data.pendingDrivers?.slice(0, 2).map((driver) => (
              <ActivityItem
                key={driver.id}
                icon={UserCheck}
                iconColor="bg-amber-500/15 text-amber-500"
                title={driver.user?.fullName || 'Unknown Driver'}
                subtitle={driver.user?.email}
                badge={
                  <Badge variant="outline" className="text-[9px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                    Pending
                  </Badge>
                }
                linkTo="/admin-user-detail"
                linkParams={{ id: driver.id }}
                time={formatDashboardDateTime(driver.createdAt)}
              />
            ))}

            {/* Pending Business Customers */}
            {data.pendingBusinessCustomers?.slice(0, 2).map((customer) => (
              <ActivityItem
                key={customer.id}
                icon={Building2}
                iconColor="bg-purple-500/15 text-purple-500"
                title={customer.businessName || customer.contactName}
                subtitle={customer.contactEmail}
                badge={
                  <Badge variant="outline" className="text-[9px] font-bold bg-purple-50 text-purple-700 border-purple-200">
                    Pending
                  </Badge>
                }
                linkTo="/admin-user-detail"
                linkParams={{ id: customer.id }}
                time={formatDashboardDateTime(customer.createdAt)}
              />
            ))}

            {/* Recent Disputes */}
            {data.recentDisputes?.slice(0, 2).map((dispute) => (
              <ActivityItem
                key={dispute.id}
                icon={AlertTriangle}
                iconColor="bg-red-500/15 text-red-500"
                title={`Dispute: ${dispute.reason?.slice(0, 30)}...`}
                subtitle={dispute.delivery?.customer?.businessName || 'Unknown'}
                badge={
                  <Badge variant="outline" className="text-[9px] font-bold bg-red-50 text-red-700 border-red-200">
                    {dispute.status}
                  </Badge>
                }
                linkTo="/admin-dispute-details"
                linkParams={{ id: dispute.id }}
                time={formatDashboardDateTime(dispute.createdAt)}
              />
            ))}

            {/* Recent Payments */}
            {data.recentPayments?.slice(0, 2).map((payment) => (
              <ActivityItem
                key={payment.id}
                icon={DollarSign}
                iconColor="bg-green-500/15 text-green-500"
                title={formatDashboardCurrency(payment.amount)}
                subtitle={payment.delivery?.customer?.businessName || 'Payment'}
                badge={
                  <Badge variant="outline" className="text-[9px] font-bold bg-green-50 text-green-700 border-green-200">
                    {payment.status}
                  </Badge>
                }
                linkTo="/admin-payments"
                time={formatDashboardDateTime(payment.createdAt)}
              />
            ))}

            {/* Recent Payouts */}
            {data.recentPayouts?.slice(0, 2).map((payout) => (
              <ActivityItem
                key={payout.id}
                icon={Wallet}
                iconColor="bg-teal-500/15 text-teal-500"
                title={formatDashboardCurrency(payout.netAmount)}
                subtitle={payout.driver?.user?.fullName || 'Driver'}
                badge={
                  <Badge variant="outline" className="text-[9px] font-bold bg-teal-50 text-teal-700 border-teal-200">
                    {payout.status}
                  </Badge>
                }
                linkTo="/admin-payments"
                linkParams={{ tab: 'payouts' }}
                time={formatDashboardDateTime(payout.createdAt)}
              />
            ))}

            {/* Deliveries Needing Ops Confirmation */}
            {data.deliveriesNeedingOpsConfirmation?.slice(0, 2).map((delivery) => (
              <ActivityItem
                key={delivery.id}
                icon={Truck}
                iconColor="bg-blue-500/15 text-blue-500"
                title={`${delivery.pickupAddress?.split(',')[0]} → ${delivery.dropoffAddress?.split(',')[0]}`}
                subtitle={delivery.customer?.businessName || 'Delivery'}
                badge={
                  <Badge variant="outline" className="text-[9px] font-bold bg-blue-50 text-blue-700 border-blue-200">
                    Ops Needed
                  </Badge>
                }
                linkTo="/admin-delivery-details"
                linkParams={{ id: delivery.id }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No recent activity</p>
            <p className="text-xs text-slate-400 mt-1">New events will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
