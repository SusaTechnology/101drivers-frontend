// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken, useDataQuery } from '@/lib/tanstack/dataQuery'
import { useCustomerLookup } from '@/hooks/useAdminDashboard'
import { useDriverLookup, useDeliveryLookup, useUserLookup } from '@/hooks/useAdminDeliveries'
import { useDebouncedValue } from '@/hooks/useDebounce'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  History,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  Search,
  RefreshCw,
  User,
  Building2,
  Truck,
  Package,
  Settings,
  Shield,
  AlertCircle,
  Clock,
  Eye,
  FileJson,
  Activity,
  Database,
  Zap,
  Users,
  BarChart3,
  CreditCard,
  Gavel,
  Bell,
  TrendingUp as PriceChange,
  Calendar as CalendarMonth,
  SlidersHorizontal as Tune,
  ChevronLeft,
  ChevronRight,
  Filter,
  XCircle,
  DollarSign,
  Ban,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

// Types
type AuditAction = 
  | 'USER_DISABLE' | 'USER_ENABLE' | 'DEALER_APPROVE' | 'DEALER_REJECT'
  | 'DRIVER_APPROVE' | 'DRIVER_SUSPEND' | 'DRIVER_UNSUSPEND'
  | 'DELIVERY_CANCEL' | 'DELIVERY_REASSIGN' | 'PRICING_UPDATE'
  | 'POLICY_UPDATE' | 'DISPUTE_UPDATE' | 'PAYMENT_OVERRIDE'
  | 'PAYOUT_OVERRIDE' | 'OTHER'

type ActorType = 'USER' | 'SYSTEM'

interface AuditLog {
  id: string
  action: AuditAction
  actorType: ActorType
  beforeJson: any
  afterJson: any
  reason: string | null
  createdAt: string
  updatedAt: string
  actor: { id: string } | null
  customer: { id: string } | null
  delivery: { id: string } | null
  driver: { id: string } | null
  user: { id: string } | null
}

interface AuditLogSearchRequest {
  where?: {
    action?: AuditAction
    actionIn?: AuditAction[]
    actorType?: ActorType
    actorTypeIn?: ActorType[]
    actorUserId?: string
    customerId?: string
    deliveryId?: string
    driverId?: string
    userId?: string
    reason?: string
    reasonContains?: string
    createdFrom?: string
    createdTo?: string
    updatedFrom?: string
    updatedTo?: string
  }
  orderBy?: {
    createdAt?: 'asc' | 'desc'
    updatedAt?: 'asc' | 'desc'
    action?: 'asc' | 'desc'
    actorType?: 'asc' | 'desc'
    reason?: 'asc' | 'desc'
  }
  skip?: number
  take?: number
}

// Format date/time
const formatDateTime = (dateString: string) => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Action type config
const ACTION_CONFIG: Record<AuditAction, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  USER_DISABLE: { 
    label: 'User Disabled', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', 
    icon: <Ban className="h-3 w-3" />,
    description: 'User account disabled'
  },
  USER_ENABLE: { 
    label: 'User Enabled', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', 
    icon: <CheckCircle className="h-3 w-3" />,
    description: 'User account enabled'
  },
  DEALER_APPROVE: { 
    label: 'Dealer Approved', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', 
    icon: <CheckCircle className="h-3 w-3" />,
    description: 'Dealer application approved'
  },
  DEALER_REJECT: { 
    label: 'Dealer Rejected', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', 
    icon: <XCircle className="h-3 w-3" />,
    description: 'Dealer application rejected'
  },
  DRIVER_APPROVE: { 
    label: 'Driver Approved', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', 
    icon: <Truck className="h-3 w-3" />,
    description: 'Driver application approved'
  },
  DRIVER_SUSPEND: { 
    label: 'Driver Suspended', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', 
    icon: <Ban className="h-3 w-3" />,
    description: 'Driver account suspended'
  },
  DRIVER_UNSUSPEND: { 
    label: 'Driver Unsuspended', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', 
    icon: <CheckCircle className="h-3 w-3" />,
    description: 'Driver suspension lifted'
  },
  DELIVERY_CANCEL: { 
    label: 'Delivery Cancelled', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', 
    icon: <Package className="h-3 w-3" />,
    description: 'Delivery was cancelled'
  },
  DELIVERY_REASSIGN: { 
    label: 'Delivery Reassigned', 
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', 
    icon: <ArrowRight className="h-3 w-3" />,
    description: 'Delivery reassigned to another driver'
  },
  PRICING_UPDATE: { 
    label: 'Pricing Update', 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', 
    icon: <DollarSign className="h-3 w-3" />,
    description: 'Pricing configuration updated'
  },
  POLICY_UPDATE: { 
    label: 'Policy Update', 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', 
    icon: <Settings className="h-3 w-3" />,
    description: 'System policy updated'
  },
  DISPUTE_UPDATE: { 
    label: 'Dispute Update', 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', 
    icon: <AlertTriangle className="h-3 w-3" />,
    description: 'Dispute status or details updated'
  },
  PAYMENT_OVERRIDE: { 
    label: 'Payment Override', 
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300', 
    icon: <DollarSign className="h-3 w-3" />,
    description: 'Payment was manually overridden'
  },
  PAYOUT_OVERRIDE: { 
    label: 'Payout Override', 
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', 
    icon: <DollarSign className="h-3 w-3" />,
    description: 'Payout was manually overridden'
  },
  OTHER: { 
    label: 'Other', 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300', 
    icon: <Activity className="h-3 w-3" />,
    description: 'Other system action'
  },
}

const getActionConfig = (action: AuditAction) => {
  return ACTION_CONFIG[action] || ACTION_CONFIG.OTHER
}

