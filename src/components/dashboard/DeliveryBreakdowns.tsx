// components/dashboard/DeliveryBreakdowns.tsx
import React from 'react';
import {
  PieChart,
  Building2,
  User,
  Home,
  MapPin,
  Wrench,
  Car,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DeliveryBreakdowns as DeliveryBreakdownsType } from '@/types/dashboard';

interface DeliveryBreakdownsProps {
  data: DeliveryBreakdownsType | undefined;
  isLoading: boolean;
}

interface BreakdownItemProps {
  icon: React.ElementType;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

function BreakdownItem({ icon: Icon, label, value, percentage, color }: BreakdownItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          color
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</p>
          <p className="text-xs font-black text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', color.replace('bg-', 'bg-').replace('/15', ''))}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function DeliveryBreakdowns({ data, isLoading }: DeliveryBreakdownsProps) {
  const totalByCustomerType = (data?.byCustomerType?.private || 0) + (data?.byCustomerType?.business || 0);
  const totalByServiceType = 
    (data?.byServiceType?.homeDelivery || 0) + 
    (data?.byServiceType?.betweenLocations || 0) + 
    (data?.byServiceType?.servicePickupReturn || 0);

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <PieChart className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">Delivery Breakdown</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Distribution by type and service
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-24 mb-2" />
                {[1, 2].map((j) => (
                  <Skeleton key={j} className="h-10 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Customer Type */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                By Customer Type
              </p>
              <div className="space-y-3">
                <BreakdownItem
                  icon={Building2}
                  label="Business"
                  value={data.byCustomerType?.business || 0}
                  percentage={totalByCustomerType > 0 ? ((data.byCustomerType?.business || 0) / totalByCustomerType) * 100 : 0}
                  color="bg-purple-500/15 text-purple-500"
                />
                <BreakdownItem
                  icon={User}
                  label="Private"
                  value={data.byCustomerType?.private || 0}
                  percentage={totalByCustomerType > 0 ? ((data.byCustomerType?.private || 0) / totalByCustomerType) * 100 : 0}
                  color="bg-blue-500/15 text-blue-500"
                />
              </div>
            </div>

            {/* By Service Type */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                By Service Type
              </p>
              <div className="space-y-3">
                <BreakdownItem
                  icon={Home}
                  label="Home Delivery"
                  value={data.byServiceType?.homeDelivery || 0}
                  percentage={totalByServiceType > 0 ? ((data.byServiceType?.homeDelivery || 0) / totalByServiceType) * 100 : 0}
                  color="bg-green-500/15 text-green-500"
                />
                <BreakdownItem
                  icon={MapPin}
                  label="Between Locations"
                  value={data.byServiceType?.betweenLocations || 0}
                  percentage={totalByServiceType > 0 ? ((data.byServiceType?.betweenLocations || 0) / totalByServiceType) * 100 : 0}
                  color="bg-amber-500/15 text-amber-500"
                />
                <BreakdownItem
                  icon={Wrench}
                  label="Service Pickup/Return"
                  value={data.byServiceType?.servicePickupReturn || 0}
                  percentage={totalByServiceType > 0 ? ((data.byServiceType?.servicePickupReturn || 0) / totalByServiceType) * 100 : 0}
                  color="bg-teal-500/15 text-teal-500"
                />
              </div>
            </div>

            {/* By Created By Role */}
            {data.byCreatedByRole && Object.keys(data.byCreatedByRole).length > 0 && (
              <div className="md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Created By
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.byCreatedByRole).map(([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
                    >
                      <span className="font-semibold text-slate-600 dark:text-slate-400 capitalize">
                        {role.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PieChart className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No breakdown data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
