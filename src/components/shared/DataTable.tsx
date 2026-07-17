//@ts-nocheck
import React, { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Eye } from 'lucide-react'

interface DataTableProps {
  columns: ColumnDef<any, any>[]
  data: any[]
  isLoading?: boolean
  isError?: boolean
  // Server-side pagination
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
  onPageChange: (page: number) => void
  // Server-side sorting
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  // Empty state
  emptyMessage?: string
}

export function DataTable({
  columns,
  data,
  isLoading,
  isError,
  page,
  pageSize,
  totalRows,
  totalPages,
  onPageChange,
  sortBy,
  sortOrder,
  onSortChange,
  emptyMessage = 'No data found.',
}: DataTableProps) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    // Load saved column widths from localStorage. Versioned key — bump the
    // suffix when column definitions change to invalidate stale widths.
    try {
      const saved = localStorage.getItem('insurance-portal-column-widths-v2')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [columnVisibility, setColumnVisibility] = useState({})
  const [showColumnToggle, setShowColumnToggle] = useState(false)

  // Save column widths to localStorage when they change
  const handleColumnSizingChange = (updater: any) => {
    setColumnSizing((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem('insurance-portal-column-widths-v2', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      columnSizing,
      columnVisibility,
    },
    onColumnSizingChange: handleColumnSizingChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    // Column resizing config
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    // Sorting is server-side — we don't use getSortedRowModel
    manualSorting: true,
  })

  const handleHeaderClick = (column: any) => {
    if (!onSortChange || !column.columnDef.meta?.sortable) return
    const colKey = column.columnDef.meta?.sortKey || column.id
    if (sortBy === colKey) {
      onSortChange(colKey, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      onSortChange(colKey, 'desc')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError) {
    return <div className="text-center py-16 text-slate-500">Failed to load data. Please try refreshing.</div>
  }

  if (!data || data.length === 0) {
    return <div className="text-center py-16 text-slate-500">{emptyMessage}</div>
  }

  return (
    <div className="w-full">
      {/* Column visibility toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs text-slate-500">
          {totalRows.toLocaleString()} row{totalRows !== 1 ? 's' : ''} total
        </span>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5 h-8"
            onClick={() => setShowColumnToggle(!showColumnToggle)}
          >
            <Eye className="w-3.5 h-3.5" />
            Columns
          </Button>
          {showColumnToggle && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColumnToggle(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-[300px] overflow-y-auto p-2">
                {table.getAllLeafColumns().map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={(e) => column.toggleVisibility(!!e.target.checked)}
                      className="w-4 h-4 rounded accent-lime-500"
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      {column.columnDef.meta?.label || column.id}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table — horizontal scroll when columns overflow container.
          tableLayout:auto lets the browser size columns by their declared
          `size`, and they keep that width even if the total exceeds the
          container (the wrapper scrolls instead of collapsing columns). */}
      <div className="overflow-x-auto">
        <table
          className="text-xs whitespace-nowrap"
          style={{ tableLayout: 'auto', width: 'max-content', minWidth: '100%' }}
        >
          <colgroup>
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <col
                key={header.id}
                style={{ width: header.getSize() }}
              />
            ))}
          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.columnDef.meta?.sortable
                  const colKey = header.column.columnDef.meta?.sortKey || header.column.id
                  const isSorted = sortBy === colKey
                  return (
                    <th
                      key={header.id}
                      onClick={() => handleHeaderClick(header.column)}
                      className={cn(
                        "px-3 py-3 text-left font-black uppercase tracking-wider text-slate-400 relative group select-none",
                        isSortable && "cursor-pointer hover:text-slate-600 dark:hover:text-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isSortable && (
                          isSorted ? (
                            sortOrder === 'asc'
                              ? <ChevronUp className="w-3 h-3 text-primary" />
                              : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                          )
                        )}
                      </div>
                      {/* Resize handle */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            header.column.getIsResizing() && "opacity-100 bg-primary"
                          )}
                        >
                          <div className="h-full w-0.5 mx-auto bg-slate-300 dark:bg-slate-600 group-hover:bg-primary/50" />
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50",
                  rowIndex % 2 === 1 && "bg-slate-50/50 dark:bg-slate-900/30"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-3 text-slate-600 dark:text-slate-400 align-top"
                  >
                    <div className="whitespace-normal break-words">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs text-slate-500">
          Showing {((page - 1) * pageSize) + 1} – {Math.min(page * pageSize, totalRows)} of {totalRows.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1} className="rounded-xl">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="rounded-xl">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