// Actor type config
const ACTOR_TYPE_CONFIG: Record<ActorType, { label: string; color: string }> = {
  USER: { label: 'Admin User', color: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' },
  SYSTEM: { label: 'System', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
}

const getActorTypeConfig = (actorType: ActorType) => {
  return ACTOR_TYPE_CONFIG[actorType] || { label: actorType || 'Unknown', color: 'bg-slate-100 text-slate-800' }
}

// Deep compare two values and get the difference type
type DiffType = 'added' | 'removed' | 'changed' | 'unchanged' | 'nested'

interface DiffResult {
  type: DiffType
  before?: any
  after?: any
  children?: Record<string, DiffResult>
  arrayChanges?: ArrayDiffItem[]
}

interface ArrayDiffItem {
  index: number
  type: 'added' | 'removed' | 'changed' | 'moved'
  before?: any
  after?: any
  key?: string // For matching items by ID
}

// Helper to find a matching key for array items (like 'id', 'category', etc.)
const findArrayItemKey = (arr: any[]): string | null => {
  if (!arr.length) return null
  const sample = arr[0]
  if (typeof sample !== 'object' || !sample) return null
  
  // Common unique keys to look for
  const candidateKeys = ['id', 'category', 'name', 'code', 'key']
  for (const key of candidateKeys) {
    if (sample[key] !== undefined) return key
  }
  return null
}

// Deep diff function
const deepDiff = (before: any, after: any): DiffResult => {
  // Both null/undefined
  if (before === null || before === undefined) {
    if (after === null || after === undefined) {
      return { type: 'unchanged', before, after }
    }
    return { type: 'added', before, after }
  }
  if (after === null || after === undefined) {
    return { type: 'removed', before, after }
  }

  // Primitive comparison
  if (typeof before !== 'object' || typeof after !== 'object') {
    if (before === after) {
      return { type: 'unchanged', before, after }
    }
    return { type: 'changed', before, after }
  }

  // Both arrays
  if (Array.isArray(before) && Array.isArray(after)) {
    const itemKey = findArrayItemKey([...before, ...after])
    const arrayChanges: ArrayDiffItem[] = []

    if (itemKey) {
      // Match by key (e.g., id, category)
      const beforeMap = new Map(before.map((item, i) => [item[itemKey], { item, index: i }]))
      const afterMap = new Map(after.map((item, i) => [item[itemKey], { item, index: i }]))
      
      const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()])
      
      allKeys.forEach(key => {
        const beforeEntry = beforeMap.get(key)
        const afterEntry = afterMap.get(key)
        
        if (!beforeEntry) {
          arrayChanges.push({ type: 'added', index: afterEntry!.index, after: afterEntry!.item, key: String(key) })
        } else if (!afterEntry) {
          arrayChanges.push({ type: 'removed', index: beforeEntry.index, before: beforeEntry.item, key: String(key) })
        } else {
          const diff = deepDiff(beforeEntry.item, afterEntry.item)
          if (diff.type !== 'unchanged') {
            arrayChanges.push({ 
              type: 'changed', 
              index: afterEntry.index, 
              before: beforeEntry.item, 
              after: afterEntry.item,
              key: String(key)
            })
          }
        }
      })
    } else {
      // No key, compare by index
      const maxLen = Math.max(before.length, after.length)
      for (let i = 0; i < maxLen; i++) {
        if (i >= before.length) {
          arrayChanges.push({ type: 'added', index: i, after: after[i] })
        } else if (i >= after.length) {
          arrayChanges.push({ type: 'removed', index: i, before: before[i] })
        } else {
          const diff = deepDiff(before[i], after[i])
          if (diff.type !== 'unchanged') {
            arrayChanges.push({ type: 'changed', index: i, before: before[i], after: after[i] })
          }
        }
      }
    }

    if (arrayChanges.length === 0) {
      return { type: 'unchanged', before, after }
    }
    return { type: 'nested', before, after, arrayChanges }
  }

  // Both objects
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  const children: Record<string, DiffResult> = {}
  let hasChanges = false

  allKeys.forEach(key => {
    const childDiff = deepDiff(before[key], after[key])
    children[key] = childDiff
    if (childDiff.type !== 'unchanged') {
      hasChanges = true
    }
  })

  if (!hasChanges) {
    return { type: 'unchanged', before, after }
  }
  return { type: 'nested', before, after, children }
}

// Dynamic JSON Renderer Component
const JsonRenderer = ({ data, depth = 0, compact = false }: { data: any; depth?: number; compact?: boolean }) => {
  if (data === null) return <span className="text-slate-400 italic">null</span>
  if (data === undefined) return <span className="text-slate-400 italic">undefined</span>
  if (typeof data === 'boolean') return <span className={data ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>{data.toString()}</span>
  if (typeof data === 'number') return <span className="text-blue-600 dark:text-blue-400 font-medium">{data}</span>

  if (typeof data === 'string') {
    if (data.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return <span className="text-orange-600 dark:text-orange-400" title={formatDateTime(data)}>"{formatDateTime(data)}"</span>
    }
    if (data.length > 20 && data.match(/^[a-z0-9]+$/)) {
      return <span className="text-purple-600 dark:text-purple-400 font-mono text-xs" title={data}>"{data.slice(0, 8)}...{data.slice(-4)}"</span>
    }
    if (compact && data.length > 30) {
      return <span className="text-emerald-600 dark:text-emerald-400" title={data}>"{data.slice(0, 30)}..."</span>
    }
    return <span className="text-emerald-600 dark:text-emerald-400">"{data}"</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-slate-400">[]</span>
    if (compact) return <span className="text-slate-500">[{data.length} items]</span>
    return (
      <div className={cn("space-y-1", depth > 0 && "ml-4 pl-3 border-l-2 border-slate-200 dark:border-slate-700")}>
        <span className="text-slate-500">[</span>
        {data.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-slate-400 text-xs min-w-[20px]">{index}:</span>
            <JsonRenderer data={item} depth={depth + 1} />
          </div>
        ))}
        <span className="text-slate-500">]</span>
      </div>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data)
    if (keys.length === 0) return <span className="text-slate-400">{'{}'}</span>
    if (compact && keys.length > 3) {
      return <span className="text-slate-500">{'{ '}{keys.slice(0, 3).join(', ')}{' ... }'}</span>
    }
    return (
      <div className={cn("space-y-1", depth > 0 && "ml-4 pl-3 border-l-2 border-slate-200 dark:border-slate-700")}>
        <span className="text-slate-500">{'{'}</span>
        {keys.map((key) => (
          <div key={key} className="flex items-start gap-2 flex-wrap">
            <span className="text-violet-600 dark:text-violet-400 font-medium min-w-[80px]">{key}:</span>
            <JsonRenderer data={data[key]} depth={depth + 1} />
          </div>
        ))}
        <span className="text-slate-500">{'}'}</span>
      </div>
    )
  }

  return <span className="text-slate-600 dark:text-slate-400">{String(data)}</span>
}

// Field label formatter with better labels for common fields
const formatFieldLabel = (key: string): string => {
  const labelMap: Record<string, string> = {
    // User fields
    fullName: 'Full Name',
    email: 'Email Address',
    phone: 'Phone Number',
    username: 'Username',
    isActive: 'Active Status',
    roles: 'User Roles',
    disabledAt: 'Disabled At',
    disabledReason: 'Disabled Reason',
    
    // Pricing fields
    pricingMode: 'Pricing Mode',
    baseFee: 'Base Fee',
    perMileRate: 'Per Mile Rate',
    insuranceFee: 'Insurance Fee',
    transactionFeePct: 'Transaction Fee %',
    transactionFeeFixed: 'Fixed Transaction Fee',
    feePassThrough: 'Fee Pass Through',
    driverSharePct: 'Driver Share %',
    activateAsDefault: 'Set as Default',
    
    // Delivery fields
    status: 'Delivery Status',
    pickupAddress: 'Pickup Address',
    dropoffAddress: 'Dropoff Address',
    scheduledAt: 'Scheduled Time',
    canceledAt: 'Canceled At',
    cancelReason: 'Cancel Reason',
    driverId: 'Driver ID',
    
    // Common fields
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    id: 'ID',
    name: 'Name',
    description: 'Description',
    reason: 'Reason',
    note: 'Note',
  }
  
  if (labelMap[key]) return labelMap[key]
  
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Id$/g, 'ID')
    .replace(/Pct$/g, '%')
    .trim()
}

