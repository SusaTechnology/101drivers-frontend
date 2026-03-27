import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  DollarSign,
  Map,
  Info,
  Verified,
  RefreshCw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/shared/layout/testNavbar';
import { Brand } from '@/lib/items/brand';
import { navItems } from '@/lib/items/navItems';
import { useAdminActions } from '@/hooks/useAdminActions';
import { PricingConfigList } from '@/components/pricing/PricingConfigList';
import {
  useDataQuery,
  useDelete,
  getUser,
} from '@/lib/tanstack/dataQuery';
import type { PricingConfig } from '@/types/pricing';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function AdminPricingConfigPage() {
  const { actionItems, signOut } = useAdminActions();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // ---------- Fetch pricing configs ----------
  const {
    data: configs,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<PricingConfig[]>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs`,
    noFilter: true,
    staleTime: 30 * 1000,
  });

  // ---------- Delete mutation ----------
  const deleteMutation = useDelete(`${API_BASE_URL}/api/pricingConfigs/:id`, {
    onSuccess: () => {
      toast.success('Configuration deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error?.message || 'Unknown error'}`);
    },
    invalidateQueryKey: [['data', `${API_BASE_URL}/api/pricingConfigs`]],
  });

  // ---------- Handlers ----------
  const handleEdit = (id: string) => {
    navigate({ to: `/admin-pricing-config/edit/${id}` });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ pathParams: { id } });
  };

  // Filter configs by search query
  const filteredConfigs = React.useMemo(() => {
    if (!configs) return [];
    if (!searchQuery) return configs;
    return configs.filter(
      (config) =>
        config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        config.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [configs, searchQuery]);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Top header */}
        <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <DollarSign className="w-4 h-4 text-primary mr-1" />
                Pricing Configuration
              </Badge>
              <Badge
                variant="outline"
                className="badge bg-primary/10 border-primary/25 text-primary-foreground"
              >
                <Verified className="w-3.5 h-3.5 mr-1" />
                Admin only
              </Badge>
              <Badge
                variant="outline"
                className="badge bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Map className="w-3.5 h-3.5 text-primary mr-1" />
                CA-only operations
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              Pricing Configurations
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              Create and manage pricing configurations for the 101 Drivers platform.
              Supports Per Mile, Flat Tier, and Category A/B/C pricing modes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </section>

        {/* Error state */}
        {isError && (
          <section className="mt-6">
            <Alert className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30">
              <Info className="h-4 w-4 text-red-500" />
              <AlertTitle className="text-red-900 dark:text-red-200 text-sm font-extrabold">
                Error Loading Pricing Configurations
              </AlertTitle>
              <AlertDescription className="text-red-900/80 dark:text-red-200/80 text-xs mt-1">
                {error?.message || 'Failed to load pricing configurations. Please try again.'}
              </AlertDescription>
            </Alert>
          </section>
        )}

        {/* Pricing Config List */}
        <section className="mt-8">
          <PricingConfigList
            configs={filteredConfigs}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </section>

        {/* Info note */}
        <section className="mt-6">
          <Alert className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-900 dark:text-blue-200 text-sm font-extrabold">
              Pricing Modes
            </AlertTitle>
            <AlertDescription className="text-blue-900/80 dark:text-blue-200/80 text-xs mt-1">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>Per Mile:</strong> Simple per-mile rate calculation (miles × rate)</li>
                <li><strong>Flat Tier:</strong> Mileage-based tiers with flat prices</li>
                <li><strong>Category A/B/C:</strong> Vehicle category-based pricing with mileage ranges</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>
      </main>
    </div>
  );
}
