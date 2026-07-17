// components/shared/reports/InsuranceReportTable.tsx
//
// Single shared per-ride report table used by BOTH:
//   - src/components/pages/insurance-portal.tsx (carrier portal)
//   - src/components/pages/admin-insurance-reporting.tsx (admin internal)
//
// Wraps the generic DataTable with the canonical 7-column insurance spec
// (Driver ID, Ride ID, Start Time, End Time, Start Location, End Location,
// Miles) plus server-side pagination + sorting.

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/DataTable';
import { INSURANCE_REPORT_COLUMNS } from './insuranceReportColumns';

export interface InsuranceReportTableProps {
  /** The report payload from the backend. Reads `displayRows` (preferred) or `rows`. */
  data: any;
  isLoading: boolean;
  isError: boolean;
  /** Current page (1-indexed). */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Active sort key — must match a `sortKey` in the column meta. */
  sortBy: string;
  /** Active sort direction. */
  sortOrder: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  emptyMessage?: string;
}

export function InsuranceReportTable({
  data,
  isLoading,
  isError,
  page,
  pageSize,
  sortBy,
  sortOrder,
  onPageChange,
  onSortChange,
  emptyMessage = 'No tracking sessions found for the selected filters.',
}: InsuranceReportTableProps) {
  const rows = data?.displayRows || data?.rows || [];
  const totalRows = data?.pagination?.totalRows ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
      <CardContent className="p-0">
        <DataTable
          columns={INSURANCE_REPORT_COLUMNS}
          data={rows}
          isLoading={isLoading}
          isError={isError}
          page={page}
          pageSize={pageSize}
          totalRows={totalRows}
          totalPages={totalPages}
          onPageChange={onPageChange}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          emptyMessage={emptyMessage}
        />
      </CardContent>
    </Card>
  );
}

export default InsuranceReportTable;