// Check if value is a "system" field that should be hidden by default
const isSystemField = (key: string): boolean => {
  return ['createdAt', 'updatedAt', 'id', 'pricingConfigId'].includes(key)
}

// Recursive Diff Item Component
const DiffItem = ({ 
  label, 
  diff, 
  depth = 0,
  showUnchanged = false 
}: { 
  label: string
  diff: DiffResult
  depth?: number
  showUnchanged?: boolean
}) => {
  const [expanded, setExpanded] = useState(depth < 2)
  
  if (diff.type === 'unchanged' && !showUnchanged) return null

  // Get badge for diff type
  const getBadge = () => {
    switch (diff.type) {
      case 'changed':
        return <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">Changed</Badge>
      case 'added':
        return <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300">Added</Badge>
      case 'removed':
        return <Badge variant="outline" className="text-[10px] bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300">Removed</Badge>
      case 'nested':
        return <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400">{diff.arrayChanges?.length || Object.keys(diff.children || {}).filter(k => diff.children![k].type !== 'unchanged').length} changes</Badge>
      default:
        return null
    }
  }

  // Render based on diff type
  const renderContent = () => {
    if (diff.type === 'unchanged') {
      return (
        <div className="text-xs text-slate-500">
          <JsonRenderer data={diff.after} compact />
        </div>
      )
    }

    if (diff.type === 'added') {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600 dark:text-green-400 font-semibold">Added:</span>
            <JsonRenderer data={diff.after} compact />
          </div>
        </div>
      )
    }

    if (diff.type === 'removed') {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-red-600 dark:text-red-400 font-semibold">Removed:</span>
            <JsonRenderer data={diff.before} compact />
          </div>
        </div>
      )
    }

    if (diff.type === 'changed') {
      // Check if values are primitives for inline display
      const isPrimitiveBefore = typeof diff.before !== 'object'
      const isPrimitiveAfter = typeof diff.after !== 'object'
      
      if (isPrimitiveBefore && isPrimitiveAfter) {
        return (
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-red-600 dark:text-red-400 font-medium">Before:</span>
              <JsonRenderer data={diff.before} />
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1">
              <span className="text-green-600 dark:text-green-400 font-medium">After:</span>
              <JsonRenderer data={diff.after} />
            </div>
          </div>
        )
      }

      return (
        <div className="space-y-1">
          <div className="flex items-start gap-2 text-xs">
            <span className="text-red-600 dark:text-red-400 font-semibold min-w-[40px]">Before:</span>
            <JsonRenderer data={diff.before} compact={depth > 0} />
          </div>
          <div className="flex items-start gap-2 text-xs">
            <span className="text-green-600 dark:text-green-400 font-semibold min-w-[40px]">After:</span>
            <JsonRenderer data={diff.after} compact={depth > 0} />
          </div>
        </div>
      )
    }

    if (diff.type === 'nested' && diff.arrayChanges) {
      // Array with changes
      return (
        <div className="space-y-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
            {expanded ? 'Collapse' : 'Expand'} {diff.arrayChanges.length} item changes
          </button>
          {expanded && (
            <div className="space-y-2 ml-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
              {diff.arrayChanges.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-2 rounded-lg text-xs",
                    item.type === 'changed' && "bg-amber-50 dark:bg-amber-900/10",
                    item.type === 'added' && "bg-green-50 dark:bg-green-900/10",
                    item.type === 'removed' && "bg-red-50 dark:bg-red-900/10"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {item.key && (
                      <Badge variant="outline" className="text-[10px]">{item.key}</Badge>
                    )}
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      item.type === 'changed' && "bg-amber-100 text-amber-800",
                      item.type === 'added' && "bg-green-100 text-green-800",
                      item.type === 'removed' && "bg-red-100 text-red-800"
                    )}>
                      {item.type}
                    </Badge>
                  </div>
                  
                  {item.type === 'added' && item.after && (
                    <div className="mt-1">
                      <div className="text-green-600 dark:text-green-400 font-medium mb-1">Added item:</div>
                      <JsonRenderer data={item.after} depth={depth + 1} />
                    </div>
                  )}
                  
                  {item.type === 'removed' && item.before && (
                    <div className="mt-1">
                      <div className="text-red-600 dark:text-red-400 font-medium mb-1">Removed item:</div>
                      <JsonRenderer data={item.before} depth={depth + 1} />
                    </div>
                  )}
                  
                  {item.type === 'changed' && item.before && item.after && (
                    <div className="mt-1 space-y-1">
                      <div className="text-slate-500 text-[10px] font-medium mb-1">Changed fields:</div>
                      <DiffItem 
                        label="" 
                        diff={deepDiff(item.before, item.after)} 
                        depth={depth + 1}
                        showUnchanged={false}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (diff.type === 'nested' && diff.children) {
      // Object with nested changes
      const changedChildren = Object.entries(diff.children).filter(([_, v]) => v.type !== 'unchanged')
      const systemChildren = changedChildren.filter(([k]) => isSystemField(k))
      const dataChildren = changedChildren.filter(([k]) => !isSystemField(k))

      return (
        <div className="space-y-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
            {expanded ? 'Collapse' : 'Expand'} {changedChildren.length} field changes
          </button>
          {expanded && (
            <div className="space-y-2 ml-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
              {dataChildren.map(([key, childDiff]) => (
                <DiffItem 
                  key={key}
                  label={formatFieldLabel(key)}
                  diff={childDiff}
                  depth={depth + 1}
                  showUnchanged={false}
                />
              ))}
              {systemChildren.length > 0 && depth < 1 && (
                <details className="text-xs">
                  <summary className="text-slate-400 cursor-pointer hover:text-slate-600">
                    System fields ({systemChildren.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {systemChildren.map(([key, childDiff]) => (
                      <DiffItem 
                        key={key}
                        label={formatFieldLabel(key)}
                        diff={childDiff}
                        depth={depth + 1}
                        showUnchanged={false}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div
      className={cn(
        "p-3 rounded-xl text-sm",
        diff.type === 'changed' && "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800",
        diff.type === 'added' && "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800",
        diff.type === 'removed' && "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800",
        diff.type === 'nested' && "bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
        diff.type === 'unchanged' && "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 opacity-60"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {label && <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>}
        {getBadge()}
      </div>
      {renderContent()}
    </div>
  )
}

// JSON Diff Component - Enhanced
const JsonDiff = ({ before, after }: { before: any; after: any }) => {
  const diff = deepDiff(before, after)

  if (diff.type === 'unchanged') {
    return <p className="text-sm text-slate-500 italic">No changes detected</p>
  }

  // For nested diffs, use the recursive component
  if (diff.type === 'nested' && diff.children) {
    return (
      <div className="space-y-2">
        {Object.entries(diff.children)
          .filter(([_, v]) => v.type !== 'unchanged')
          .sort((a, b) => {
            const order = { changed: 0, nested: 1, added: 2, removed: 3, unchanged: 4 }
            return order[a[1].type] - order[b[1].type]
          })
          .map(([key, childDiff]) => (
            <DiffItem 
              key={key}
              label={formatFieldLabel(key)}
              diff={childDiff}
              depth={0}
              showUnchanged={false}
            />
          ))
        }
      </div>
    )
  }

  // For simple changes or arrays
  return <DiffItem label="" diff={diff} depth={0} showUnchanged={false} />
}

// ============================================================
// DYNAMIC FIELD DETECTION UTILITIES
// ============================================================

// Priority order for name fields - used to find the "primary name" of an entity
const NAME_FIELD_PRIORITY = [
  'fullName', 'name', 'businessName', 'title', 'label',
  'username', 'email', 'contactName', 'driverName', 'customerName'
]

// Fields that indicate identity (for display)
const IDENTITY_FIELDS = ['email', 'phone', 'username', 'code']

// Status-like fields (boolean or enum status)
const STATUS_FIELDS = ['status', 'isActive', 'active', 'enabled', 'isApproved', 'isSuspended']

// Fields to exclude from detail lists (too verbose or redundant)
const EXCLUDED_DETAIL_FIELDS = ['id', 'createdAt', 'updatedAt', 'pricingConfigId', 'password', 'hash']

// Detect the primary name/identifier from an object
const detectPrimaryName = (obj: any): string | null => {
  if (!obj || typeof obj !== 'object') return null
  
  for (const field of NAME_FIELD_PRIORITY) {
    if (obj[field] && typeof obj[field] === 'string' && obj[field].trim()) {
      return obj[field].trim()
    }
  }
  return null
}

// Detect identity fields (email, phone, etc.) from an object
const detectIdentityFields = (obj: any): string[] => {
  if (!obj || typeof obj !== 'object') return []
  
  const identities: string[] = []
  for (const field of IDENTITY_FIELDS) {
    if (obj[field] && typeof obj[field] === 'string') {
      identities.push(`${formatFieldLabel(field)}: ${obj[field]}`)
    }
  }
  return identities
}

// Format a value for display in summary - handles nested objects properly
const formatValueForSummary = (value: any, depth = 0): string => {
  // Null/undefined
  if (value === null) return 'Not set'
  if (value === undefined) return 'Not set'
  
  // Boolean
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  
  // Number - detect if it's likely a money value
  if (typeof value === 'number') {
    if (value % 1 !== 0 || Math.abs(value) < 1000) {
      return `$${value.toFixed(2)}`
    }
    return value.toLocaleString()
  }
  
  // String - check for special formats
  if (typeof value === 'string') {
    // ISO date
    if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return formatDateTime(value)
    }
    // Truncate long strings
    if (value.length > 60) {
      return `${value.slice(0, 60)}...`
    }
    return value || 'Empty'
  }
  
  // Array
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None'
    if (value.length <= 3 && depth < 1) {
      // Show items if few and not too deep
      const items = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          // For objects in array, show their primary name or type
          const name = detectPrimaryName(item)
          return name || 'Item'
        }
        return String(item)
      })
      return items.join(', ')
    }
    return `${value.length} items`
  }
  
  // Object - show key fields or summary
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(k => !EXCLUDED_DETAIL_FIELDS.includes(k))
    if (keys.length === 0) return 'Empty'
    
    // Try to find a primary name first
    const primaryName = detectPrimaryName(value)
    if (primaryName) return primaryName
    
    // For shallow objects, show key fields
    if (depth < 1 && keys.length <= 3) {
      const fields = keys.slice(0, 3).map(k => {
        const val = value[k]
        if (typeof val === 'object' && val !== null) {
          return `${formatFieldLabel(k)}: [complex]`
        }
        return `${formatFieldLabel(k)}: ${typeof val === 'string' ? val : formatValueForSummary(val, depth + 1)}`
      })
      return fields.join(', ')
    }
    
    return `${keys.length} fields`
  }
  
  return String(value)
}

// Detect changes between before/after and format for display
const detectChanges = (before: any, after: any): { field: string; before: string; after: string; isComplex: boolean }[] => {
  if (!before || !after) return []
  
  const changes: { field: string; before: string; after: string; isComplex: boolean }[] = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  
  for (const key of allKeys) {
    if (EXCLUDED_DETAIL_FIELDS.includes(key)) continue
    
    const beforeVal = before[key]
    const afterVal = after[key]
    
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      const isComplex = typeof beforeVal === 'object' || typeof afterVal === 'object'
      changes.push({
        field: formatFieldLabel(key),
        before: formatValueForSummary(beforeVal, 0),
        after: formatValueForSummary(afterVal, 0),
        isComplex
      })
    }
  }
  
  return changes
}

// Detect status changes specifically
const detectStatusChange = (before: any, after: any): { field: string; from: string; to: string } | null => {
  for (const field of STATUS_FIELDS) {
    if (before?.[field] !== undefined && after?.[field] !== undefined) {
      if (before[field] !== after[field]) {
        const formatStatus = (val: any) => {
          if (typeof val === 'boolean') return val ? 'Active' : 'Inactive'
          return String(val)
        }
        return {
          field: formatFieldLabel(field),
          from: formatStatus(before[field]),
          to: formatStatus(after[field])
        }
      }
    }
  }
  return null
}

// Extract meaningful details from a single object (for "new" items)
const extractDetails = (obj: any): { label: string; value: string }[] => {
  if (!obj || typeof obj !== 'object') return []
  
  const details: { label: string; value: string }[] = []
  const keys = Object.keys(obj).filter(k => !EXCLUDED_DETAIL_FIELDS.includes(k))
  
  for (const key of keys.slice(0, 6)) { // Limit to 6 most relevant fields
    const value = obj[key]
    if (value !== null && value !== undefined && value !== '') {
      details.push({
        label: formatFieldLabel(key),
        value: formatValueForSummary(value, 0)
      })
    }
  }
  
  return details
}

// ============================================================
// DYNAMIC SUMMARY GENERATOR
// ============================================================

// Action type configurations - defines the "verb" and "entity type" for each action
const ACTION_SUMMARY_CONFIG: Record<AuditAction, { 
  verb: string; 
  entityLabel: string;
  isNegativeAction: boolean;
  isPositiveAction: boolean;
}> = {
  USER_DISABLE: { verb: 'disabled', entityLabel: 'User account', isNegativeAction: true, isPositiveAction: false },
  USER_ENABLE: { verb: 'enabled', entityLabel: 'User account', isNegativeAction: false, isPositiveAction: true },
  DEALER_APPROVE: { verb: 'approved', entityLabel: 'Dealer application', isNegativeAction: false, isPositiveAction: true },
  DEALER_REJECT: { verb: 'rejected', entityLabel: 'Dealer application', isNegativeAction: true, isPositiveAction: false },
  DRIVER_APPROVE: { verb: 'approved', entityLabel: 'Driver', isNegativeAction: false, isPositiveAction: true },
  DRIVER_SUSPEND: { verb: 'suspended', entityLabel: 'Driver', isNegativeAction: true, isPositiveAction: false },
  DRIVER_UNSUSPEND: { verb: 'reinstated', entityLabel: 'Driver', isNegativeAction: false, isPositiveAction: true },
  DELIVERY_CANCEL: { verb: 'cancelled', entityLabel: 'Delivery', isNegativeAction: true, isPositiveAction: false },
  DELIVERY_REASSIGN: { verb: 'reassigned', entityLabel: 'Delivery', isNegativeAction: false, isPositiveAction: false },
  PRICING_UPDATE: { verb: 'updated', entityLabel: 'Pricing configuration', isNegativeAction: false, isPositiveAction: false },
  POLICY_UPDATE: { verb: 'updated', entityLabel: 'System policy', isNegativeAction: false, isPositiveAction: false },
  DISPUTE_UPDATE: { verb: 'updated', entityLabel: 'Dispute', isNegativeAction: false, isPositiveAction: false },
  PAYMENT_OVERRIDE: { verb: 'overridden', entityLabel: 'Payment', isNegativeAction: false, isPositiveAction: false },
  PAYOUT_OVERRIDE: { verb: 'overridden', entityLabel: 'Payout', isNegativeAction: false, isPositiveAction: false },
  OTHER: { verb: 'performed on', entityLabel: 'System', isNegativeAction: false, isPositiveAction: false },
}

// Structured summary data for better rendering
interface StructuredSummary {
  summary: string
  primaryName: string | null
  identities: { label: string; value: string }[]
  reason: string | null
  statusChange: { field: string; from: string; to: string } | null
  fieldChanges: { field: string; before: string; after: string; isComplex: boolean }[]
  newValues: { label: string; value: string }[]
}

// Generate action summary DYNAMICALLY based on actual data - returns structured data
const generateActionSummary = (
  action: AuditAction, 
  beforeJson: any, 
  afterJson: any,
  reason: string | null
): StructuredSummary => {
  const config = ACTION_SUMMARY_CONFIG[action] || ACTION_SUMMARY_CONFIG.OTHER
  
  // 1. Find the primary name/identifier from the data
  const primaryName = detectPrimaryName(afterJson) || detectPrimaryName(beforeJson)
  
  // 2. Build the main summary sentence
  let summary = ''
  if (primaryName) {
    summary = `${config.entityLabel} "${primaryName}" was ${config.verb}`
  } else {
    summary = `A ${config.entityLabel.toLowerCase()} was ${config.verb}`
  }
  
  // 3. Get identity information (email, phone, etc.)
  const identities: { label: string; value: string }[] = []
  for (const field of IDENTITY_FIELDS) {
    const value = afterJson?.[field] || beforeJson?.[field]
    if (value && typeof value === 'string') {
      identities.push({ label: formatFieldLabel(field), value })
    }
  }
  
  // 4. Get status changes
  const statusChange = detectStatusChange(beforeJson, afterJson)
  
  // 5. Get field changes (excluding status fields)
  let fieldChanges = detectChanges(beforeJson, afterJson)
  fieldChanges = fieldChanges.filter(c => 
    !STATUS_FIELDS.some(sf => formatFieldLabel(sf) === c.field)
  )
  
  // 6. For create/add actions (no before, has after), get new values
  let newValues: { label: string; value: string }[] = []
  if (!beforeJson && afterJson) {
    newValues = extractDetails(afterJson)
  }
  
  return {
    summary,
    primaryName,
    identities,
    reason,
    statusChange,
    fieldChanges,
    newValues
  }
}

// Action Summary Card Component - Human readable summary with proper visual layout
const ActionSummaryCard = ({ 
  action, 
  beforeJson, 
  afterJson,
  reason 
}: { 
  action: AuditAction
  beforeJson: any
  afterJson: any
  reason: string | null
}) => {
  const data = generateActionSummary(action, beforeJson, afterJson, reason)
  const actionConfig = getActionConfig(action)
  const summaryConfig = ACTION_SUMMARY_CONFIG[action] || ACTION_SUMMARY_CONFIG.OTHER
  
  // Use dynamic flags from config instead of hardcoded string matching
  const isNegative = summaryConfig.isNegativeAction
  const isPositive = summaryConfig.isPositiveAction
  const hasChanges = data.fieldChanges.length > 0 || data.statusChange || data.newValues.length > 0

  return (
    <Card className={cn("border-2 overflow-hidden", 
      isNegative
        ? "border-red-200 dark:border-red-900/50"
        : isPositive
        ? "border-green-200 dark:border-green-900/50"
        : "border-blue-200 dark:border-blue-900/50"
    )}>
      {/* Header with summary */}
      <div className={cn("p-5",
        isNegative
          ? "bg-red-50 dark:bg-red-900/10"
          : isPositive
          ? "bg-green-50 dark:bg-green-900/10"
          : "bg-blue-50 dark:bg-blue-900/10"
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
            isNegative
              ? "bg-red-100 dark:bg-red-900/30"
              : isPositive
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-blue-100 dark:bg-blue-900/30"
          )}>
            <Badge className={cn("gap-1.5 text-sm", actionConfig.color)}>
              {actionConfig.icon}
            </Badge>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {data.summary}
            </h3>
            {/* Identities like email */}
            {data.identities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.identities.map((id, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {id.label}: {id.value}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Reason section */}
      {data.reason && (
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Reason</span>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{data.reason}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Status change - highlighted */}
      {data.statusChange && (
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {data.statusChange.field}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
                {data.statusChange.from}
              </Badge>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                {data.statusChange.to}
              </Badge>
            </div>
          </div>
        </div>
      )}
      
      {/* Field changes table */}
      {data.fieldChanges.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Changes</div>
          <div className="space-y-2">
            {data.fieldChanges.slice(0, 5).map((change, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[120px]">
                  {change.field}
                </span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-red-600 dark:text-red-400 line-through opacity-70">
                    {change.before}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {change.after}
                  </span>
                </div>
              </div>
            ))}
            {data.fieldChanges.length > 5 && (
              <p className="text-xs text-slate-500 italic text-center pt-2">
                + {data.fieldChanges.length - 5} more changes (see detailed view below)
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* New values (for create actions) */}
      {data.newValues.length > 0 && (
        <div className="px-5 py-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.newValues.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* No changes message */}
      {!hasChanges && !data.reason && (
        <div className="px-5 py-3 text-center text-sm text-slate-500">
          No additional details available
        </div>
      )}
    </Card>
  )
}

// Sidebar navigation items
const sidebarItems = [
  { href: '/admin-dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin-users', label: 'Users', icon: Users },
  { href: '/admin-deliveries', label: 'Deliveries', icon: Truck },
  { href: '/admin-payments', label: 'Payments', icon: CreditCard },
  { href: '/admin-disputes', label: 'Disputes', icon: Gavel },
  { href: '/admin-reports', label: 'Reports', icon: BarChart3 },
  { section: 'Config', items: [
    { href: '/admin-config', label: 'Config Hub', icon: Tune },
    { href: '/admin-pricing', label: 'Pricing', icon: PriceChange },
    { href: '/admin-scheduling-policy', label: 'Scheduling Policy', icon: CalendarMonth },
    { href: '/admin-notification-policy', label: 'Notification Policy', icon: Bell },
    { href: '/admin-audit-logs', label: 'Audit Logs', icon: History, active: true },
  ]},
]

// All available actions for filter
const ALL_ACTIONS: AuditAction[] = [
  'USER_DISABLE', 'USER_ENABLE', 'DEALER_APPROVE', 'DEALER_REJECT',
  'DRIVER_APPROVE', 'DRIVER_SUSPEND', 'DRIVER_UNSUSPEND',
  'DELIVERY_CANCEL', 'DELIVERY_REASSIGN', 'PRICING_UPDATE',
  'POLICY_UPDATE', 'DISPUTE_UPDATE', 'PAYMENT_OVERRIDE',
  'PAYOUT_OVERRIDE', 'OTHER'
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function AdminAuditLogsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Filter states (immediate values for inputs)
  const [filterInputs, setFilterInputs] = useState<{
    action: AuditAction | 'ALL'
    actorType: ActorType | 'ALL'
    reasonContains: string
    createdFrom: string
    createdTo: string
    actorUserId: string
    customerId: string
    deliveryId: string
    driverId: string
    userId: string
  }>({
    action: 'ALL',
    actorType: 'ALL',
    reasonContains: '',
    createdFrom: '',
    createdTo: '',
    actorUserId: '',
    customerId: '',
    deliveryId: '',
    driverId: '',
    userId: '',
  })

  // Debounced reason filter (500ms delay)
  const debouncedReasonContains = useDebouncedValue(filterInputs.reasonContains, 500)

  // Actual filters used for API calls (debounced where needed)
  const filters = useMemo(() => ({
    ...filterInputs,
    reasonContains: debouncedReasonContains,
  }), [filterInputs, debouncedReasonContains])

  // Pagination states
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // Fetch lookup data for dropdowns
  const { data: customers = [] } = useCustomerLookup()
  const { data: drivers = [] } = useDriverLookup()
  const { data: users = [] } = useUserLookup()
  const { data: deliveries = [] } = useDeliveryLookup()

  // Build searchable options for dropdowns
  const userOptions = useMemo(() => [
    { value: '', label: 'All Users' },
    ...users.map((user) => ({
      value: user.id,
      label: user.name,
      description: user.email,
      badge: user.roles,
      badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    })),
  ], [users])

  const deliveryOptions = useMemo(() => [
    { value: '', label: 'All Deliveries' },
    ...deliveries.map((delivery) => ({
      value: delivery.id,
      label: delivery.label,
      badge: delivery.status,
      badgeColor: delivery.status === 'COMPLETED' 
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : delivery.status === 'ACTIVE'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        : delivery.status === 'CANCELLED'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    })),
  ], [deliveries])

  const customerOptions = useMemo(() => [
    { value: '', label: 'All Customers' },
    ...customers.map((customer) => ({
      value: customer.id,
      label: customer.name,
      badge: customer.customerType,
      badgeColor: customer.customerType === 'BUSINESS'
        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    })),
  ], [customers])

  const driverOptions = useMemo(() => [
    { value: '', label: 'All Drivers' },
    ...drivers.map((driver) => ({
      value: driver.id,
      label: driver.name,
      badge: driver.status,
      badgeColor: driver.status === 'APPROVED'
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : driver.status === 'PENDING'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : driver.status === 'SUSPENDED'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    })),
  ], [drivers])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mobile menu handling
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode activated`)
  }

  const handleSignOut = () => {
    toast.success('Signed out successfully')
    navigate({ to: '/auth/admin-signin' })
  }

  // Build search request from filters
  const buildSearchRequest = useCallback((): AuditLogSearchRequest => {
    const where: AuditLogSearchRequest['where'] = {}

    if (filters.action !== 'ALL') {
      where.action = filters.action
    }

    if (filters.actorType !== 'ALL') {
      where.actorType = filters.actorType
    }

    if (filters.reasonContains.trim()) {
      where.reasonContains = filters.reasonContains.trim()
    }

    if (filters.createdFrom) {
      where.createdFrom = new Date(filters.createdFrom).toISOString()
    }

    if (filters.createdTo) {
      // Set to end of day
      const toDate = new Date(filters.createdTo)
      toDate.setHours(23, 59, 59, 999)
      where.createdTo = toDate.toISOString()
    }

    if (filters.actorUserId.trim()) {
      where.actorUserId = filters.actorUserId.trim()
    }

    if (filters.customerId.trim()) {
      where.customerId = filters.customerId.trim()
    }

    if (filters.deliveryId.trim()) {
      where.deliveryId = filters.deliveryId.trim()
    }

    if (filters.driverId.trim()) {
      where.driverId = filters.driverId.trim()
    }

    if (filters.userId.trim()) {
      where.userId = filters.userId.trim()
    }

    return {
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }
  }, [filters, page, pageSize])

  // Fetch audit logs with POST request
  const {
    data: logsData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auditLogs', filters, page, pageSize],
    queryFn: async () => {
      const token = getAccessToken()
      const searchRequest = buildSearchRequest()

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/adminAuditLogs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(searchRequest),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Request failed with status ${response.status}`)
      }

      return response.json() as Promise<AuditLog[]>
    },
    staleTime: 30000, // 30 seconds
  })

  const logs = logsData || []

  // Count active filters (based on filterInputs for immediate feedback)
  const activeFilterCount = Object.entries(filterInputs).filter(([key, value]) => {
    if (key === 'action' || key === 'actorType') {
      return value !== 'ALL'
    }
    return value.trim() !== ''
  }).length

  const resetFilters = () => {
    setFilterInputs({
      action: 'ALL',
      actorType: 'ALL',
      reasonContains: '',
      createdFrom: '',
      createdTo: '',
      actorUserId: '',
      customerId: '',
      deliveryId: '',
      driverId: '',
      userId: '',
    })
    setPage(1)
  }

  const handleLogClick = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailDialogOpen(true)
  }

  // Sidebar component
  const Sidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
    <aside
      className={cn(
        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 lg:p-5 h-fit',
        isMobile && 'h-full overflow-y-auto pb-20'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">Admin</div>
        <Badge variant="outline" className="chip-gray">
          <Shield className="w-3.5 h-3.5 text-primary mr-1" />
          SYS
        </Badge>
      </div>

      <nav className="mt-4 space-y-1.5">
        {sidebarItems.slice(0, 6).map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition',
              'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
            onClick={() => isMobile && setMobileMenuOpen(false)}
          >
            <item.icon className="w-5 h-5 text-primary" />
            {item.label}
          </Link>
        ))}

        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 mb-2">Config</div>
          {sidebarItems[6].items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition',
                item.active
                  ? 'bg-primary/15 text-slate-950 dark:text-white border border-primary/25'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
              onClick={() => isMobile && setMobileMenuOpen(false)}
            >
              <item.icon className="w-5 h-5 text-primary" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-700">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Admin</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">Audit Logs</div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading audit logs...</p>
          </div>
        </main>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-700">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-14 flex items-center justify-center">
          <Card className="max-w-md p-6 text-center border-slate-200 dark:border-slate-800">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Failed to load audit logs</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{error?.message || 'Please try again later.'}</p>
            <Button onClick={() => refetch()} className="mt-6 bg-lime-500 text-slate-950 hover:bg-lime-600">Retry</Button>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden w-11 h-11 rounded-2xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <Link to="/admin-dashboard" className="flex items-center gap-3" aria-label="101 Drivers Admin">
              <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers" className="w-full h-full object-cover" />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Admin Portal</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">Audit Logs</div>
              </div>
            </Link>

            <Badge variant="secondary" className="hidden lg:inline-flex gap-1 ml-2">
              <Shield className="h-3 w-3" />
              Read Only
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="icon"
              className="w-11 h-11 rounded-2xl"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            <Button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition text-sm font-extrabold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          'lg:hidden fixed z-50 top-0 left-0 h-full w-[88%] max-w-sm bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto transition-transform duration-300',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">Admin</div>
          <Button variant="outline" size="icon" className="w-11 h-11 rounded-2xl" onClick={() => setMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <Sidebar isMobile />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:col-span-3">
            <Sidebar />
          </div>

          {/* Main content */}
          <main className="lg:col-span-9 space-y-6">
            {/* Page header */}
            <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">Audit Logs</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                    Track all system activities and user actions. Click on any log entry to view detailed before/after comparison.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <Badge variant="outline" className="gap-1 bg-lime-50 text-lime-800 border-lime-300">
                    <Filter className="h-3 w-3" />
                    {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                  </Badge>
                )}
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold"
                >
                  <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </section>

            {/* Filters */}
            <section>
              <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filters
                    </h3>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs gap-1">
                        <XCircle className="h-3 w-3" />
                        Clear all
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Action Filter */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Action Type</Label>
                      <Select value={filterInputs.action} onValueChange={(value) => { setFilterInputs(prev => ({ ...prev, action: value as AuditAction | 'ALL' })); setPage(1); }}>
                        <SelectTrigger className="mt-2 h-11 rounded-xl text-sm">
                          <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Actions</SelectItem>
                          {ALL_ACTIONS.map((action) => (
                            <SelectItem key={action} value={action}>
                              {ACTION_CONFIG[action].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Actor Type Filter */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Actor Type</Label>
                      <Select value={filterInputs.actorType} onValueChange={(value) => { setFilterInputs(prev => ({ ...prev, actorType: value as ActorType | 'ALL' })); setPage(1); }}>
                        <SelectTrigger className="mt-2 h-11 rounded-xl text-sm">
                          <SelectValue placeholder="All Actors" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Actors</SelectItem>
                          <SelectItem value="USER">Admin User</SelectItem>
                          <SelectItem value="SYSTEM">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date From */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date From</Label>
                      <Input
                        type="date"
                        className="mt-2 h-11 rounded-xl text-sm"
                        value={filterInputs.createdFrom}
                        onChange={(e) => { setFilterInputs(prev => ({ ...prev, createdFrom: e.target.value })); setPage(1); }}
                      />
                    </div>

                    {/* Date To */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date To</Label>
                      <Input
                        type="date"
                        className="mt-2 h-11 rounded-xl text-sm"
                        value={filterInputs.createdTo}
                        onChange={(e) => { setFilterInputs(prev => ({ ...prev, createdTo: e.target.value })); setPage(1); }}
                      />
                    </div>

                    {/* Reason Contains - Debounced */}
                    <div className="md:col-span-2">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Reason Contains</Label>
                      <Input
                        className="mt-2 h-11 rounded-xl text-sm"
                        placeholder="Search in reason field..."
                        value={filterInputs.reasonContains}
                        onChange={(e) => { setFilterInputs(prev => ({ ...prev, reasonContains: e.target.value })); }}
                      />
                    </div>

                    {/* Actor User - Searchable */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Actor User</Label>
                      <SearchableSelect
                        options={userOptions}
                        value={filterInputs.actorUserId}
                        onValueChange={(value) => { setFilterInputs(prev => ({ ...prev, actorUserId: value })); setPage(1); }}
                        placeholder="All Users"
                        className="mt-2"
                      />
                    </div>

                    {/* Customer - Searchable */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Customer</Label>
                      <SearchableSelect
                        options={customerOptions}
                        value={filterInputs.customerId}
                        onValueChange={(value) => { setFilterInputs(prev => ({ ...prev, customerId: value })); setPage(1); }}
                        placeholder="All Customers"
                        className="mt-2"
                      />
                    </div>

                    {/* Delivery - Searchable */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Delivery</Label>
                      <SearchableSelect
                        options={deliveryOptions}
                        value={filterInputs.deliveryId}
                        onValueChange={(value) => { setFilterInputs(prev => ({ ...prev, deliveryId: value })); setPage(1); }}
                        placeholder="All Deliveries"
                        className="mt-2"
                      />
                    </div>

                    {/* Driver - Searchable */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Driver</Label>
                      <SearchableSelect
                        options={driverOptions}
                        value={filterInputs.driverId}
                        onValueChange={(value) => { setFilterInputs(prev => ({ ...prev, driverId: value })); setPage(1); }}
                        placeholder="All Drivers"
                        className="mt-2"
                      />
                    </div>

                    {/* Target User - Searchable */}
                    <div>
                      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Target User</Label>
                      <SearchableSelect
                        options={userOptions}
                        value={filterInputs.userId}
                        onValueChange={(value) => { setFilterInputs(prev => ({ ...prev, userId: value })); setPage(1); }}
                        placeholder="All Users"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Pagination Controls */}
            <section className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Show</span>
                <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                  <SelectTrigger className="w-20 h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-slate-600 dark:text-slate-400">entries</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl"
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="px-4 py-2 text-sm font-semibold">Page {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl"
                  disabled={logs.length < pageSize}
                  onClick={() => setPage(prev => prev + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </section>

            {/* Logs List */}
            <section>
              <Card className="border-slate-200 dark:border-slate-800 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-purple-500" />
                    Activity Log
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {logs.length > 0 
                      ? `Showing ${logs.length} entries on page ${page}. Click to view details.`
                      : 'No entries found matching your criteria.'}
                  </p>
                </CardHeader>
                <CardContent>
                  {logs.length === 0 ? (
                    <div className="text-center py-12">
                      <Database className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="mt-4 text-slate-600 dark:text-slate-400">No audit logs found matching your filters.</p>
                      <Button variant="outline" onClick={resetFilters} className="mt-4">Reset Filters</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {logs.map((log) => {
                        const actionInfo = getActionConfig(log.action)
                        const actorInfo = getActorTypeConfig(log.actorType)

                        return (
                          <button
                            key={log.id}
                            onClick={() => handleLogClick(log)}
                            className="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                  {actionInfo.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <Badge className={cn('gap-1', actionInfo.color)}>
                                      {actionInfo.icon}
                                      {actionInfo.label}
                                    </Badge>
                                    <Badge variant="outline" className={cn('gap-1', actorInfo.color)}>
                                      {actorInfo.label}
                                    </Badge>
                                    {log.reason && (
                                      <span className="text-xs text-slate-500 dark:text-slate-400">"{log.reason}"</span>
                                    )}
                                  </div>
                                  
                                  {/* Related entities - only IDs now */}
                                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                                    {log.actor && (
                                      <span className="flex items-center gap-1 text-lime-600 dark:text-lime-400">
                                        <User className="h-3 w-3" />
                                        Actor: {log.actor.id.slice(0, 8)}...
                                      </span>
                                    )}
                                    {log.customer && (
                                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                        <Building2 className="h-3 w-3" />
                                        Customer: {log.customer.id.slice(0, 8)}...
                                      </span>
                                    )}
                                    {log.delivery && (
                                      <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                                        <Package className="h-3 w-3" />
                                        Delivery: {log.delivery.id.slice(0, 8)}...
                                      </span>
                                    )}
                                    {log.driver && (
                                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <Truck className="h-3 w-3" />
                                        Driver: {log.driver.id.slice(0, 8)}...
                                      </span>
                                    )}
                                    {log.user && (
                                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                        <User className="h-3 w-3" />
                                        User: {log.user.id.slice(0, 8)}...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-xs text-slate-500 dark:text-slate-400">Created</div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDateTime(log.createdAt)}
                                  </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                  <Eye className="h-4 w-4 text-slate-400" />
                                </div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-purple-500" />
              Log Entry Details
            </DialogTitle>
            <DialogDescription>
              {selectedLog && formatDateTime(selectedLog.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6 mt-4">
              {/* Human-Readable Action Summary */}
              <ActionSummaryCard
                action={selectedLog.action}
                beforeJson={selectedLog.beforeJson}
                afterJson={selectedLog.afterJson}
                reason={selectedLog.reason}
              />

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Action Type</div>
                    <Badge className={cn('gap-1', getActionConfig(selectedLog.action).color)}>
                      {getActionConfig(selectedLog.action).icon}
                      {getActionConfig(selectedLog.action).label}
                    </Badge>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Performed By</div>
                    <Badge className={cn('gap-1', getActorTypeConfig(selectedLog.actorType).color)}>
                      {getActorTypeConfig(selectedLog.actorType).label}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Related Entities */}
              {(selectedLog.actor || selectedLog.customer || selectedLog.delivery || selectedLog.driver || selectedLog.user) && (
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black">Related Entities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedLog.actor && (
                        <div className="p-3 rounded-xl bg-lime-50 dark:bg-lime-900/10 border border-lime-200 dark:border-lime-800">
                          <div className="text-xs font-black uppercase text-lime-600 dark:text-lime-400 flex items-center gap-1">
                            <User className="h-3 w-3" /> Actor
                          </div>
                          <div className="font-mono text-xs mt-1">{selectedLog.actor.id}</div>
                        </div>
                      )}
                      {selectedLog.customer && (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                          <div className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> Customer
                          </div>
                          <div className="font-mono text-xs mt-1">{selectedLog.customer.id}</div>
                        </div>
                      )}
                      {selectedLog.delivery && (
                        <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800">
                          <div className="text-xs font-black uppercase text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                            <Package className="h-3 w-3" /> Delivery
                          </div>
                          <div className="font-mono text-xs mt-1">{selectedLog.delivery.id}</div>
                        </div>
                      )}
                      {selectedLog.driver && (
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                          <div className="text-xs font-black uppercase text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Truck className="h-3 w-3" /> Driver
                          </div>
                          <div className="font-mono text-xs mt-1">{selectedLog.driver.id}</div>
                        </div>
                      )}
                      {selectedLog.user && (
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                          <div className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <User className="h-3 w-3" /> Target User
                          </div>
                          <div className="font-mono text-xs mt-1">{selectedLog.user.id}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Changes */}
              {(selectedLog.beforeJson || selectedLog.afterJson) && (
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-purple-500" />
                      Detailed Changes
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Shows the exact before/after values for each changed field.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <JsonDiff before={selectedLog.beforeJson} after={selectedLog.afterJson} />
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-400 uppercase">Created At</div>
                      <div className="font-semibold">{formatDateTime(selectedLog.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 uppercase">Updated At</div>
                      <div className="font-semibold">{formatDateTime(selectedLog.updatedAt)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-slate-400 uppercase">Log ID</div>
                      <div className="font-semibold font-mono text-xs">{selectedLog.id}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
                <img src="/assets/101drivers-logo.jpg" alt="101 Drivers logo" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Admin Portal • Audit Logs • System Activity Tracking</p>
            </div>
            <p className="text-xs text-slate-500 font-medium">© {new Date().getFullYear()} 101 Drivers Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
