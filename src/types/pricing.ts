// Types for Pricing Configuration

export type PricingMode = 'CATEGORY_ABC' | 'FLAT_TIER' | 'PER_MILE';

export interface CategoryRule {
  category: 'A' | 'B' | 'C';
  price: number;
}

export interface PricingTier {
  minMiles: number;
  maxMiles: number;
  flatPrice: number;
}

export interface PricingConfig {
  id?: string;
  name: string;
  pricingMode: PricingMode;
  baseFee: number;
  insuranceFee?: number;
  transactionFeePct?: number;
  transactionFeeFixed?: number;
  feePassThrough?: boolean;
  driverSharePct?: number;
  tiers: PricingTier[];
  categoryRules: CategoryRule[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PricingConfigFormData {
  id?: string;
  name: string;
  pricingMode: PricingMode;
  baseFee: number;
  insuranceFee: number;
  transactionFeePct: number;
  transactionFeeFixed: number;
  feePassThrough: boolean;
  driverSharePct: number;
  tiers: PricingTier[];
  categoryRules: CategoryRule[];
}

// API Response types
export interface PricingConfigListResponse {
  data: PricingConfig[];
  total: number;
  page: number;
  limit: number;
}

export interface PricingConfigResponse {
  success: boolean;
  data: PricingConfig;
  message?: string;
}

// Default values for form
export const DEFAULT_PRICING_CONFIG: PricingConfigFormData = {
  name: '',
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
};

// Default tier for FLAT_TIER mode
export const DEFAULT_TIER: PricingTier = {
  minMiles: 0,
  maxMiles: 25,
  flatPrice: 120,
};
