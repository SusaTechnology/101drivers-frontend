// components/dashboard/DeliveryBreakdowns.tsx
import React, { useState } from 'react';
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
import { ViewSwitcher } from './ViewSwitcher';
import type { ViewType } from './ViewSwitcher';
import { DonutChart, MiniDonut } from './DonutChart';
import { BarChart } from './BarChart';
import type { DeliveryBreakdowns as DeliveryBreakdownsType } from '@/types/dashboard';

interface DeliveryBreakdownsProps {
  data: DeliveryBreakdownsType | undefined;
  isLoading: boolean;
}

// Colors for charts
const COLORS = {
  business: '#8b5cf6',
  private: '#3b82f6',
  homeDelivery: '#22c55e',
  betweenLocations: '#f59e0b',
  servicePickupReturn: '#14b8a6',
};

interface BreakdownItemProps {
  icon: React.ElementType;
  label: string;
  value: number;
  percentage: number;
  color: string;
  colorSolid: string;
}

function BreakdownItem({ icon: Icon, label, value, percentage, color, colorSolid }: BreakdownItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
          color
        )}
      >
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">{label}</p>
          <p className="text-[10px] font-black text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: colorSolid }}
          />
        </div>
      </div>
    </div>
  );
}

export function DeliveryBreakdowns({ data, isLoading }: DeliveryBreakdownsProps) {
  const [view, setView] = useState<ViewType>('donut');

  const totalByCustomerType = (data?.byCustomerType?.private || 0) + (data?.byCustomerType?.business || 0);
  const totalByServiceType = 
    (data?.byServiceType?.homeDelivery || 0) + 
    (data?.byServiceType?.betweenLocations || 0) + 
    (data?.byServiceType?.servicePickupReturn || 0);

  // Chart data
  const customerTypeData = [
    { label: 'Business', value: data?.byCustomerType?.business || 0, color: COLORS.business },
    { label: 'Private', value: data?.byCustomerType?.private || 0, color: COLORS.private },
  ];

  const serviceTypeData = [
    { label: 'Home Delivery', value: data?.byServiceType?.homeDelivery || 0, color: COLORS.homeDelivery },
    { label: 'Between Locations', value: data?.byServiceType?.betweenLocations || 0, color: COLORS.betweenLocations },
    { label: 'Service Pickup', value: data?.byServiceType?.servicePickupReturn || 0, color: COLORS.servicePickupReturn },
  ];

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-md">
      <CardHeader className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-sm">
              <PieChart className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-black">Delivery Breakdown</CardTitle>
              <CardDescription className="text-[10px] mt-0.5">
                Distribution by type and service
              </CardDescription>
            </div>
          </div>
          <ViewSwitcher value={view} onChange={setView} />
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20 mb-1" />
                {[1, 2].map((j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Customer Type */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                By Customer Type
              </p>
              
              {view === 'donut' && (
                <DonutChart
                  data={customerTypeData}
                  size={100}
                  thickness={16}
                  centerValue={totalByCustomerType}
                  centerLabel="Total"
                  showLegend
                  className="py-1"
                />
              )}
              
              {view === 'bar' && (
                <BarChart
                  data={customerTypeData}
                  barHeight={20}
                  maxValue={totalByCustomerType}
                  className="py-1"
                />
              )}
              
              {view === 'table' && (
                <div className="space-y-1.5">
                  <BreakdownItem
                    icon={Building2}
                    label="Business"
                    value={data.byCustomerType?.business || 0}
                    percentage={totalByCustomerType > 0 ? ((data.byCustomerType?.business || 0) / totalByCustomerType) * 100 : 0}
                    color="bg-purple-500/15 text-purple-500"
                    colorSolid={COLORS.business}
                  />
                  <BreakdownItem
                    icon={User}
                    label="Private"
                    value={data.byCustomerType?.private || 0}
                    percentage={totalByCustomerType > 0 ? ((data.byCustomerType?.private || 0) / totalByCustomerType) * 100 : 0}
                    color="bg-blue-500/15 text-blue-500"
                    colorSolid={COLORS.private}
                  />
                </div>
              )}
            </div>

            {/* By Service Type */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                By Service Type
              </p>
              
              {view === 'donut' && (
                <DonutChart
                  data={serviceTypeData}
                  size={100}
                  thickness={16}
                  centerValue={totalByServiceType}
                  centerLabel="Total"
                  showLegend
                  className="py-1"
                />
              )}
              
              {view === 'bar' && (
                <BarChart
                  data={serviceTypeData}
                  barHeight={20}
                  maxValue={totalByServiceType}
                  className="py-1"
                />
              )}
              
              {view === 'table' && (
                <div className="space-y-1.5">
                  <BreakdownItem
                    icon={Home}
                    label="Home Delivery"
                    value={data.byServiceType?.homeDelivery || 0}
                    percentage={totalByServiceType > 0 ? ((data.byServiceType?.homeDelivery || 0) / totalByServiceType) * 100 : 0}
                    color="bg-green-500/15 text-green-500"
                    colorSolid={COLORS.homeDelivery}
                  />
                  <BreakdownItem
                    icon={MapPin}
                    label="Between Locations"
                    value={data.byServiceType?.betweenLocations || 0}
                    percentage={totalByServiceType > 0 ? ((data.byServiceType?.betweenLocations || 0) / totalByServiceType) * 100 : 0}
                    color="bg-amber-500/15 text-amber-500"
                    colorSolid={COLORS.betweenLocations}
                  />
                  <BreakdownItem
                    icon={Wrench}
                    label="Service Pickup"
                    value={data.byServiceType?.servicePickupReturn || 0}
                    percentage={totalByServiceType > 0 ? ((data.byServiceType?.servicePickupReturn || 0) / totalByServiceType) * 100 : 0}
                    color="bg-teal-500/15 text-teal-500"
                    colorSolid={COLORS.servicePickupReturn}
                  />
                </div>
              )}
            </div>

            {/* By Created By Role */}
            {data.byCreatedByRole && Object.keys(data.byCreatedByRole).length > 0 && (
              <div className="md:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Created By
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.byCreatedByRole).map(([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800"
                    >
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 capitalize">
                        {role.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-900 dark:text-white">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <PieChart className="w-6 h-6 text-slate-300 mb-1" />
            <p className="text-xs text-slate-500">No breakdown data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
