//@ts-nocheck
import React, { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, FileText, FileSpreadsheet, FileType, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { downloadReport } from '@/hooks/useAdminReports'
import { useDataQuery } from '@/lib/tanstack/dataQuery'
import { toast } from 'sonner'

export interface ExportFilterConfig {
  key: string
  label: string
  type: 'text' | 'date' | 'number' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportKey: string
  reportTitle: string
  /** Pre-filled filter values from the parent page */
  currentFilters: Record<string, any>
  /** Config for which filters to show in the dialog */
  filterConfigs?: ExportFilterConfig[]
  /** The API base URL — defaults to import.meta.env.VITE_API_URL */
  apiUrl?: string
}

export default function ExportDialog({
  open,
  onOpenChange,
  reportKey,
  reportTitle,
  currentFilters,
  filterConfigs = [],
  apiUrl,
}: ExportDialogProps) {
  const API_BASE = apiUrl || import.meta.env.VITE_API_URL
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv')
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // Fetch available columns for this report
  const { data: columnsData, isLoading: columnsLoading } = useDataQuery<{
    columns: Array<{ key: string; label: string; type?: string; width?: number }>
  }>({
    apiEndPoint: `${API_BASE}/api/reports/columns/${reportKey}`,
    enabled: open,
    noFilter: true,
  })

  // Initialize filters + columns when dialog opens
  useEffect(() => {
    if (open) {
      // Pre-fill filters from the parent page
      const initial: Record<string, any> = {}
      for (const config of filterConfigs) {
        if (currentFilters[config.key] !== undefined && currentFilters[config.key] !== '') {
          initial[config.key] = currentFilters[config.key]
        }
      }
      setFilters(initial)
      // Select all columns by default
      if (columnsData?.columns) {
        setSelectedColumns(new Set(columnsData.columns.map((c) => c.key)))
      }
    }
  }, [open, columnsData])

  // Update selected columns when data loads
  useEffect(() => {
    if (columnsData?.columns && selectedColumns.size === 0) {
      setSelectedColumns(new Set(columnsData.columns.map((c) => c.key)))
    }
  }, [columnsData])

  // Build the query params for the row count preview
  const countParams = React.useMemo(() => {
    const params: Record<string, any> = { ...filters, format: 'json', page: 1, pageSize: 1 }
    return params
  }, [filters])

  // Fetch row count preview (lightweight — only fetches 1 row + pagination metadata)
  const { data: countData, isLoading: countLoading } = useDataQuery<{
    pagination?: { totalRows?: number }
  }>({
    apiEndPoint: `${API_BASE}/api/reports/${reportKey}?${new URLSearchParams(
      Object.entries(countParams).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null && v !== '') acc[k] = String(v)
        return acc
      }, {} as Record<string, string>)
    ).toString()}`,
    enabled: open,
    noFilter: true,
  })

  const totalRows = countData?.pagination?.totalRows ?? 0
  const selectedCount = selectedColumns.size
  const allColumns = columnsData?.columns ?? []
  const allSelected = selectedCount === allColumns.length

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedColumns(new Set())
    } else {
      setSelectedColumns(new Set(allColumns.map((c) => c.key)))
    }
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleExport = async () => {
    if (selectedCount === 0) {
      toast.error('Select at least one column')
      return
    }

    setIsExporting(true)
    try {
      const params: Record<string, any> = { ...filters }
      // Add columns param (comma-separated keys)
      params.columns = Array.from(selectedColumns).join(',')
      // Don't send page/pageSize — the backend strips pagination for exports

      await downloadReport(reportKey, params, format)
      toast.success(`${reportTitle} downloaded as ${format.toUpperCase()}`)
      onOpenChange(false)
    } catch (error: any) {
      toast.error('Export failed', {
        description: error?.message || 'Please try again.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Export {reportTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure filters, select columns, and choose a format to export the report.
          </DialogDescription>
        </DialogHeader>

        {/* Row count preview */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
          {countLoading ? (
            <span className="text-sm text-slate-500">Counting matching rows…</span>
          ) : (
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              This will export{' '}
              <span className="text-primary">{totalRows.toLocaleString()}</span>{' '}
              row{totalRows !== 1 ? 's' : ''}
              {totalRows > 10000 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  (this may take a moment)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Filters Section */}
        {filterConfigs.length > 0 && (
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Filters
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {filterConfigs.map((config) => (
                <div key={config.key} className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {config.label}
                  </Label>
                  {config.type === 'select' ? (
                    <select
                      value={filters[config.key] ?? ''}
                      onChange={(e) => handleFilterChange(config.key, e.target.value || undefined)}
                      className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">All</option>
                      {config.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={config.type === 'date' ? 'date' : config.type === 'number' ? 'number' : 'text'}
                      value={filters[config.key] ?? ''}
                      onChange={(e) => handleFilterChange(config.key, e.target.value || undefined)}
                      placeholder={config.placeholder}
                      className="h-10 text-sm rounded-xl"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Column Selection Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
              Columns ({selectedCount}/{allColumns.length})
            </Label>
            <button
              onClick={toggleAll}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
            >
              {allSelected ? (
                <><Square className="w-3 h-3" /> Deselect All</>
              ) : (
                <><CheckSquare className="w-3 h-3" /> Select All</>
              )}
            </button>
          </div>
          {columnsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
              {allColumns.map((col) => (
                <label
                  key={col.key}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-sm",
                    selectedColumns.has(col.key)
                      ? "border-primary bg-primary/5 font-bold text-slate-900 dark:text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Checkbox
                    checked={selectedColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <span className="truncate">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
            Format
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFormat('csv')}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition",
                format === 'csv'
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <FileText className={cn("w-5 h-5", format === 'csv' ? "text-primary" : "text-slate-400")} />
              <span className={cn("text-[11px] font-extrabold", format === 'csv' ? "text-primary" : "text-slate-500")}>CSV</span>
            </button>
            <button
              onClick={() => setFormat('xlsx')}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition",
                format === 'xlsx'
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <FileSpreadsheet className={cn("w-5 h-5", format === 'xlsx' ? "text-primary" : "text-slate-400")} />
              <span className={cn("text-[11px] font-extrabold", format === 'xlsx' ? "text-primary" : "text-slate-500")}>Excel</span>
            </button>
            <button
              onClick={() => setFormat('pdf')}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition",
                format === 'pdf'
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <FileType className={cn("w-5 h-5", format === 'pdf' ? "text-primary" : "text-slate-400")} />
              <span className={cn("text-[11px] font-extrabold", format === 'pdf' ? "text-primary" : "text-slate-500")}>PDF</span>
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="rounded-xl font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedCount === 0}
            className="lime-btn rounded-xl font-extrabold gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
