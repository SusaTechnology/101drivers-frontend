// Types for Pricing Configuration

export type PricingMode = 'CATEGORY_ABC' | 'FLAT_TIER' | 'PER_MILE';

// Category rule for CATEGORY_ABC mode - matches API payload
export interface CategoryRule {
  category: 'A' | 'B' | 'C';
  minMiles: number;
  maxMiles: number | null;
  baseFee: number;
  perMileRate: number | null;
  flatPrice: number | null;
}

// Pricing tier for FLAT_TIER mode - matches API payload
export interface PricingTier {
  minMiles: number;
  maxMiles: number | null;
  flatPrice: number;
}

// Full pricing config payload for API - matches POST /pricingConfigs/admin-save
export interface PricingConfigPayload {
  id: string | null;
  name: string;
  description?: string;
  pricingMode: PricingMode;
  baseFee: number;
  perMileRate: number | null;
  insuranceFee: number;
  transactionFeePct: number;
  transactionFeeFixed: number;
  feePassThrough: boolean;
  driverSharePct: number;
  active: boolean;
  activateAsDefault?: boolean;
  tiers: PricingTier[];
  categoryRules: CategoryRule[];
  actorUserId: string;
}

// Pricing config from API (with additional fields)
export interface PricingConfig {
  id: string;
  name: string;
  description?: string;
  pricingMode: PricingMode;
  baseFee: number;
  perMileRate: number | null;
  insuranceFee: number;
  transactionFeePct: number;
  transactionFeeFixed: number;
  feePassThrough: boolean;
  driverSharePct: number;
  active: boolean;
  isDefault?: boolean;
  tiers: PricingTier[];
  categoryRules: CategoryRule[];
  createdAt?: string;
  updatedAt?: string;
}

// Form data structure
export interface PricingConfigFormData {
  id?: string | null;
  name: string;
  description: string;
  pricingMode: PricingMode;
  baseFee: number;
  perMileRate: number | null;
  insuranceFee: number;
  transactionFeePct: number;
  transactionFeeFixed: number;
  feePassThrough: boolean;
  driverSharePct: number;
  active: boolean;
  activateAsDefault: boolean;
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

// Default values for form - PER_MILE mode
export const DEFAULT_PRICING_CONFIG: PricingConfigFormData = {
  name: '',
  description: '',
  pricingMode: 'PER_MILE',
  baseFee: 45,
  perMileRate: 4.5,
  insuranceFee: 8,
  transactionFeePct: 2.9,
  transactionFeeFixed: 3,
  feePassThrough: true,
  driverSharePct: 60,
  active: true,
  activateAsDefault: false,
  tiers: [],
  categoryRules: [],
};

// Default tier for FLAT_TIER mode
export const DEFAULT_TIER: PricingTier = {
  minMiles: 0,
  maxMiles: 25,
  flatPrice: 120,
};

// Default category rules for CATEGORY_ABC mode
export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'A',
    minMiles: 0,
    maxMiles: 25,
    baseFee: 40,
    perMileRate: 3.5,
    flatPrice: null,
  },
  {
    category: 'B',
    minMiles: 25.01,
    maxMiles: 75,
    baseFee: 55,
    perMileRate: 4.25,
    flatPrice: null,
  },
  {
    category: 'C',
    minMiles: 75.01,
    maxMiles: null,
    baseFee: 70,
    perMileRate: 5.25,
    flatPrice: null,
  },
];
