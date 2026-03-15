// components/pages/admin-pricing-config.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  DollarSign,
  Map,
  Settings,
  Info,
  CreditCard,
  Verified,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Navbar } from '@/components/shared/layout/testNavbar';
import { Brand } from '@/lib/items/brand';
import { navItems } from '@/lib/items/navItems';
import { useAdminActions } from '@/hooks/useAdminActions';
import { PricingConfigList } from '@/components/pricing/PricingConfigList';
import { useSavePricingConfig, useDeletePricingConfig, useTogglePricingConfigStatus } from '@/hooks/pricing/usePricingConfigs';
import type { PricingConfig } from '@/types/pricing';

// Mock data for development - will be replaced with API data
const MOCK_CONFIGS: PricingConfig[] = [
  {
    id: 'cfg-001',
    name: 'Standard Category Pricing',
    pricingMode: 'CATEGORY_ABC',
    baseFee: 40,
    insuranceFee: 8,
    transactionFeePct: 2.9,
    transactionFeeFixed: 3,
    feePassThrough: true,
    driverSharePct: 60,
    tiers: [],
    categoryRules: [
      { category: 'A', price: 120 },
      { category: 'B', price: 160 },
      { category: 'C', price: 210 },
    ],
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-01T08:10:00Z',
  },
  {
    id: 'cfg-002',
    name: 'Long Distance Tier Pricing',
    pricingMode: 'FLAT_TIER',
    baseFee: 45,
    insuranceFee: 10,
    transactionFeePct: 2.9,
    transactionFeeFixed: 3,
    feePassThrough: true,
    driverSharePct: 55,
    tiers: [
      { minMiles: 0, maxMiles: 25, flatPrice: 120 },
      { minMiles: 25.01, maxMiles: 75, flatPrice: 220 },
      { minMiles: 75.01, maxMiles: 150, flatPrice: 350 },
    ],
    categoryRules: [],
    isActive: false,
    createdAt: '2026-01-20T14:30:00Z',
    updatedAt: '2026-01-25T09:15:00Z',
  },
];

export default function AdminPricingConfigPage() {
  const { actionItems, signOut } = useAdminActions();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [configs, setConfigs] = useState<PricingConfig[]>(MOCK_CONFIGS);

  // Mutations
  const saveMutation = useSavePricingConfig({
    onSuccess: () => {
      toast.success('Configuration saved successfully');
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const deleteMutation = useDeletePricingConfig({
    onSuccess: () => {
      toast.success('Configuration deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const toggleStatusMutation = useTogglePricingConfigStatus({
    onSuccess: () => {
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Handlers
  const handleEdit = (id: string) => {
    navigate({ to: `/admin-pricing-config/edit/${id}` });
  };

  const handleDelete = (id: string) => {
    // For now, update local state - will be replaced with actual API call
    setConfigs(prev => prev.filter(c => c.id !== id));
    toast.success('Configuration deleted');
  };

  const handleToggleStatus = (id: string, isActive: boolean) => {
    // For now, update local state - will be replaced with actual API call
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, isActive } : c));
    toast.success(isActive ? 'Configuration activated' : 'Configuration deactivated');
  };

  // Filter configs by search query
  const filteredConfigs = configs.filter(config =>
    config.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              Supports Category A/B/C pricing, Flat Tier pricing, and Per-Mile pricing modes.
            </p>
          </div>
        </section>

        {/* Pricing Config List */}
        <section className="mt-8">
          <PricingConfigList
            configs={filteredConfigs}
            isLoading={false}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
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
                <li><strong>Category A/B/C:</strong> Fixed prices per vehicle category</li>
                <li><strong>Flat Tier:</strong> Mileage-based pricing tiers</li>
                <li><strong>Per Mile:</strong> Simple per-mile rate calculation</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>
      </main>
    </div>
  );
}
