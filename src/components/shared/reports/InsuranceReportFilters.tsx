// components/shared/reports/InsuranceReportFilters.tsx
//
// Single shared filter card for the per-ride insurance report.
// Used by BOTH:
//   - src/components/pages/insurance-portal.tsx (carrier portal)
//   - src/components/pages/admin-insurance-reporting.tsx (admin internal)
//
// The filter set mirrors what the dealer-side insurance portal already had:
// Date From / Date To, Status, Service Type, Customer, Driver, Min/Max Miles,
// Min/Max Payment, Pickup Address — PLUS Sort By / Order (useful on both pages
// and required so the admin's existing period-aggregation table can keep
// using groupBy=month under the hood).
//
// The parent owns the state and passes the values + setters down. The parent
// is also responsible for resetting to page 1 when a filter changes.

import React from 'react';
import { Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect, type SearchableSelectItem } from './SearchableSelect';

export interface InsuranceReportFiltersState {
  dateFrom: string;
  dateTo: string;
  statusFilter: string;
  serviceType: string;
  customerId: string;
  driverId: string;
  minMiles: string;
  maxMiles: string;
  minPayment: string;
  maxPayment: string;
  pickupSearch: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface InsuranceReportFiltersProps {
  /** Current filter values. */
  filters: InsuranceReportFiltersState;
  /**
   * Called with a partial update whenever a filter changes. The parent is
   * responsible for merging into state and resetting pagination to page 1.
   */
  onFiltersChange: (updates: Partial<InsuranceReportFiltersState>) => void;
  /** Reset every filter to its default. */
  onReset: () => void;
  /** Customers shown in the customer dropdown. Pass [] if not yet loaded. */
  customers: SearchableSelectItem[];
  /** Drivers shown in the driver dropdown. Pass [] if not yet loaded. */
  drivers: SearchableSelectItem[];
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function InsuranceReportFilters({
  filters,
  onFiltersChange,
  onReset,
  customers,
  drivers,
}: InsuranceReportFiltersProps) {
  const set = <K extends keyof InsuranceReportFiltersState>(
    key: K,
    value: InsuranceReportFiltersState[K]
  ) => {
    onFiltersChange({ [key]: value } as Partial<InsuranceReportFiltersState>);
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filters
          </span>
          <button
            onClick={onReset}
            className="text-[11px] font-bold text-primary hover:underline"
          >
            Reset All
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <FilterField label="Date From">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
              className="h-9 text-sm rounded-xl"
            />
          </FilterField>
          <FilterField label="Date To">
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
              className="h-9 text-sm rounded-xl"
            />
          </FilterField>
          <FilterField label="Status">
            <select
              value={filters.statusFilter}
              onChange={(e) => set('statusFilter', e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="">All</option>
              <option value="COMPLETED">Completed</option>
              <option value="ACTIVE">Active</option>
              <option value="BOOKED">Booked</option>
              <option value="CLOSED">Closed by Dealer</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </FilterField>
          <FilterField label="Service Type">
            <select
              value={filters.serviceType}
              onChange={(e) => set('serviceType', e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="">All</option>
              <option value="HOME_DELIVERY">Home Delivery</option>
              <option value="BETWEEN_LOCATIONS">Between Locations</option>
              <option value="SERVICE_PICKUP_RETURN">Service Pickup/Return</option>
            </select>
          </FilterField>
          <FilterField label="Customer">
            <SearchableSelect
              items={customers}
              value={filters.customerId}
              onChange={(id) => set('customerId', id)}
              placeholder="All Customers"
            />
          </FilterField>
          <FilterField label="Driver">
            <SearchableSelect
              items={drivers}
              value={filters.driverId}
              onChange={(id) => set('driverId', id)}
              placeholder="All Drivers"
            />
          </FilterField>
          <FilterField label="Min Miles">
            <Input
              type="number"
              value={filters.minMiles}
              onChange={(e) => set('minMiles', e.target.value)}
              placeholder="0"
              className="h-9 text-sm rounded-xl"
            />
          </FilterField>
          <FilterField label="Max Miles">
            <Input
              type="number"
              value={filters.maxMiles}
              onChange={(e) => set('maxMiles', e.target.value)}
              placeholder="9999"
              className="h-9 text-sm rounded-xl"
            />
          </FilterField>
          <FilterField label="Min Payment ($)">
            <Input
              type="number"
              value={filters.minPayment}
              onChange={(e) => set('minPayment', e.target.value)}
              placeholder="0"
              className="h-9 text-sm rounded-xl"
            />
          </FilterField>
          <FilterField label="Max Payment ($)">
            <Input
              type="number"
              value={filters.maxPayment}
              onChange={(e) => set('maxPayment', e.target.value)}
              placeholder="9999"
              className="h-9 text-sm rounded-xl"
            />
          </FilterField>
          <FilterField label="Pickup Address">
            <Input
              value={filters.pickupSearch}
              onChange={(e) => set('pickupSearch', e.target.value)}
              placeholder="e.g. Los Angeles"
              className="h-9 text-sm rounded-xl"
            />
          </FilterField>
          <FilterField label="Sort By">
            <select
              value={filters.sortBy}
              onChange={(e) => set('sortBy', e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="startedAt">Start Time</option>
              <option value="stoppedAt">End Time</option>
              <option value="drivenMiles">Miles</option>
              <option value="createdAt">Created Date</option>
            </select>
          </FilterField>
          <FilterField label="Order">
            <select
              value={filters.sortOrder}
              onChange={(e) =>
                set('sortOrder', e.target.value as 'asc' | 'desc')
              }
              className="w-full h-9 px-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </FilterField>
        </div>
      </CardContent>
    </Card>
  );
}

export default InsuranceReportFilters;
