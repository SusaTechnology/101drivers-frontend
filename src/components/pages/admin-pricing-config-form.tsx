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
import { transformToPayload } from '@/hooks/pricing/usePricingConfigs'; // keep utility
import {
  useDataQuery,
  useDataMutation,
  getUser,
} from '@/lib/tanstack/dataQuery';
import type { PricingConfigFormData, PricingConfig } from '@/types/pricing';
import { DEFAULT_PRICING_CONFIG, configToFormData } from '@/types/pricing';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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

  // Fetch existing config for edit mode
  const {
    data: configData,
    isLoading,
    isError,
    error,
  } = useDataQuery<PricingConfig>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/${configId}`,
    enabled: isEditMode,
    noFilter: true,
  });

  // Save mutation (handles both create and update)
  const saveMutation = useDataMutation<PricingConfig, PricingConfigFormData & { actorUserId?: string }>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/admin-save`,
    method: 'POST',
    onSuccess: (data, variables) => {
      setIsSubmitting(false);
      toast.success(
        isEditMode
          ? 'Configuration updated successfully'
          : 'Configuration created successfully'
      );

      // Update the form data immediately with the response
      if (data) {
        const updatedFormData = configToFormData(data);
        setInitialData(updatedFormData);

        // If this was a create (no configId), update the URL to edit mode
        // so subsequent saves are updates, not creates
        if (!isEditMode && data.id) {
          navigate({
            to: `/admin-pricing-config/edit/${data.id}`,
            replace: true,
          });
        }
      }

      // Invalidate the list and the single config query (if any)
      // saveMutation.onSuccessInvalidate = true;
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      toast.error(`Failed to save: ${error?.message || 'Unknown error'}`);
    },
    invalidateQueryKey: [
      ['data', `${API_BASE_URL}/api/pricingConfigs`],
      ...(configId ? [['data', `${API_BASE_URL}/api/pricingConfigs/${configId}`]] : []),
    ],
  });

  // Load data for edit mode
  useEffect(() => {
    if (isEditMode && configData) {
      const formData = configToFormData(configData);
      console.log('Loading config data for edit:', {
        id: formData.id,
        name: formData.name,
        pricingMode: formData.pricingMode,
      });
      setInitialData(formData);
    }
  }, [isEditMode, configData]);

  // Handle form submission
  const handleSubmit = async (data: PricingConfigFormData) => {
    setIsSubmitting(true);
    try {
      // Transform form data to API payload and add actorUserId
      const payload = transformToPayload(data);
      const user = getUser();
      const payloadWithActor = {
        ...payload,
        actorUserId: user?.id || 'admin_user',
      };

      console.log('Submitting pricing config payload:', {
        id: payloadWithActor.id,
        name: payloadWithActor.name,
        isUpdate: !!payloadWithActor.id,
      });

      // Call the mutation
      saveMutation.mutate(payloadWithActor);
    } catch (error: any) {
      setIsSubmitting(false);
      toast.error(`Failed to save: ${error.message}`);
    }
  };

  // Loading state for edit mode (also wait for initialData to be set)
  if (isEditMode && (isLoading || !initialData)) {
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

  // Error state for edit mode
  if (isEditMode && isError) {
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
          <Alert className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30">
            <Info className="h-4 w-4 text-red-500" />
            <AlertTitle className="text-red-900 dark:text-red-200 text-sm font-extrabold">
              Error Loading Configuration
            </AlertTitle>
            <AlertDescription className="text-red-900/80 dark:text-red-200/80 text-xs mt-1">
              {error?.message || 'Failed to load pricing configuration. Please try again.'}
            </AlertDescription>
          </Alert>
          <div className="mt-6">
            <Link
              to="/admin-pricing-config"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-primary/5 transition"
            >
              <ArrowLeft className="w-4 h-4 text-primary" />
              Back to Configurations
            </Link>
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
                <li><strong>PER_MILE:</strong> Requires perMileRate, tiers and categoryRules must be empty</li>
                <li><strong>FLAT_TIER:</strong> Requires tiers array, categoryRules must be empty, perMileRate null</li>
                <li><strong>CATEGORY_ABC:</strong> Requires categoryRules array, tiers must be empty, perMileRate null</li>
              </ul>
            </AlertDescription>
          </Alert>
        </section>
      </main>
    </div>
  );
}