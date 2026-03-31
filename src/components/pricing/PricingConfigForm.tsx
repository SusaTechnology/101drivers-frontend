// components/pricing/PricingConfigForm.tsx
import React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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

// Validation schema using Zod with conditional validation
const createPricingConfigSchema = (pricingMode: PricingMode) => {
  return z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Configuration name is required'),
    description: z.string().optional(),
    pricingMode: z.enum(['CATEGORY_ABC', 'FLAT_TIER', 'PER_MILE']),
    baseFee: z.number().min(0, 'Base fee must be 0 or greater'),
    perMileRate: z.number().nullable(),
    insuranceFee: z.number().min(0, 'Insurance fee must be 0 or greater'),
    transactionFeePct: z.number().min(0, 'Transaction fee % must be 0 or greater').max(100),
    transactionFeeFixed: z.number().min(0, 'Transaction fee fixed must be 0 or greater'),
    feePassThrough: z.boolean(),
    driverSharePct: z.number().min(0).max(100),
    active: z.boolean(),
    activateAsDefault: z.boolean(),
    // Conditional validation based on pricing mode
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
          baseFee: z.number().min(0),
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

  // Watch form values for calculations
  const watchedBaseFee = watch('baseFee');
  const watchedInsuranceFee = watch('insuranceFee');
  const watchedTransactionFeePct = watch('transactionFeePct');
  const watchedDriverSharePct = watch('driverSharePct');
  const watchedPerMileRate = watch('perMileRate');

  // Handle pricing mode change
  const handlePricingModeChange = (newMode: PricingMode) => {
    setPricingMode(newMode);
    setValue('pricingMode', newMode);

    // Reset arrays based on mode
    if (newMode === 'CATEGORY_ABC') {
      setValue('tiers', []);
      setValue('perMileRate', null);
      // Set default category rules if empty
      if (categoryRuleFields.length === 0) {
        replaceCategoryRules(DEFAULT_CATEGORY_RULES);
      }
    } else if (newMode === 'FLAT_TIER') {
      setValue('categoryRules', []);
      setValue('perMileRate', null);
      // Set default tier if empty
      if (tierFields.length === 0) {
        appendTier(DEFAULT_TIER);
      }
    } else if (newMode === 'PER_MILE') {
      setValue('tiers', []);
      setValue('categoryRules', []);
      setValue('perMileRate', 4.5);
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

  // Calculate preview values
  const calculatePreview = () => {
    const baseFee = watchedBaseFee || 0;
    const insuranceFee = watchedInsuranceFee || 0;
    const transactionFeePct = watchedTransactionFeePct || 0;
    const driverSharePct = watchedDriverSharePct || 0;
    const perMileRate = watchedPerMileRate || 0;

    // Example quote: 50 miles
    const exampleMiles = 50;
    const transportationCost = pricingMode === 'PER_MILE' ? exampleMiles * perMileRate : 200;
    const transactionFee = transportationCost * (transactionFeePct / 100) + (watch('transactionFeeFixed') || 0);
    const totalFees = baseFee + insuranceFee + transactionFee;
    const driverShare = transportationCost * (driverSharePct / 100);

    return {
      exampleMiles,
      transportationCost,
      transactionFee,
      totalFees,
      driverShare,
      dealerTotal: transportationCost + totalFees,
    };
  };

  const preview = calculatePreview();

  // Handle form submission
  const onFormSubmit = async (data: FormSchemaType) => {
    try {
      const submitData: PricingConfigFormData = {
        ...data,
        description: data.description || '',
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
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
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
                      <SelectItem value="PER_MILE">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-primary" />
                          Per Mile
                        </div>
                      </SelectItem>
                      <SelectItem value="FLAT_TIER">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" />
                          Flat Tier
                        </div>
                      </SelectItem>
                      <SelectItem value="CATEGORY_ABC">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-primary" />
                          Category A/B/C
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
                  <div className="font-bold text-slate-900 dark:text-white">Category A/B/C Pricing</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Define pricing rules for vehicle categories A, B, and C based on mileage ranges.
                    Each category can have its own base fee and per-mile rate.
                  </p>
                </div>
              </div>
            )}
            {pricingMode === 'FLAT_TIER' && (
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Flat Tier Pricing</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Define mileage-based tiers with flat prices. The price is determined by the distance range.
                    Maximum miles can be null for unlimited upper bound.
                  </p>
                </div>
              </div>
            )}
            {pricingMode === 'PER_MILE' && (
              <div className="flex items-start gap-3">
                <Calculator className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Per Mile Pricing</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Simple per-mile rate calculation. The price is calculated based on distance multiplied by the per-mile rate.
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
                    Make this the default config
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
              Set the per-mile rate for this configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-7">
            <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
              <Label htmlFor="perMileRate" className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Rate per Mile ($)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="perMileRate"
                  type="number"
                  step="0.01"
                  {...register('perMileRate', { valueAsNumber: true })}
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                  placeholder="4.50"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                This rate will be multiplied by the distance to calculate transportation cost
              </p>
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
                          className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                          Max Miles (null = unlimited)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`categoryRules.${ruleIndex}.maxMiles` as const, { valueAsNumber: true })}
                          className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 text-sm"
                          placeholder="null"
                        />
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
                            className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                          />
                        </div>
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
                            className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                          />
                        </div>
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
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                        Max Miles (null = unlimited)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`tiers.${index}.maxMiles` as const, { valueAsNumber: true })}
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 text-sm"
                        placeholder="null"
                      />
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
                          className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                          placeholder="120.00"
                        />
                      </div>
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
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Fixed base fee applied to every delivery
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
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                />
              </div>
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
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                />
              </div>
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
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                />
              </div>
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
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                />
              </div>
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

      {/* Quote Preview */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-xl font-black">Quote Preview</CardTitle>
          <CardDescription className="text-sm mt-1">
            See how fees are calculated for a sample quote
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-7">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">
              Example: {preview.exampleMiles} miles
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Transportation {pricingMode === 'PER_MILE' && `(${preview.exampleMiles} mi × $${watchedPerMileRate || 0}/mi)`}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">${preview.transportationCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Base Fee</span>
                <span className="font-bold text-slate-900 dark:text-white">${watchedBaseFee?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Insurance Fee</span>
                <span className="font-bold text-slate-900 dark:text-white">${watchedInsuranceFee?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Transaction Fee ({watchedTransactionFeePct || 0}% + ${watch('transactionFeeFixed') || 0})
                </span>
                <span className="font-bold text-slate-900 dark:text-white">${preview.transactionFee.toFixed(2)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900 dark:text-white uppercase">Dealer Total</span>
                <span className="text-xl font-black text-primary">${preview.dealerTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-sm">Driver Share ({watchedDriverSharePct || 0}%)</span>
                <span className="font-bold">${preview.driverShare.toFixed(2)}</span>
              </div>
            </div>
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
