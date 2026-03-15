// components/pages/admin-pricing-config-form.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Settings,
  Info,
  Verified,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Navbar } from '@/components/shared/layout/testNavbar';
import { Brand } from '@/lib/items/brand';
import { navItems } from '@/lib/items/navItems';
import { useAdminActions } from '@/hooks/useAdminActions';
import { PricingConfigForm } from '@/components/pricing/PricingConfigForm';
import type { PricingConfigFormData, PricingConfig } from '@/types/pricing';
import { DEFAULT_PRICING_CONFIG } from '@/types/pricing';

// Mock data for development
const MOCK_CONFIG: PricingConfig = {
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
};

interface AdminPricingConfigFormPageProps {
  configId?: string;
}

export default function AdminPricingConfigFormPage({ configId }: AdminPricingConfigFormPageProps) {
  const { actionItems, signOut } = useAdminActions();
  const navigate = useNavigate();

  const isEditMode = !!configId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<Partial<PricingConfigFormData> | undefined>(
    isEditMode ? undefined : DEFAULT_PRICING_CONFIG
  );

  // Load data for edit mode
  useEffect(() => {
    if (isEditMode) {
      // Use mock data for development - in production, this would be an API call
      setInitialData(MOCK_CONFIG);
    }
  }, [isEditMode]);

  // Handle form submission
  const handleSubmit = async (data: PricingConfigFormData) => {
    setIsSubmitting(true);
    try {
      // For now, simulate API call - will be replaced with actual mutation
      console.log('Submitting pricing config:', data);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success(
        isEditMode
          ? 'Configuration updated successfully'
          : 'Configuration created successfully'
      );
      navigate({ to: '/admin-pricing-config' });
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state for edit mode
  if (isEditMode && !initialData) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
        <Navbar
          brand={<Brand />}
          items={navItems}
          actions={actionItems}
          onSignOut={signOut}
          title="Admin"
        />

        <main className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

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
              <Link
                to="/admin-pricing-config"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/5 transition"
              >
                <ArrowLeft className="w-4 h-4 text-primary" />
                Back to Configurations
              </Link>

              <Badge
                variant="outline"
                className="chip bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Settings className="w-3.5 h-3.5 text-primary mr-1" />
                {isEditMode ? 'Edit Mode' : 'Create Mode'}
              </Badge>

              <Badge
                variant="outline"
                className="badge bg-primary/10 border-primary/25 text-primary-foreground"
              >
                <Verified className="w-3.5 h-3.5 mr-1" />
                Admin only
              </Badge>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-4">
              {isEditMode ? 'Edit Pricing Configuration' : 'Create Pricing Configuration'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg max-w-3xl leading-relaxed">
              {isEditMode
                ? `Editing: ${initialData?.name || 'Configuration'}`
                : 'Set up a new pricing configuration for the platform.'}
            </p>
          </div>
        </section>

        {/* Form */}
        <section className="mt-8">
          <PricingConfigForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            mode={isEditMode ? 'edit' : 'create'}
          />
        </section>

        {/* Validation Rules Info */}
        <section className="mt-6">
          <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 text-sm font-extrabold">
              Validation Rules
            </AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-1">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>CATEGORY_ABC:</strong> Requires categoryRules (A, B, C), tiers must be empty</li>
                <li><strong>FLAT_TIER:</strong> Requires tiers array, categoryRules must be empty</li>
                <li><strong>PER_MILE:</strong> Both tiers and categoryRules must be empty</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>
      </main>
    </div>
  );
}
