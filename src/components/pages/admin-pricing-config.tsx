// components/pages/admin-pricing-config.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  DollarSign,
  Map,
  Info,
  Verified,
  Star,
  CheckCircle,
  XCircle,
  Calculator,
  Tag,
  Layers,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Navbar } from '@/components/shared/layout/testNavbar';
import { Brand } from '@/lib/items/brand';
import { navItems } from '@/lib/items/navItems';
import { useAdminActions } from '@/hooks/useAdminActions';
import { PricingConfigList } from '@/components/pricing/PricingConfigList';
import { getUser } from '@/lib/tanstack/dataQuery';
import type { PricingConfig, PricingMode } from '@/types/pricing';

// Mock data for development - remove when API is ready
const MOCK_CONFIGS: PricingConfig[] = [
  {
    id: 'cfg-001',
    name: 'Default Per Mile Pricing',
    description: 'Global default per-mile pricing for standard deliveries',
    pricingMode: 'PER_MILE',
    baseFee: 45,
    perMileRate: 4.5,
    insuranceFee: 8,
    transactionFeePct: 2.9,
    transactionFeeFixed: 3,
    feePassThrough: true,
    driverSharePct: 60,
    active: true,
    isDefault: true,
    tiers: [],
    categoryRules: [],
  },
  {
    id: 'cfg-002',
    name: 'Dealer Flat Tier Pricing',
    description: 'Flat tier pricing for dealer accounts',
    pricingMode: 'FLAT_TIER',
    baseFee: 45,
    perMileRate: null,
    insuranceFee: 8,
    transactionFeePct: 2.9,
    transactionFeeFixed: 3,
    feePassThrough: true,
    driverSharePct: 60,
    active: true,
    isDefault: false,
    tiers: [
      { minMiles: 0, maxMiles: 25, flatPrice: 120 },
      { minMiles: 25.01, maxMiles: 75, flatPrice: 220 },
      { minMiles: 75.01, maxMiles: 150, flatPrice: 420 },
      { minMiles: 150.01, maxMiles: null, flatPrice: 700 },
    ],
    categoryRules: [],
  },
  {
    id: 'cfg-003',
    name: 'Category ABC Pricing',
    description: 'Mileage category based pricing',
    pricingMode: 'CATEGORY_ABC',
    baseFee: 45,
    perMileRate: null,
    insuranceFee: 8,
    transactionFeePct: 2.9,
    transactionFeeFixed: 3,
    feePassThrough: true,
    driverSharePct: 60,
    active: false,
    isDefault: false,
    tiers: [],
    categoryRules: [
      { category: 'A', minMiles: 0, maxMiles: 25, baseFee: 40, perMileRate: 3.5, flatPrice: null },
      { category: 'B', minMiles: 25.01, maxMiles: 75, baseFee: 55, perMileRate: 4.25, flatPrice: null },
      { category: 'C', minMiles: 75.01, maxMiles: null, baseFee: 70, perMileRate: 5.25, flatPrice: null },
    ],
  },
];

// Mode badge styles
const modeBadgeStyles: Record<PricingMode, { icon: React.ElementType; className: string; label: string }> = {
  CATEGORY_ABC: {
    icon: Tag,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    label: 'Category A/B/C',
  },
  FLAT_TIER: {
    icon: Layers,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    label: 'Flat Tier',
  },
  PER_MILE: {
    icon: Calculator,
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    label: 'Per Mile',
  },
};

export default function AdminPricingConfigPage() {
  const { actionItems, signOut } = useAdminActions();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [configs, setConfigs] = useState<PricingConfig[]>(MOCK_CONFIGS);

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
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, active: isActive } : c));
    toast.success(isActive ? 'Configuration activated' : 'Configuration deactivated');
  };

  const handleSetDefault = (id: string) => {
    setConfigs(prev => prev.map(c => ({
      ...c,
      isDefault: c.id === id,
    })));
    toast.success('Configuration set as default');
  };

  // Filter configs by search query
  const filteredConfigs = configs.filter(config =>
    config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    config.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
              Supports Per Mile, Flat Tier, and Category A/B/C pricing modes.
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
            onSetDefault={handleSetDefault}
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

        {/* API Endpoint Info */}
        <section className="mt-4">
          <Alert className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <Info className="h-4 w-4 text-slate-500" />
            <AlertTitle className="text-slate-700 dark:text-slate-300 text-sm font-extrabold">
              API Endpoint
            </AlertTitle>
            <AlertDescription className="text-slate-600 dark:text-slate-400 text-xs mt-1">
              <code className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                POST /api/pricingConfigs/admin-save
              </code>
            </AlertDescription>
          </Alert>
        </section>
      </main>
    </div>
  );
}
