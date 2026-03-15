// components/pricing/PricingConfigForm.tsx
import React, { useEffect, useReducer } from 'react';
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
import type {
  PricingConfigFormData,
  PricingMode,
  CategoryRule,
  PricingTier,
} from '@/types/pricing';
import { DEFAULT_PRICING_CONFIG, DEFAULT_TIER } from '@/types/pricing';

// Validation schema using Zod with conditional validation
const createPricingConfigSchema = (pricingMode: PricingMode) => {
  return z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Configuration name is required'),
    pricingMode: z.enum(['CATEGORY_ABC', 'FLAT_TIER', 'PER_MILE']),
    baseFee: z.number().min(0, 'Base fee must be 0 or greater'),
    insuranceFee: z.number().min(0, 'Insurance fee must be 0 or greater'),
    transactionFeePct: z.number().min(0, 'Transaction fee % must be 0 or greater').max(100, 'Transaction fee % cannot exceed 100'),
    transactionFeeFixed: z.number().min(0, 'Transaction fee fixed must be 0 or greater'),
    feePassThrough: z.boolean(),
    driverSharePct: z.number().min(0, 'Driver share % must be 0 or greater').max(100, 'Driver share % cannot exceed 100'),
    // Conditional validation based on pricing mode
    tiers: pricingMode === 'FLAT_TIER'
      ? z.array(z.object({
          minMiles: z.number().min(0, 'Min miles must be 0 or greater'),
          maxMiles: z.number().min(0, 'Max miles must be 0 or greater'),
          flatPrice: z.number().min(0, 'Price must be 0 or greater'),
        })).min(1, 'At least one tier is required for FLAT_TIER mode')
      : z.array(z.any()).max(0, 'Tiers must be empty for this pricing mode'),
    categoryRules: pricingMode === 'CATEGORY_ABC'
      ? z.array(z.object({
          category: z.enum(['A', 'B', 'C']),
          price: z.number().min(0, 'Price must be 0 or greater'),
        })).min(1, 'At least one category rule is required for CATEGORY_ABC mode')
      : z.array(z.any()).max(0, 'Category rules must be empty for this pricing mode'),
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
  const [pricingMode, setPricingMode] = React.useState<PricingMode>(
    initialData?.pricingMode || 'CATEGORY_ABC'
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
      pricingMode,
    },
  });

  // Field arrays for dynamic rows
  const {
    fields: tierFields,
    append: appendTier,
    remove: removeTier,
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

  // Watch form values for calculations
  const watchedBaseFee = watch('baseFee');
  const watchedInsuranceFee = watch('insuranceFee');
  const watchedTransactionFeePct = watch('transactionFeePct');
  const watchedDriverSharePct = watch('driverSharePct');

  // Handle pricing mode change
  const handlePricingModeChange = (newMode: PricingMode) => {
    setPricingMode(newMode);
    setValue('pricingMode', newMode);

    // Reset arrays based on mode
    if (newMode === 'CATEGORY_ABC') {
      setValue('tiers', []);
      // Set default category rules if empty
      if (categoryRuleFields.length === 0) {
        replaceCategoryRules([
          { category: 'A', price: 120 },
          { category: 'B', price: 160 },
          { category: 'C', price: 210 },
        ]);
      }
    } else if (newMode === 'FLAT_TIER') {
      setValue('categoryRules', []);
      // Set default tier if empty
      if (tierFields.length === 0) {
        appendTier(DEFAULT_TIER);
      }
    } else if (newMode === 'PER_MILE') {
      setValue('tiers', []);
      setValue('categoryRules', []);
    }
  };

  // Add new tier
  const handleAddTier = () => {
    const lastTier = tierFields[tierFields.length - 1];
    const newMinMiles = lastTier ? (lastTier as PricingTier).maxMiles + 0.01 : 0;
    appendTier({
      minMiles: newMinMiles,
      maxMiles: newMinMiles + 50,
      flatPrice: 150,
    });
  };

  // Calculate preview values
  const calculatePreview = () => {
    const baseFee = watchedBaseFee || 0;
    const insuranceFee = watchedInsuranceFee || 0;
    const transactionFeePct = watchedTransactionFeePct || 0;
    const driverSharePct = watchedDriverSharePct || 0;

    // Example quote: $200 base
    const exampleBase = 200;
    const transactionFee = exampleBase * (transactionFeePct / 100);
    const totalFees = baseFee + insuranceFee + transactionFee;
    const driverShare = exampleBase * (driverSharePct / 100);

    return {
      exampleBase,
      transactionFee,
      totalFees,
      driverShare,
      dealerTotal: exampleBase + totalFees,
    };
  };

  const preview = calculatePreview();

  // Handle form submission
  const onFormSubmit = async (data: FormSchemaType) => {
    try {
      // Ensure proper data structure based on pricing mode
      const submitData: PricingConfigFormData = {
        ...data,
        tiers: pricingMode === 'FLAT_TIER' ? (data.tiers as PricingTier[]) : [],
        categoryRules: pricingMode === 'CATEGORY_ABC' ? (data.categoryRules as CategoryRule[]) : [],
      };
      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Configuration Name & Mode */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-xl font-black">Configuration Details</CardTitle>
          <CardDescription className="text-sm mt-1">
            Set the name and pricing mode for this configuration
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
                placeholder="e.g., Standard Pricing 2024"
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
                    value={field.value}
                    onValueChange={(value: PricingMode) => {
                      field.onChange(value);
                      handlePricingModeChange(value);
                    }}
                  >
                    <SelectTrigger className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Select pricing mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CATEGORY_ABC">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-primary" />
                          Category A/B/C
                        </div>
                      </SelectItem>
                      <SelectItem value="FLAT_TIER">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" />
                          Flat Tier
                        </div>
                      </SelectItem>
                      <SelectItem value="PER_MILE">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-primary" />
                          Per Mile
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Mode description */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            {pricingMode === 'CATEGORY_ABC' && (
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Category A/B/C Pricing</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Set fixed prices for vehicle categories A, B, and C. The price is determined by the vehicle category.
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
                    Price is calculated based on a per-mile rate. Base fee and other fees apply.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Rules (CATEGORY_ABC mode) */}
      {pricingMode === 'CATEGORY_ABC' && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black">Category Pricing</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Set prices for each vehicle category
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 border-primary/25 text-primary-foreground">
                Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-7">
            <div className="space-y-4">
              {(['A', 'B', 'C'] as const).map((category, index) => (
                <div
                  key={category}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800",
                    "bg-white dark:bg-slate-900"
                  )}
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-4 py-2 text-base font-bold border",
                      categoryColors[category]
                    )}
                  >
                    Category {category}
                  </Badge>
                  <div className="flex-1">
                    <Label
                      htmlFor={`categoryRules.${index}.price`}
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block"
                    >
                      Price ($)
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id={`categoryRules.${index}.price`}
                        type="number"
                        step="0.01"
                        {...register(`categoryRules.${index}.price` as const, { valueAsNumber: true })}
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <input
                    type="hidden"
                    {...register(`categoryRules.${index}.category` as const)}
                    value={category}
                  />
                </div>
              ))}
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
                    className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
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
                        Max Miles
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`tiers.${index}.maxMiles` as const, { valueAsNumber: true })}
                        className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 text-sm"
                        placeholder="25"
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
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTier(index)}
                        disabled={tierFields.length <= 1}
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
                Percentage of base price going to driver
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
              Example: $200 Base Price
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Base Transportation</span>
                <span className="font-bold text-slate-900 dark:text-white">${preview.exampleBase.toFixed(2)}</span>
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
                <span className="text-sm text-slate-600 dark:text-slate-400">Transaction Fee ({watchedTransactionFeePct || 0}%)</span>
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
          disabled={isSubmitting || !isDirty}
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
