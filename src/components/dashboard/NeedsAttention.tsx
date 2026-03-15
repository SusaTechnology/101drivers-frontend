// components/dashboard/NeedsAttention.tsx
import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowRight,
  AlertTriangle,
  UserCheck,
  Building2,
  Truck,
  DollarSign,
  Gavel,
  FileWarning,
  Info,
  Users,
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
import type { NeedsAttentionItem, DashboardAction, IssueType } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface NeedsAttentionProps {
  data: NeedsAttentionItem[] | undefined;
  isLoading: boolean;
  onActionClick?: (action: DashboardAction) => void;
}

const ISSUE_CONFIG: Record<
  IssueType,
  { icon: React.ElementType; color: string; bgColor: string; borderColor: string }
> = {
  DELIVERY_COMPLIANCE_MISSING: {
    icon: FileWarning,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/10',
    borderColor: 'border-amber-100 dark:border-amber-900/30',
  },
  DEALER_APPROVAL_PENDING: {
    icon: Building2,
    color: 'text-primary',
    bgColor: 'bg-slate-50 dark:bg-slate-950',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
  DRIVER_APPROVAL_PENDING: {
    icon: UserCheck,
    color: 'text-primary',
    bgColor: 'bg-slate-50 dark:bg-slate-950',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
  LISTED_WITHOUT_ASSIGNMENT: {
    icon: Truck,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/10',
    borderColor: 'border-amber-100 dark:border-amber-900/30',
  },
  OPS_CONFIRMATION_REQUIRED: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/10',
    borderColor: 'border-red-100 dark:border-red-900/30',
  },
  PAYOUT_ELIGIBLE: {
    icon: DollarSign,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/10',
    borderColor: 'border-green-100 dark:border-green-900/30',
  },
  OPEN_DISPUTE: {
    icon: Gavel,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/10',
    borderColor: 'border-amber-100 dark:border-amber-900/30',
  },
};

function getItemPreview(item: NeedsAttentionItem): string {
  if (item.items.length === 0) return '';

  const firstItem = item.items[0];

  switch (item.issueType) {
    case 'DELIVERY_COMPLIANCE_MISSING':
      return `Delivery ${(firstItem as any).id?.slice(-8) || 'unknown'} - VIN not confirmed`;
    case 'DEALER_APPROVAL_PENDING':
      return `${(firstItem as any).businessName || (firstItem as any).contactName} waiting approval`;
    case 'DRIVER_APPROVAL_PENDING':
      return `${(firstItem as any).user?.fullName || 'Driver'} pending approval`;
    case 'LISTED_WITHOUT_ASSIGNMENT':
      return `${(firstItem as any).pickupAddress?.split(',')[0] || 'Route'} → ${(firstItem as any).dropoffAddress?.split(',')[0] || 'Destination'}`;
    case 'OPS_CONFIRMATION_REQUIRED':
      return `Delivery ${(firstItem as any).id?.slice(-8) || 'unknown'} needs confirmation`;
    case 'PAYOUT_ELIGIBLE':
      return `$${(firstItem as any).netAmount} for ${(firstItem as any).driver?.user?.fullName || 'driver'}`;
    case 'OPEN_DISPUTE':
      const reason = (firstItem as any).reason || '';
      return reason.slice(0, 50) + (reason.length > 50 ? '...' : '');
    default:
      return '';
  }
}

function AttentionItemCard({
  item,
  onActionClick,
}: {
  item: NeedsAttentionItem;
  onActionClick?: (action: DashboardAction) => void;
}) {
  const config = ISSUE_CONFIG[item.issueType] || ISSUE_CONFIG.DELIVERY_COMPLIANCE_MISSING;
  const Icon = config.icon;
  const navigate = useNavigate();

  const textColorMap: Record<string, string> = {
    'text-primary': 'text-primary',
    'text-amber-500': 'text-amber-700 dark:text-amber-300',
    'text-red-500': 'text-red-700 dark:text-red-300',
    'text-green-500': 'text-green-700 dark:text-green-300',
  };

  const handleAction = () => {
    if (item.action?.target) {
      navigate({ to: `/${item.action.target}` });
    }
  };

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 p-4 rounded-2xl border',
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', config.color)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
              {item.title}
            </p>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-bold px-2 py-0.5',
                item.count > 0
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              )}
            >
              {item.count} {item.count === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          {item.items.length > 0 && (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              {getItemPreview(item)}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleAction}
        className={cn(
          'text-sm font-extrabold hover:opacity-90 transition inline-flex items-center gap-1 shrink-0',
          textColorMap[config.color] || 'text-primary'
        )}
      >
        {item.action.label}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function AttentionItemSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <Skeleton className="w-5 h-5 rounded" />
        <div className="flex-1">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-3">
        <AlertCircle className="w-7 h-7 text-green-500" />
      </div>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
        All clear!
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
        No issues require attention
      </p>
    </div>
  );
}

export function NeedsAttention({ data, isLoading, onActionClick }: NeedsAttentionProps) {
  const priorityItems = data?.filter((item) => item.count > 0) || [];
  const otherItems = data?.filter((item) => item.count === 0) || [];

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg hover-lift">
      <CardHeader className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Needs attention</CardTitle>
            <CardDescription className="text-sm mt-1">
              Missing evidence, SLA risks, approvals waiting, and policy mismatches.
            </CardDescription>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-primary font-bold" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-7 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <AttentionItemSkeleton key={i} />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-3">
            {priorityItems.map((item) => (
              <AttentionItemCard key={item.issueType} item={item} onActionClick={onActionClick} />
            ))}
            {otherItems.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" />
                  All clear: {otherItems.length} categor{otherItems.length === 1 ? 'y' : 'ies'} with no issues
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherItems.map((item) => (
                    <Badge
                      key={item.issueType}
                      variant="outline"
                      className="text-[10px] font-bold bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      {item.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
}
