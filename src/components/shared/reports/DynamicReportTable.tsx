// components/shared/reports/DynamicReportTable.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportColumn, DisplayRow, ReportPagination } from '@/types/report';

interface DynamicReportTableProps {
  columns: ReportColumn[];
  displayRows: DisplayRow[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  pagination?: ReportPagination;
  currentPage: number;
  onPageChange: (page: number) => void;
  onRetry?: () => void;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  // Link configuration for clickable cells
  linkConfig?: {
    // Map column key to link configuration
    [columnKey: string]: {
      // Route path
      path: string;
      // Function to get search params from row data
      getSearch: (row: DisplayRow) => Record<string, string>;
    };
  };
  // Column-specific formatters
  formatters?: {
    [columnKey: string]: (value: unknown, row: DisplayRow) => React.ReactNode;
  };
  // Status color mapping
  statusColors?: Record<string, string>;
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  // Delivery statuses
  PENDING: 'bg-slate-50 text-slate-700 border-slate-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  EN_ROUTE_TO_PICKUP: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ARRIVED_AT_PICKUP: 'bg-teal-50 text-teal-700 border-teal-200',
  PICKUP_COMPLETE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EN_ROUTE_TO_DROPOFF: 'bg-green-50 text-green-700 border-green-200',
  ARRIVED_AT_DROPOFF: 'bg-lime-50 text-lime-700 border-lime-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  
  // Dispute statuses
  OPEN: 'bg-rose-50 text-rose-700 border-rose-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-50 text-slate-600 border-slate-200',
  
  // Payment statuses
  AUTHORIZED: 'bg-blue-50 text-blue-700 border-blue-200',
  CAPTURED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  INVOICED: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  REFUNDED: 'bg-purple-50 text-purple-700 border-purple-200',
  
  // Payout statuses
  ELIGIBLE: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
  
  // Tracking statuses
  STARTED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  STOPPED: 'bg-slate-50 text-slate-600 border-slate-200',
};

const DEFAULT_EMPTY_ICON = <AlertCircle className="w-10 h-10 text-slate-300" />;
const DEFAULT_EMPTY_MESSAGE = 'No data found';

export function DynamicReportTable({
  columns,
  displayRows,
  isLoading = false,
  isError = false,
  errorMessage = 'Failed to load report',
  pagination,
  currentPage,
  onPageChange,
  onRetry,
  emptyIcon = DEFAULT_EMPTY_ICON,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  linkConfig,
  formatters,
  statusColors = DEFAULT_STATUS_COLORS,
}: DynamicReportTableProps) {
  
  // Filter visible columns
  const visibleColumns = columns.filter(col => col.visible !== false);
  
  // Default formatter based on column type
  const defaultFormatter = (column: ReportColumn, value: unknown, row: DisplayRow): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    
    switch (column.type) {
      case 'boolean':
        return value ? 'Yes' : 'No';
      
      case 'datetime':
        if (typeof value === 'string') {
          const date = new Date(value);
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
        return String(value);
      
      case 'currency':
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        return isNaN(numValue) ? '—' : `$${numValue.toFixed(2)}`;
      
      case 'miles':
        const milesValue = typeof value === 'number' ? value : parseFloat(String(value));
        return isNaN(milesValue) ? '—' : `${milesValue.toFixed(1)} mi`;
      
      case 'percent':
        const pctValue = typeof value === 'number' ? value : parseFloat(String(value));
        return isNaN(pctValue) ? '—' : `${(pctValue * 100).toFixed(1)}%`;
      
      case 'status':
        const statusStr = String(value);
        return (
          <Badge className={cn('text-[10px] font-bold border', statusColors[statusStr] || 'bg-slate-50 text-slate-600 border-slate-200')}>
            {statusStr.replace(/_/g, ' ')}
          </Badge>
        );
      
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      
      default:
        return String(value);
    }
  };
  
  // Render a cell value
  const renderCell = (column: ReportColumn, row: DisplayRow): React.ReactNode => {
    const value = row[column.key];
    
    // Use custom formatter if provided
    if (formatters && formatters[column.key]) {
      return formatters[column.key](value, row);
    }
    
    // Check if this column should be a link
    if (linkConfig && linkConfig[column.key]) {
      const config = linkConfig[column.key];
      return (
        <Link
          to={config.path}
          search={config.getSearch(row)}
          className="text-sm font-black text-primary hover:underline"
        >
          {defaultFormatter(column, value, row)}
        </Link>
      );
    }
    
    return <span className="text-xs text-slate-600 dark:text-slate-400">{defaultFormatter(column, value, row)}</span>;
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  
  // Error state
  if (isError) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-rose-700 dark:text-rose-300 font-bold">{errorMessage}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 px-4 py-2 text-sm border rounded-xl hover:bg-slate-50">
            Try Again
          </button>
        )}
      </div>
    );
  }
  
  // Empty state
  if (displayRows.length === 0) {
    return (
      <div className="p-8 text-center">
        {emptyIcon}
        <p className="text-slate-600 dark:text-slate-400 font-medium mt-3">{emptyMessage}</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              {visibleColumns.map(column => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left"
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                {visibleColumns.map(column => (
                  <td key={column.key} className="px-4 py-3">
                    {renderCell(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.totalRows)} of {pagination.totalRows}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs border rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">
              Page {currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pagination.totalPages}
              className="px-3 py-1.5 text-xs border rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default DynamicReportTable;
