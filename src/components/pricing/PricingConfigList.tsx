// components/pricing/PricingConfigList.tsx
import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Tag,
  Layers,
  Calculator,
  DollarSign,
  MoreVertical,
  CheckCircle,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { PricingConfig, PricingMode } from '@/types/pricing';

interface PricingConfigListProps {
  configs: PricingConfig[];
  isLoading?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string, isActive: boolean) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Mode badge styles
const modeBadgeStyles: Record<PricingMode, { icon: React.ElementType; className: string; label: string }> = {
  CATEGORY_ABC: {
    icon: Tag,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    label: 'Category A/B/C',
  },
  FLAT_TIER: {
    icon: Layers,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    label: 'Flat Tier',
  },
  PER_MILE: {
    icon: Calculator,
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    label: 'Per Mile',
  },
};

export function PricingConfigList({
  configs,
  isLoading = false,
  onEdit,
  onDelete,
  onToggleStatus,
  searchQuery = '',
  onSearchChange,
}: PricingConfigListProps) {
  const navigate = useNavigate();

  const handleEdit = (id: string) => {
    if (onEdit) {
      onEdit(id);
    } else {
      navigate({ to: `/admin-pricing-config/edit/${id}` });
    }
  };

  const handleDelete = (id: string) => {
    if (onDelete) {
      onDelete(id);
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    if (onToggleStatus) {
      onToggleStatus(id, !currentStatus);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-7 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-11 w-80" />
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-7">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Pricing Configurations</CardTitle>
            <CardDescription className="text-sm mt-1">
              Manage pricing configurations for the platform
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full sm:w-[320px] h-11 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800/40 text-sm"
                placeholder="Search configurations..."
              />
            </div>

            {/* Create button */}
            <Link to="/admin-pricing-config/create">
              <Button className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition">
                <Plus className="w-4 h-4" />
                New Config
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-7">
        {configs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              No pricing configurations found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Get started by creating your first pricing configuration'}
            </p>
            <Link to="/admin-pricing-config/create">
              <Button className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-slate-950">
                <Plus className="w-4 h-4" />
                Create Configuration
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Name
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Mode
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Base Fee
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Driver Share
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => {
                  const modeInfo = modeBadgeStyles[config.pricingMode];
                  const ModeIcon = modeInfo.icon;

                  return (
                    <TableRow
                      key={config.id}
                      className="border-slate-100 dark:border-slate-800 hover:bg-primary/5 transition"
                    >
                      <TableCell className="py-4">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {config.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          ID: {config.id?.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant="outline"
                          className={cn("inline-flex items-center gap-1.5 px-3 py-1.5", modeInfo.className)}
                        >
                          <ModeIcon className="w-3.5 h-3.5" />
                          {modeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="font-black text-slate-900 dark:text-white">
                          ${config.baseFee.toFixed(2)}
                        </div>
                        {config.insuranceFee ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            + ${config.insuranceFee.toFixed(2)} insurance
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="font-bold text-slate-700 dark:text-slate-300">
                          {config.driverSharePct}%
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                            config.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          {config.isActive ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleEdit(config.id!)}
                              className="cursor-pointer"
                            >
                              <Edit className="w-4 h-4 mr-2 text-primary" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(config.id!, config.isActive || false)}
                              className="cursor-pointer"
                            >
                              {config.isActive ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-2 text-amber-500" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-600 dark:text-red-400 cursor-pointer"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{config.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(config.id!)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {configs.length > 0 && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-extrabold">{configs.length}</span> configurations
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
