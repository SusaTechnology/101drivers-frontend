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
  flatMiles: number | null;
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
  flatMiles: number | null;
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
  flatMiles: number | null;
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

// Default values for form - PER_MILE mode (a.k.a. "Flat with extra mileage" in UI).
// Math: baseFee + max(0, miles - flatMiles) * perMileRate
// Example: $101 base covers first 25 mi, then $1.80/mi.
//   15 mi  -> $101
//   25 mi  -> $101
//   50 mi  -> $146
//   100 mi -> $236
export const DEFAULT_PRICING_CONFIG: PricingConfigFormData = {
  name: '',
  description: '',
  pricingMode: 'PER_MILE',
  baseFee: 101,
  flatMiles: 25,
  perMileRate: 1.8,
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

// Default tier for FLAT_TIER mode (DEPRECATED — kept here only so the form
// doesn't crash if a legacy config is loaded; admin UI no longer offers this).
export const DEFAULT_TIER: PricingTier = {
  minMiles: 0,
  maxMiles: 25,
  flatPrice: 120,
};

// Default category rules for CATEGORY_ABC mode (progressive tiered).
// Math: baseFee + Σ(band_miles × band_rate)
// Example with baseFee=50: 15 mi -> $80, 25 mi -> $100, 50 mi -> $145, 100 mi -> $232.50.
export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'A',
    minMiles: 0,
    maxMiles: 25,
    baseFee: null,
    perMileRate: 2.0,
    flatPrice: null,
  },
  {
    category: 'B',
    minMiles: 25,
    maxMiles: 50,
    baseFee: null,
    perMileRate: 1.8,
    flatPrice: null,
  },
  {
    category: 'C',
    minMiles: 50,
    maxMiles: null,
    baseFee: null,
    perMileRate: 1.75,
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
    flatMiles: config.flatMiles,
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
