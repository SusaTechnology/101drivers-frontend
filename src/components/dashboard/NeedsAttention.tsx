// components/dashboard/NeedsAttention.tsx
import React from 'react';
import { Link } from '@tanstack/react-router';
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
  WifiOff,
  CreditCard,
  CheckCircle,
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
import { cn } from '@/lib/utils';
import { resolveAction, getIssuePriority } from '@/lib/dashboardRoutes';
import type { NeedsAttentionItem, AdminDashboardAction } from '@/types/dashboard';

interface NeedsAttentionProps {
  data: NeedsAttentionItem[] | undefined;
  isLoading: boolean;
}

const ISSUE_ICONS: Record<string, React.ElementType> = {
  DELIVERY_COMPLIANCE_MISSING: FileWarning,
  DEALER_APPROVAL_PENDING: Building2,
  DRIVER_APPROVAL_PENDING: UserCheck,
  LISTED_WITHOUT_ASSIGNMENT: Truck,
  OPS_CONFIRMATION_REQUIRED: AlertTriangle,
  PAYOUT_ELIGIBLE: DollarSign,
  OPEN_DISPUTE: Gavel,
  PAYMENT_FAILED: CreditCard,
  ACTIVE_WITHOUT_TRACKING: WifiOff,
  STALE_TRACKING: WifiOff,
};

const ISSUE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  high: {
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-200 dark:border-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    icon: 'text-red-500',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-500',
  },
  low: {
    bg: 'bg-slate-50 dark:bg-slate-950',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    icon: 'text-primary',
  },
};

function AttentionItem({ item }: { item: NeedsAttentionItem }) {
  const priority = getIssuePriority(item.issueType);
  const colors = ISSUE_COLORS[priority];
  const Icon = ISSUE_ICONS[item.issueType] || AlertCircle;
  const navProps = resolveAction(item.action);

  const content = (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-4 rounded-2xl border transition-colors',
        colors.bg,
        colors.border,
        navProps && 'cursor-pointer hover:opacity-80'
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', colors.icon)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-sm font-bold', colors.text)}>
              {item.title}
            </p>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-bold px-2 py-0.5',
                item.count > 0
                  ? priority === 'high'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                    : priority === 'medium'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
              )}
            >
              {item.count}
            </Badge>
          </div>
          {item.items && item.items.length > 0 && (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 truncate">
              {Array.isArray(item.items) && item.items[0] && typeof item.items[0] === 'object'
                ? (item.items[0] as any).user?.fullName || 
                  (item.items[0] as any).businessName || 
                  (item.items[0] as any).id?.slice(-8)
                : `${item.items.length} items`}
            </p>
          )}
        </div>
      </div>
      {item.action && navProps && (
        <span
          className={cn(
            'text-sm font-bold hover:opacity-90 transition inline-flex items-center gap-1 shrink-0',
            colors.text
          )}
        >
          {item.action.label}
          <ArrowRight className="w-4 h-4" />
        </span>
      )}
    </div>
  );

  if (navProps) {
    return (
      <Link to={navProps.to} search={navProps.search} key={item.issueType}>
        {content}
      </Link>
    );
  }

  return <div key={item.issueType}>{content}</div>;
}

function AttentionItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
      <Skeleton className="w-5 h-5 rounded" />
      <div className="flex-1">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
    </div>
  );
}

export function NeedsAttention({ data, isLoading }: NeedsAttentionProps) {
  // Separate by priority
  const highPriority = data?.filter(item => getIssuePriority(item.issueType) === 'high' && item.count > 0) || [];
  const mediumPriority = data?.filter(item => getIssuePriority(item.issueType) === 'medium' && item.count > 0) || [];
  const lowPriority = data?.filter(item => getIssuePriority(item.issueType) === 'low' && item.count > 0) || [];
  const zeroCount = data?.filter(item => item.count === 0) || [];

  const totalIssues = (data?.reduce((sum, item) => sum + item.count, 0) || 0);

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black">Needs Attention</CardTitle>
              <CardDescription className="text-sm mt-1">
                {totalIssues > 0 
                  ? `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} require attention`
                  : 'All clear - no issues'}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <AttentionItemSkeleton key={i} />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-3">
            {/* High Priority */}
            {highPriority.map((item) => (
              <AttentionItem key={item.issueType} item={item} />
            ))}
            
            {/* Medium Priority */}
            {mediumPriority.map((item) => (
              <AttentionItem key={item.issueType} item={item} />
            ))}
            
            {/* Low Priority */}
            {lowPriority.map((item) => (
              <AttentionItem key={item.issueType} item={item} />
            ))}

            {/* Zero count items */}
            {zeroCount.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  {zeroCount.length} categor{zeroCount.length === 1 ? 'y' : 'ies'} with no issues
                </p>
                <div className="flex flex-wrap gap-2">
                  {zeroCount.map((item) => (
                    <Badge
                      key={item.issueType}
                      variant="outline"
                      className="text-[10px] font-bold bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                    >
                      {item.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-3">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              All clear!
            </p>
            <p className="text-xs text-slate-500 mt-1">
              No issues require attention
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
