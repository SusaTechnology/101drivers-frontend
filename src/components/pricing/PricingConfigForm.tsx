// components/pricing/PricingConfigForm.tsx
import React from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DollarSign,
  Percent,
  Tag,
  Layers,
  Plus,
  Minus,
  Info,
  AlertCircle,
  Save,
  Calculator,
  FileText,
  CheckCircle,
  Star,
  Route,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type {
  PricingConfigFormData,
  PricingMode,
  CategoryRule,
  PricingTier,
} from '@/types/pricing';
import { DEFAULT_PRICING_CONFIG, DEFAULT_TIER, DEFAULT_CATEGORY_RULES } from '@/types/pricing';
import {
  calculatePricing,
  type PricingCalcConfig,
  type PricingCalcResult,
} from '@/lib/pricing/calculate';

// Validation schema using Zod with conditional validation
const createPricingConfigSchema = (pricingMode: PricingMode) => {
  return z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Configuration name is required'),
    description: z.string().optional(),
    pricingMode: z.enum(['CATEGORY_ABC', 'FLAT_TIER', 'PER_MILE']),
    baseFee: z.number().min(0, 'Base fee must be 0 or greater'),
    // .nullish() accepts number | null | undefined.
    // When pricingMode is CATEGORY_ABC, the flatMiles/perMileRate inputs are
    // not rendered, so RHF leaves them as undefined — nullable() would reject
    // that and block the save with "expected number, received undefined".
    flatMiles: z.number().nullish(),
    perMileRate: z.number().nullish(),
    insuranceFee: z.number().min(0, 'Insurance fee must be 0 or greater'),
    transactionFeePct: z.number().min(0, 'Transaction fee % must be 0 or greater').max(100),
    transactionFeeFixed: z.number().min(0, 'Transaction fee fixed must be 0 or greater'),
    feePassThrough: z.boolean(),
    driverSharePct: z.number().min(0).max(100),
    active: z.boolean(),
    activateAsDefault: z.boolean(),
    // Conditional validation based on pricing mode.
    // NOTE: FLAT_TIER mode is DEPRECATED — hidden from the UI but kept in the
    // schema for backward-compat with legacy configs that may be loaded in edit mode.
    tiers: pricingMode === 'FLAT_TIER'
      ? z.array(z.object({
          id: z.string().optional(),
          minMiles: z.number().min(0),
          maxMiles: z.number().nullable(),
          flatPrice: z.number().min(0, 'Price must be 0 or greater'),
        })).min(1, 'At least one tier is required for FLAT_TIER mode')
      : z.array(z.any()),
    categoryRules: pricingMode === 'CATEGORY_ABC'
      ? z.array(z.object({
          id: z.string().optional(),
          category: z.enum(['A', 'B', 'C']),
          minMiles: z.number().min(0),
          maxMiles: z.number().nullable(),
          // Per-rule baseFee/flatPrice are no longer used by the new ABC
          // progressive-tiered formula but kept nullable for backward-compat.
          baseFee: z.number().nullable(),
          perMileRate: z.number().nullable(),
          flatPrice: z.number().nullable(),
        })).min(1, 'At least one category rule is required')
      : z.array(z.any()),
  });
};

type FormSchemaType = z.infer<ReturnType<typeof createPricingConfigSchema>>;

