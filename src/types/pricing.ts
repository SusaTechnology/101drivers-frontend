// Types for Pricing Configuration - matching API response

export type PricingMode = 'CATEGORY_ABC' | 'FLAT_TIER' | 'PER_MILE';

// Category rule from API
export interface CategoryRule {
  id?: string;
  category: 'A' | 'B' | 'C';
  minMiles: number;
  maxMiles: number | null;
  baseFee: number | null;
  perMileRate: number | null;
  flatPrice: number | null;
  pricingConfigId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Pricing tier from API
export interface PricingTier {
  id?: string;
  minMiles: number;
  maxMiles: number | null;
  flatPrice: number;
  pricingConfigId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Customer linked to pricing config
export interface PricingCustomer {
  id: string;
  customerType: 'PRIVATE' | 'BUSINESS';
  approvalStatus: string;
  businessName: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  pricingModeOverride: string | null;
  postpaidEnabled: boolean;
  pricingConfigId: string;
  createdAt: string;
  updatedAt: string;
}

// Pricing config from API (list response)
export interface PricingConfig {
  id: string;
  name: string;
  description: string | null;
  pricingMode: PricingMode;
  baseFee: number;
  perMileRate: number | null;
  insuranceFee: number;
  transactionFeePct: number;
  transactionFeeFixed: number;
  feePassThrough: boolean;
  driverSharePct: number;
  active: boolean;
  tiers: PricingTier[];
  categoryRules: CategoryRule[];
  customers: PricingCustomer[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    tiers: number;
    categoryRules: number;
    customers: number;
  };
}

// Payload for create/update API
export interface PricingConfigPayload {
  id: string | null;
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
  actorUserId: string;
}

// Form data structure (for form state)
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

// Helper to convert API config to form data
export function configToFormData(config: PricingConfig): PricingConfigFormData {
  return {
    id: config.id,
    name: config.name,
    description: config.description || '',
    pricingMode: config.pricingMode,
    baseFee: config.baseFee,
    perMileRate: config.perMileRate,
    insuranceFee: config.insuranceFee,
    transactionFeePct: config.transactionFeePct,
    transactionFeeFixed: config.transactionFeeFixed,
    feePassThrough: config.feePassThrough,
    driverSharePct: config.driverSharePct,
    active: config.active,
    activateAsDefault: false,
    tiers: config.tiers || [],
    categoryRules: config.categoryRules || [],
  };
}