interface PricingConfigFormProps {
  initialData?: Partial<PricingConfigFormData>;
  onSubmit: (data: PricingConfigFormData) => Promise<void>;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

// Category badge colors
const categoryColors: Record<string, string> = {
  A: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  B: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  C: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
};

export function PricingConfigForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  mode = 'create',
}: PricingConfigFormProps) {
  // Track if we've initialized from initialData
  const [initialized, setInitialized] = React.useState(false);

  // Pricing mode state - derived from form or initial data
  const [pricingMode, setPricingMode] = React.useState<PricingMode>(
    initialData?.pricingMode || 'PER_MILE'
  );

  // Dynamic schema based on pricing mode
  const currentSchema = React.useMemo(
    () => createPricingConfigSchema(pricingMode),
    [pricingMode]
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      ...DEFAULT_PRICING_CONFIG,
      ...initialData,
    },
  });

  // Watch pricingMode from form to keep local state in sync
  const watchedPricingMode = watch('pricingMode');

  // Field arrays for dynamic rows
  const {
    fields: tierFields,
    append: appendTier,
    remove: removeTier,
    replace: replaceTiers,
  } = useFieldArray({
    control,
    name: 'tiers' as never,
  });

  const {
    fields: categoryRuleFields,
    replace: replaceCategoryRules,
  } = useFieldArray({
    control,
    name: 'categoryRules' as never,
  });

  // Sync local pricingMode state with form value
  React.useEffect(() => {
    if (watchedPricingMode && watchedPricingMode !== pricingMode) {
      setPricingMode(watchedPricingMode);
    }
  }, [watchedPricingMode]);

  // Initialize form when initialData changes (for edit mode loading)
  React.useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      console.log('Initializing form with data:', {
        id: initialData.id,
        name: initialData.name,
        pricingMode: initialData.pricingMode,
        tiersCount: initialData.tiers?.length,
        categoryRulesCount: initialData.categoryRules?.length,
      });

      // Set pricing mode first
      const mode = initialData.pricingMode || 'PER_MILE';
      setPricingMode(mode);

      // Reset form with all data
      reset({
        ...DEFAULT_PRICING_CONFIG,
        ...initialData,
        pricingMode: mode, // Explicitly set pricingMode
      });

      // Replace field arrays with the actual data
      if (mode === 'FLAT_TIER' && initialData.tiers && initialData.tiers.length > 0) {
        replaceTiers(initialData.tiers);
      }

      if (mode === 'CATEGORY_ABC' && initialData.categoryRules && initialData.categoryRules.length > 0) {
        // Sort category rules by category letter (A, B, C)
        const sortedRules = [...initialData.categoryRules].sort((a, b) => 
          a.category.localeCompare(b.category)
        );
        replaceCategoryRules(sortedRules);
      }

      setInitialized(true);
    }
  }, [initialData, reset, replaceTiers, replaceCategoryRules]);

  // Watch form values for calculations.
  //
  // IMPORTANT: We use `useWatch` (not `watch`) for the array/nested fields
  // (`categoryRules`, `tiers`) because `useWatch` is reliably reactive to
  // nested field changes — when the admin edits `categoryRules.1.maxMiles`
  // in an input, `useWatch` returns a new array reference and triggers the
  // preview `useMemo` to recompute. Plain `watch('categoryRules')` can return
  // the same array reference after a nested mutation, which would silently
  // break the live preview.
  //
  // Scalar fields (baseFee, insuranceFee, etc.) are fine with `watch` since
  // their value IS the reference.
  const watchedBaseFee = watch('baseFee');
  const watchedInsuranceFee = watch('insuranceFee');
  const watchedTransactionFeePct = watch('transactionFeePct');
  const watchedDriverSharePct = watch('driverSharePct');
  const watchedPerMileRate = watch('perMileRate');
  const watchedFlatMiles = watch('flatMiles');
  const watchedTransactionFeeFixed = watch('transactionFeeFixed');
  const watchedFeePassThrough = watch('feePassThrough');
  // useWatch for nested arrays — guaranteed to re-render on nested changes.
  const watchedTiers = useWatch({ control, name: 'tiers' }) as PricingTier[] | undefined;
  const watchedCategoryRules = useWatch({ control, name: 'categoryRules' }) as CategoryRule[] | undefined;

  // Editable preview distance — admin can type any value to see how the
  // current (unsaved) form state would price it. Defaults to 50 miles.
  const [previewDistance, setPreviewDistance] = React.useState<number>(50);

  // Handle pricing mode change
  const handlePricingModeChange = (newMode: PricingMode) => {
    setPricingMode(newMode);
    setValue('pricingMode', newMode);

    // Reset arrays based on mode.
    //
    // IMPORTANT: We only set field defaults when the current value is null /
    // undefined — we NEVER clobber existing values. This way:
    //   - On the edit page, DB values loaded via initialData are preserved
    //     even if the admin accidentally re-selects the same mode.
    //   - On the create page, the admin gets sensible defaults to start from.
    //   - Switching modes (e.g. ABC → PER_MILE) still clears the unused
    //     arrays (tiers / categoryRules) and nulls the unused scalar fields,
    //     but doesn't overwrite the destination mode's fields if they
    //     already have values.
    if (newMode === 'CATEGORY_ABC') {
      setValue('tiers', []);
      setValue('perMileRate', null);
      setValue('flatMiles', null);
      // Set default category rules if empty
      if (categoryRuleFields.length === 0) {
        replaceCategoryRules(DEFAULT_CATEGORY_RULES);
      }
    } else if (newMode === 'FLAT_TIER') {
      setValue('categoryRules', []);
      setValue('perMileRate', null);
      setValue('flatMiles', null);
      // Set default tier if empty
      if (tierFields.length === 0) {
        appendTier(DEFAULT_TIER);
      }
    } else if (newMode === 'PER_MILE') {
      // Flat (with extra mileage) — schema name is PER_MILE for backward-compat.
      // Only set defaults for fields that are currently null/undefined — don't
      // clobber values that came from the DB or were already edited by the admin.
      setValue('tiers', []);
      setValue('categoryRules', []);
      if (watchedPerMileRate == null) {
        setValue('perMileRate', 1.8);
      }
      if (watchedFlatMiles == null) {
        setValue('flatMiles', 25);
      }
      // Note: baseFee is NOT overwritten — it's shared across all modes and
      // the admin may have already set it. On the create page it comes from
      // DEFAULT_PRICING_CONFIG; on the edit page it comes from the DB.
    }
  };

  // Add new tier
  const handleAddTier = () => {
    const lastTier = tierFields[tierFields.length - 1] as PricingTier | undefined;
    const newMinMiles = lastTier?.maxMiles ? lastTier.maxMiles + 0.01 : 0;
    appendTier({
      minMiles: newMinMiles,
      maxMiles: null,
      flatPrice: 200,
    });
  };

  // Build a PricingCalcConfig from the current (unsaved) form state.
  // The synthetic id 'preview' is used in create mode — the math doesn't
  // depend on the id, but the shared utility requires one for the snapshot.
  const previewConfig: PricingCalcConfig = {
    id: initialData?.id || 'preview',
    pricingMode,
    baseFee: watchedBaseFee ?? 0,
    flatMiles: watchedFlatMiles ?? null,
    perMileRate: watchedPerMileRate ?? null,
    insuranceFee: watchedInsuranceFee ?? 0,
    transactionFeePct: watchedTransactionFeePct ?? null,
    transactionFeeFixed: watchedTransactionFeeFixed ?? null,
    feePassThrough: watchedFeePassThrough ?? true,
    driverSharePct: watchedDriverSharePct ?? 60,
    tiers: (watchedTiers ?? []).map((t) => ({
      id: t.id,
      minMiles: t.minMiles,
      maxMiles: t.maxMiles ?? null,
      flatPrice: t.flatPrice,
    })),
    categoryRules: (watchedCategoryRules ?? []).map((r) => ({
      id: r.id,
      category: r.category,
      minMiles: r.minMiles,
      maxMiles: r.maxMiles ?? null,
      baseFee: r.baseFee ?? null,
      flatPrice: r.flatPrice ?? null,
      perMileRate: r.perMileRate ?? null,
    })),
  };

  // Calculate the preview using the shared utility. May return null when
  // the form state is incomplete (e.g. PER_MILE without perMileRate, or
  // FLAT_TIER with no matching tier for the preview distance). The UI
  // shows a friendly message instead of crashing.
  // Stable string signature of all categoryRules + tiers fields — used as an
  // extra useMemo dep so any nested change (e.g. editing maxMiles on rule B)
  // is guaranteed to trigger preview recomputation, even if RHF returns a
  // stable array reference. This is the "belt-and-suspenders" reactivity
  // guarantee on top of useWatch.
  const categoryRulesSig = JSON.stringify(watchedCategoryRules ?? []);
  const tiersSig = JSON.stringify(watchedTiers ?? []);

  const preview: PricingCalcResult | null = React.useMemo(() => {
    if (previewDistance == null || previewDistance < 0) return null;
    try {
      return calculatePricing({
        config: previewConfig,
        distanceMiles: previewDistance,
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    previewDistance,
    pricingMode,
    watchedBaseFee,
    watchedFlatMiles,
    watchedPerMileRate,
    watchedInsuranceFee,
    watchedTransactionFeePct,
    watchedTransactionFeeFixed,
    watchedFeePassThrough,
    watchedDriverSharePct,
    // Signatures capture ANY nested change in the arrays — the actual array
    // references may or may not change, but the signature always will.
    categoryRulesSig,
    tiersSig,
  ]);

  // Handle form submission
  const onFormSubmit = async (data: FormSchemaType) => {
    try {
      const submitData: PricingConfigFormData = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        pricingMode: data.pricingMode,
        baseFee: data.baseFee,
        flatMiles: data.flatMiles,
        perMileRate: data.perMileRate,
        insuranceFee: data.insuranceFee,
        transactionFeePct: data.transactionFeePct,
        transactionFeeFixed: data.transactionFeeFixed,
        feePassThrough: data.feePassThrough,
        driverSharePct: data.driverSharePct,
        active: data.active,
        activateAsDefault: data.activateAsDefault,
        tiers: pricingMode === 'FLAT_TIER' ? (data.tiers as PricingTier[]) : [],
        categoryRules: pricingMode === 'CATEGORY_ABC' ? (data.categoryRules as CategoryRule[]) : [],
      };
      console.log('Form submitting data:', { id: submitData.id, mode: mode });
      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  // Get category rule by category letter
  const getCategoryRuleIndex = (category: 'A' | 'B' | 'C'): number => {
    return categoryRuleFields.findIndex((field) => {
      const rule = field as unknown as CategoryRule;
      return rule.category === category;
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit, (validationErrors) => {
        // Surface Zod validation failures as a toast so silent Save-button
        // failures (the classic "button does nothing" symptom) become loud.
        console.error('PricingConfigForm validation errors:', validationErrors);
        const fieldNames = Object.keys(validationErrors);
        const firstError = fieldNames.length > 0
          ? (validationErrors as Record<string, { message?: string } | undefined>)[fieldNames[0]]?.message
          : undefined;
        toast.error(
          `Cannot save — please fix the ${fieldNames.length === 1 ? 'field' : 'fields'} highlighted in red` +
          (firstError ? ` (${firstError})` : '') +
          `. Fields with issues: ${fieldNames.join(', ')}.`
        );
      })}
      className="space-y-6"
    >
      {/* Hidden ID field for edit mode */}
      <input type="hidden" {...register('id')} />
      
      {/* Configuration Name & Mode */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-xl font-black">Configuration Details</CardTitle>
          <CardDescription className="text-sm mt-1">
            Set the name, description, and pricing mode
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-7 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Configuration Name */}
            <div>
              <Label htmlFor="name" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Configuration Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g., Default Per Mile Pricing"
                className={cn(
                  "w-full h-11 rounded-2xl border px-4 text-sm",
                  errors.name ? "border-red-500" : "border-slate-200 dark:border-slate-700"
                )}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Pricing Mode */}
            <div>
              <Label htmlFor="pricingMode" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Pricing Mode <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="pricingMode"
                control={control}
                render={({ field }) => (
                  <Select
                    value={watchedPricingMode || field.value || ''}
                    onValueChange={(value: PricingMode) => {
                      field.onChange(value);
                      handlePricingModeChange(value);
                    }}
                  >
                    <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Select pricing mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Two supported models: ABC (progressive tiered) and
                          Flat (flat fee + extra mileage, schema name PER_MILE).
                          FLAT_TIER is DEPRECATED and intentionally hidden. */}
                      <SelectItem value="CATEGORY_ABC">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-primary" />
                          ABC (Progressive Tiered)
                        </div>
                      </SelectItem>
                      <SelectItem value="PER_MILE">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-primary" />
                          Flat (with extra mileage)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
              Description
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="e.g., Global default per-mile pricing for standard deliveries"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm min-h-[80px]"
            />
          </div>

          {/* Mode description */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            {pricingMode === 'CATEGORY_ABC' && (
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">ABC (Progressive Tiered) Pricing</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Base fee plus mileage banded by category rules. Each band has its own per-mile rate and contributes
                    only the miles that fall inside its range. Formula:
                    <code className="font-mono text-[11px] ml-1">baseFee + Σ(band_miles × band_rate)</code>.
                    With defaults (baseFee=$50, A: 0–25 @ $2.00, B: 25–50 @ $1.80, C: 50+ @ $1.75):
                    15 mi → $80, 25 mi → $100, 50 mi → $145, 100 mi → $232.50.
                  </p>
                </div>
              </div>
            )}
            {pricingMode === 'FLAT_TIER' && (
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Flat Tier Pricing (DEPRECATED)</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    This mode is no longer supported. Please switch to ABC or Flat (with extra mileage).
                  </p>
                </div>
              </div>
            )}
            {pricingMode === 'PER_MILE' && (
              <div className="flex items-start gap-3">
                <Calculator className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Flat (with extra mileage)</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Flat fee covers the first <strong>flatMiles</strong> miles, then a per-mile rate applies.
                    Formula: <code className="font-mono text-[11px]">baseFee + max(0, miles − flatMiles) × perMileRate</code>.
                    With defaults (baseFee=$101, flatMiles=25, perMileRate=$1.80):
                    15 mi → $101, 25 mi → $101, 50 mi → $146, 100 mi → $236.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Status toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <Label htmlFor="active" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Active
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enable this configuration
                  </p>
                </div>
              </div>
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-amber-500" />
                <div>
                  <Label htmlFor="activateAsDefault" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Set as Default
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {watch('activateAsDefault')
                      ? 'This is the system default. Saving keeps it as default; other configs are demoted automatically.'
                      : 'When checked, this config becomes the system default. To demote the current default, set a different config as default instead.'}
                  </p>
                </div>
              </div>
              <Controller
                name="activateAsDefault"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="activateAsDefault"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PER_MILE Rate */}
      {pricingMode === 'PER_MILE' && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-xl font-black">Per Mile Rate</CardTitle>
            <CardDescription className="text-sm mt-1">
              Set the flat fee, free miles included, and per-mile rate for this configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-7">
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
              {/* Formula hint */}
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                  <strong>Formula:</strong>{' '}
                  <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 font-mono text-[10px]">
                    price = flat_fee + max(0, miles − flat_miles) × per_mile_rate
                  </code>
                  <br />
                  The flat fee covers the first <strong>flat_miles</strong> miles. Miles beyond that are billed at the per-mile rate.
                </p>
              </div>

              {/* Two fields side-by-side: flatMiles + perMileRate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="flatMiles" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                    Free Miles Included (flat_miles)
                  </Label>
                  <div className="relative">
                    <Route className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="flatMiles"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('flatMiles', { valueAsNumber: true })}
                      aria-invalid={!!errors.flatMiles}
                      className={cn(
                        "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                        errors.flatMiles ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                      )}
                      placeholder="25"
                    />
                  </div>
                  {errors.flatMiles && (
                    <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.flatMiles.message}</p>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Leave empty or 0 to charge per-mile from mile 0 (legacy behavior).
                  </p>
                </div>

                <div>
                  <Label htmlFor="perMileRate" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                    Rate per Mile ($)
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="perMileRate"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('perMileRate', { valueAsNumber: true })}
                      aria-invalid={!!errors.perMileRate}
                      className={cn(
                        "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                        errors.perMileRate ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                      )}
                      placeholder="1.80"
                    />
                  </div>
                  {errors.perMileRate && (
                    <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.perMileRate.message}</p>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Applied to miles beyond the free allowance.
                  </p>
                </div>
              </div>

              {/* Note: The full live Quote Preview (with editable distance,
                  insurance, transaction fees, and the complete breakdown)
                  is rendered below in the "Quote Preview" card. It uses the
                  shared calculatePricing() utility — same math as the
                  backend — and reacts to every input field via useWatch. */}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Rules (CATEGORY_ABC mode) */}
      {pricingMode === 'CATEGORY_ABC' && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black">Category Pricing Rules</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Define pricing rules for each vehicle category
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 border-primary/25 text-primary-foreground">
                Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-7">
            <div className="space-y-6">
              {(['A', 'B', 'C'] as const).map((category) => {
                const ruleIndex = getCategoryRuleIndex(category);
                // If rule doesn't exist for this category, show a placeholder
                if (ruleIndex === -1) {
                  return (
                    <div
                      key={category}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-4 py-2 text-base font-bold border",
                            categoryColors[category]
                          )}
                        >
                          Category {category}
                        </Badge>
                        <span className="text-xs text-slate-500">No rule defined</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={category}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-4 py-2 text-base font-bold border",
                          categoryColors[category]
                        )}
                      >
                        Category {category}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Min Miles
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`categoryRules.${ruleIndex}.minMiles` as const, { valueAsNumber: true })}
                          aria-invalid={!!(errors.categoryRules as any)?.[ruleIndex]?.minMiles}
                          className={cn(
                            "w-full h-11 rounded-2xl border px-4 text-sm",
                            (errors.categoryRules as any)?.[ruleIndex]?.minMiles ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                          )}
                        />
                        {(errors.categoryRules as any)?.[ruleIndex]?.minMiles && (
                          <p className="text-xs text-red-500 mt-1 font-medium">⚠ {(errors.categoryRules as any)?.[ruleIndex]?.minMiles?.message}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Max Miles (null = unlimited)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`categoryRules.${ruleIndex}.maxMiles` as const, { valueAsNumber: true })}
                          aria-invalid={!!(errors.categoryRules as any)?.[ruleIndex]?.maxMiles}
                          className={cn(
                            "w-full h-11 rounded-2xl border px-4 text-sm",
                            (errors.categoryRules as any)?.[ruleIndex]?.maxMiles ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                          )}
                          placeholder="null"
                        />
                        {(errors.categoryRules as any)?.[ruleIndex]?.maxMiles && (
                          <p className="text-xs text-red-500 mt-1 font-medium">⚠ {(errors.categoryRules as any)?.[ruleIndex]?.maxMiles?.message}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Base Fee ($)
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`categoryRules.${ruleIndex}.baseFee` as const, { valueAsNumber: true })}
                            aria-invalid={!!(errors.categoryRules as any)?.[ruleIndex]?.baseFee}
                            className={cn(
                              "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                              (errors.categoryRules as any)?.[ruleIndex]?.baseFee ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                            )}
                          />
                        </div>
                        {(errors.categoryRules as any)?.[ruleIndex]?.baseFee && (
                          <p className="text-xs text-red-500 mt-1 font-medium">⚠ {(errors.categoryRules as any)?.[ruleIndex]?.baseFee?.message}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Per Mile Rate ($)
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`categoryRules.${ruleIndex}.perMileRate` as const, { valueAsNumber: true })}
                            aria-invalid={!!(errors.categoryRules as any)?.[ruleIndex]?.perMileRate}
                            className={cn(
                              "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                              (errors.categoryRules as any)?.[ruleIndex]?.perMileRate ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                            )}
                          />
                        </div>
                        {(errors.categoryRules as any)?.[ruleIndex]?.perMileRate && (
                          <p className="text-xs text-red-500 mt-1 font-medium">⚠ {(errors.categoryRules as any)?.[ruleIndex]?.perMileRate?.message}</p>
                        )}
                      </div>
                    </div>
                    <input
                      type="hidden"
                      {...register(`categoryRules.${ruleIndex}.category` as const)}
                      value={category}
                    />
                    <input
                      type="hidden"
                      {...register(`categoryRules.${ruleIndex}.flatPrice` as const)}
                      value=""
                    />
                    <input
                      type="hidden"
                      {...register(`categoryRules.${ruleIndex}.id` as const)}
                    />
                  </div>
                );
              })}
            </div>
            {errors.categoryRules && (
              <p className="text-xs text-red-500 mt-2">{errors.categoryRules.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tiers (FLAT_TIER mode) */}
      {pricingMode === 'FLAT_TIER' && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black">Mileage Tiers</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Define price tiers based on distance ranges
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTier}
                className="inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Tier
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-7">
            {tierFields.length === 0 ? (
              <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-900 dark:text-amber-200">No tiers defined</AlertTitle>
                <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
                  Add at least one tier to enable FLAT_TIER pricing.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {tierFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div>
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Min Miles
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`tiers.${index}.minMiles` as const, { valueAsNumber: true })}
                        aria-invalid={!!(errors.tiers as any)?.[index]?.minMiles}
                        className={cn(
                          "w-full h-11 rounded-2xl border px-4 text-sm",
                          (errors.tiers as any)?.[index]?.minMiles ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                        )}
                        placeholder="0"
                      />
                      {(errors.tiers as any)?.[index]?.minMiles && (
                        <p className="text-xs text-red-500 mt-1 font-medium">⚠ {(errors.tiers as any)?.[index]?.minMiles?.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Max Miles (null = unlimited)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`tiers.${index}.maxMiles` as const, { valueAsNumber: true })}
                        aria-invalid={!!(errors.tiers as any)?.[index]?.maxMiles}
                        className={cn(
                          "w-full h-11 rounded-2xl border px-4 text-sm",
                          (errors.tiers as any)?.[index]?.maxMiles ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                        )}
                        placeholder="null"
                      />
                      {(errors.tiers as any)?.[index]?.maxMiles && (
                        <p className="text-xs text-red-500 mt-1 font-medium">⚠ {(errors.tiers as any)?.[index]?.maxMiles?.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Flat Price ($)
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`tiers.${index}.flatPrice` as const, { valueAsNumber: true })}
                          aria-invalid={!!(errors.tiers as any)?.[index]?.flatPrice}
                          className={cn(
                            "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                            (errors.tiers as any)?.[index]?.flatPrice ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                          )}
                          placeholder="120.00"
                        />
                      </div>
                      {(errors.tiers as any)?.[index]?.flatPrice && (
                        <p className="text-xs text-red-500 mt-1 font-medium">⚠ {(errors.tiers as any)?.[index]?.flatPrice?.message}</p>
                      )}
                    </div>
                    {/* Hidden ID field for existing tiers */}
                    <input
                      type="hidden"
                      {...register(`tiers.${index}.id` as const)}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTier(index)}
                        className="w-full h-11 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/10"
                      >
                        <Minus className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {errors.tiers && (
              <p className="text-xs text-red-500 mt-2">{errors.tiers.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fees & Percentages */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-xl font-black">Fees & Percentages</CardTitle>
          <CardDescription className="text-sm mt-1">
            Configure base fees and percentage-based charges
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Base Fee */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <Label htmlFor="baseFee" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Base Fee ($)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="baseFee"
                  type="number"
                  step="0.01"
                  {...register('baseFee', { valueAsNumber: true })}
                  aria-invalid={!!errors.baseFee}
                  className={cn(
                    "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                    errors.baseFee ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                  )}
                />
              </div>
              {errors.baseFee && (
                <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.baseFee.message}</p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Fixed base fee applied to every delivery. Also serves as the
                non-refundable lock-in fee captured from the customer when the
                driver starts the trip — the driver immediately earns their %
                share. If the trip is cancelled after start, this fee is
                retained (no refund). If 0 or null, no lock-in is applied
                (legacy behavior).
              </p>
            </div>

            {/* Insurance Fee */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <Label htmlFor="insuranceFee" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Insurance Fee ($)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="insuranceFee"
                  type="number"
                  step="0.01"
                  {...register('insuranceFee', { valueAsNumber: true })}
                  aria-invalid={!!errors.insuranceFee}
                  className={cn(
                    "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                    errors.insuranceFee ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                  )}
                />
              </div>
              {errors.insuranceFee && (
                <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.insuranceFee.message}</p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Insurance fee per delivery
              </p>
            </div>

            {/* Transaction Fee Percentage */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <Label htmlFor="transactionFeePct" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Transaction Fee (%)
              </Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="transactionFeePct"
                  type="number"
                  step="0.1"
                  {...register('transactionFeePct', { valueAsNumber: true })}
                  aria-invalid={!!errors.transactionFeePct}
                  className={cn(
                    "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                    errors.transactionFeePct ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                  )}
                />
              </div>
              {errors.transactionFeePct && (
                <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.transactionFeePct.message}</p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Percentage-based transaction fee
              </p>
            </div>

            {/* Transaction Fee Fixed */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <Label htmlFor="transactionFeeFixed" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Transaction Fee Fixed ($)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="transactionFeeFixed"
                  type="number"
                  step="0.01"
                  {...register('transactionFeeFixed', { valueAsNumber: true })}
                  aria-invalid={!!errors.transactionFeeFixed}
                  className={cn(
                    "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                    errors.transactionFeeFixed ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                  )}
                />
              </div>
              {errors.transactionFeeFixed && (
                <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.transactionFeeFixed.message}</p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Fixed portion of transaction fee
              </p>
            </div>

            {/* Driver Share Percentage */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <Label htmlFor="driverSharePct" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Driver Share (%)
              </Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="driverSharePct"
                  type="number"
                  step="0.1"
                  {...register('driverSharePct', { valueAsNumber: true })}
                  aria-invalid={!!errors.driverSharePct}
                  className={cn(
                    "w-full h-11 rounded-2xl border pl-10 pr-4 text-sm",
                    errors.driverSharePct ? "border-red-500 ring-2 ring-red-100 dark:ring-red-900/30" : "border-slate-200 dark:border-slate-700"
                  )}
                />
              </div>
              {errors.driverSharePct && (
                <p className="text-xs text-red-500 mt-1 font-medium">⚠ {errors.driverSharePct.message}</p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Percentage of transportation cost going to driver
              </p>
            </div>

            {/* Fee Pass Through */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="feePassThrough" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Fee Pass Through
                  </Label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Pass fees through to dealer
                  </p>
                </div>
                <Controller
                  name="feePassThrough"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="feePassThrough"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Preview — uses shared calculatePricing utility (item 15) */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-black">Quote Preview</CardTitle>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold uppercase tracking-wider">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              Live
            </Badge>
          </div>
          <CardDescription className="text-sm mt-1">
            Live preview using the same math as the backend quote engine. Edit any field above (base fee, category A/B/C rates, max miles, etc.) or the distance below — the preview recalculates instantly from the unsaved form values.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-7">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
            {/* Editable distance input */}
            <div className="flex items-center gap-3 mb-4">
              <Label
                htmlFor="preview-distance"
                className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400"
              >
                Distance
              </Label>
              <Input
                id="preview-distance"
                type="number"
                min={0}
                step={0.1}
                value={previewDistance}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreviewDistance(v === '' ? 0 : Number(v));
                }}
                className="w-28 h-8 text-sm font-bold"
              />
              <span className="text-xs text-slate-500">miles</span>
              {preview?.mileageCategory && (
                <Badge className="ml-auto bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                  Cat {preview.mileageCategory}
                </Badge>
              )}
            </div>

            {preview ? (
              <div className="space-y-3">
                {/* ──────────────────────────────────────────────────────────── */}
                {/* CATEGORY_ABC: progressive tiered breakdown — render every band */}
                {/* (including bands with 0 miles, dimmed) so the admin can see    */}
                {/* the full structure of the calculation.                         */}
                {/* ──────────────────────────────────────────────────────────── */}
                {pricingMode === 'CATEGORY_ABC' &&
                  preview.feesBreakdown.bands &&
                  preview.feesBreakdown.bands.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 mb-2">
                        Progressive Tiered Breakdown
                      </div>
                      {preview.feesBreakdown.bands.map((band, idx) => {
                        const isLast =
                          idx === preview.feesBreakdown.bands!.length - 1;
                        const isFirst = idx === 0;
                        const prefix = isFirst
                          ? 'First'
                          : isLast
                          ? 'Final'
                          : 'Next';
                        const bandUpperLabel =
                          band.upperBound == null
                            ? `${band.lowerBound}+`
                            : `${band.lowerBound}-${band.upperBound}`;
                        const isZero = band.milesInBand <= 0;
                        return (
                          <div
                            key={`${band.category}-${idx}`}
                            className={cn(
                              'flex items-center justify-between text-xs',
                              isZero && 'opacity-40'
                            )}
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              <span className="font-bold mr-1">{prefix}</span>
                              {band.milesInBand} mi{' '}
                              <span className="text-slate-400">
                                ({bandUpperLabel})
                              </span>
                              <span className="mx-1 text-slate-400">·</span>
                              <span className="text-slate-500">
                                {band.milesInBand} × ${band.perMileRate.toFixed(2)}
                              </span>
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                              ${band.amount.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                      {/* Subtotal row */}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Distance subtotal
                        </span>
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">
                          ${preview.feesBreakdown.distanceCharge.toFixed(2)}
                        </span>
                      </div>
                      {/* Base fee row */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300">
                          Base fee
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          ${preview.feesBreakdown.baseFare.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                {/* Transportation line — mode-aware (only shown for non-ABC modes) */}
                {pricingMode !== 'CATEGORY_ABC' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {pricingMode === 'PER_MILE' && (
                        <>
                          Transportation{' '}
                          {preview.feesBreakdown.flatMilesAllowance &&
                          preview.feesBreakdown.flatMilesAllowance > 0
                            ? `(max(0, ${previewDistance} − ${preview.feesBreakdown.flatMilesAllowance}) mi × $${watchedPerMileRate ?? 0}/mi)`
                            : `(${previewDistance} mi × $${watchedPerMileRate ?? 0}/mi)`}
                        </>
                      )}
                      {pricingMode === 'FLAT_TIER' && <>Flat tier (matched)</>}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ${(preview.feesBreakdown.baseFare + preview.feesBreakdown.distanceCharge).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Insurance Fee
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ${preview.feesBreakdown.insuranceFee.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Transaction Fee ({watchedTransactionFeePct ?? 0}% + ${watchedTransactionFeeFixed ?? 0})
                    {!preview.feesBreakdown.feePassThrough && (
                      <span className="ml-1 text-[10px] text-amber-600">(pass-through off)</span>
                    )}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ${preview.feesBreakdown.transactionFee.toFixed(2)}
                  </span>
                </div>

                <Separator className="my-2" />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase">
                    Dealer Total
                  </span>
                  <span className="text-xl font-black text-primary">
                    ${preview.estimatedPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-sm">
                    Driver Share ({watchedDriverSharePct ?? 0}%)
                  </span>
                  <span className="font-bold">
                    ${preview.estimatedDriverPayout.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 py-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Fill in the required fields for{' '}
                  <strong>{pricingMode}</strong> mode to see the preview
                  {pricingMode === 'PER_MILE' && ' (perMileRate is required)'}
                  {pricingMode === 'FLAT_TIER' && ' (need a tier matching the distance)'}
                  {pricingMode === 'CATEGORY_ABC' && ' (need a rule for this category)'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-primary text-slate-950 hover:shadow-xl hover:shadow-primary/20 transition"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {mode === 'create' ? 'Create Configuration' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
