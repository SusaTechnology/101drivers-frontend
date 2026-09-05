// @ts-nocheck
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from '@/lib/theme';
import { toast } from "sonner";
import { useDataQuery, useDataMutation } from "@/lib/tanstack/dataQuery";
import {
  Gift,
  Users,
  DollarSign,
  Calendar,
  Power,
  Check,
  X,
  Clock,
  Loader2,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Search,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Navbar } from "../shared/layout/testNavbar";
import { Brand } from "@/lib/items/brand";
import { useAdminActions } from "@/hooks/useAdminActions";
import { navItems } from "@/lib/items/navItems";

const API_URL = import.meta.env.VITE_API_URL;

// ────────────────────────────────────────────────────────────────────
// Types — mirror the backend DTOs (ReferralProgramSettingsResponseDto)
// ────────────────────────────────────────────────────────────────────
type RewardTrigger = 'ON_APPROVED' | 'ON_DELIVERIES_COMPLETED';
type TimeLimitMode = 'CALENDAR_RANGE' | 'FOREVER';
type PayoutModel = 'TIERED' | 'PER_DELIVERY';
type ReferralType = 'DRIVER' | 'CUSTOMER';

// ── V3.1: who can refer whom — the SINGLE SOURCE OF TRUTH (lives in the
// backend referral config; this editor is just its admin UI). matrix[
// referrerRole][referredRole] = allowed? Drives the invite-page signup
// buttons, the signup-form validation, AND server-side apply rejection.
type MatrixRole = 'DRIVER' | 'PERSONAL' | 'BUSINESS';
type RoleMatrix = Record<MatrixRole, Record<MatrixRole, boolean>>;
const MATRIX_ROLES: MatrixRole[] = ['DRIVER', 'PERSONAL', 'BUSINESS'];
const MATRIX_ROLE_LABEL: Record<MatrixRole, string> = {
  DRIVER: 'Driver',
  PERSONAL: 'Personal customer',
  BUSINESS: 'Business customer',
};
const DEFAULT_ROLE_MATRIX: RoleMatrix = {
  DRIVER: { DRIVER: true, PERSONAL: true, BUSINESS: false },
  PERSONAL: { DRIVER: true, PERSONAL: true, BUSINESS: false },
  BUSINESS: { DRIVER: true, PERSONAL: true, BUSINESS: true },
};

interface ReferralConfig {
  isActive: boolean;
  rewardTrigger: RewardTrigger;
  requiredDeliveries: number;
  timeLimitMode: TimeLimitMode;
  windowStartDate: string | null;
  windowEndDate: string | null;
  referrerRewardAmount: number;
  referralThreshold: number;
  referredGetsReward: boolean;
  referredRewardAmount: number | null;
  // ── V2 fields (Phase 2) ──
  payoutModel: PayoutModel;
  perDeliveryReferrerAmountCents: number;
  perDeliveryReferredBonusCents: number;
  perDeliveryBonusTriggerCount: number;
  customerReferralsEnabled: boolean;
  driverReferralsEnabled: boolean;
  // ── V3 fields (window + business/residential programs) ──
  referralWindowDays: number;
  businessReferralAmountCents: number;
  residentialReferralAmountCents: number;
  businessReferralRollingCapCents: number;
  // ── V3.1: role matrix (optional — old configs fall back to defaults) ──
  referralRoleMatrix?: RoleMatrix;
}

interface AdminStats {
  totalReferrals: number;
  successfulReferrals: number;
  activeReferrals: number;
  expiredReferrals: number;
  uniqueReferrers: number;
  totalPaidOut: number;
  totalPending: number;
  // ── V2 fields (Phase 3) ──
  uniqueCustomerReferrers: number;
  totalCreditsIssuedCents: number;
  totalCreditsAppliedCents: number;
  perModel: { TIERED: { count: number }; PER_DELIVERY: { count: number } };
  perReferrerType: { DRIVER: { count: number }; CUSTOMER: { count: number } };
}

interface ReferrerRow {
  referrerId: string;
  referrerUserId?: string | null;
  referrerName: string;
  referrerEmail: string | null;
  referrerType: 'DRIVER' | 'CUSTOMER';
  customerType?: 'BUSINESS' | 'PRIVATE' | null;
  totalReferrals: number;
  successfulReferrals: number;
  totalTrips?: number;
  totalEarned: number;
  totalPaidDeliveries?: number;
  totalEarnedCents?: number;
  lastPaidTier: number;
}

interface ReferrerDetail {
  referrer: {
    id: string;
    name: string;
    email: string | null;
    lastPaidTier: number;
  };
  referrals: Array<{
    id: string;
    referredName: string;
    status: string;
    tripsCompleted: number;
    requiredDeliveries: number;
    rewardTrigger: string;
    expiresAt: string | null;
    createdAt: string;
    referredRewardAmount: number | null;
    referredRewardPaidAt: string | null;
  }>;
  tierPayouts: Array<{
    id: string;
    amount: number;
    status: string;
    tierNumber: number | null;
    createdAt: string;
    paidAt: string | null;
  }>;
}

// ── V2 types for the new Referrals + Credits tabs ──
interface AdminReferralRow {
  id: string;
  referralCode: string;
  status: string;
  referralType: ReferralType | null;
  payoutModel: PayoutModel | null;
  referredEmail: string | null;
  referredDriver: { id: string; name: string | null; email: string | null } | null;
  referredCustomer: {
    id: string;
    name: string | null;
    email: string | null;
    customerType: 'BUSINESS' | 'PRIVATE' | null;
  } | null;
  referrer: {
    id: string;
    name: string | null;
    email: string | null;
    type: 'DRIVER' | 'CUSTOMER';
    customerType?: 'BUSINESS' | 'PRIVATE' | null;
  } | null;
  tripsCompleted: number;
  completedPaidDeliveries: number;
  requiredDeliveries: number;
  rewardTrigger: string;
  referredGetsReward: boolean;
  referredRewardAmount: number | null;
  referredRewardPaidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface AdminReferralCreditRow {
  id: string;
  referralId: string;
  customerId: string | null;
  deliveryId: string | null;
  amountCents: number;
  reason: string;
  status: 'PENDING' | 'APPLIED' | 'EXPIRED';
  appliedAt: string | null;
  stripeInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
};

const formatMoney = (n: number): string => `$${Number(n).toFixed(2)}`;

export default function AdminReferralProgramPage() {
  const { theme, setTheme } = useTheme();
  const { actionItems, signOut } = useAdminActions();

  // ── Config state ──
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  // Threshold-lowering confirmation (#5): when the admin lowers the
  // threshold below the currently-saved value, we show a warning
  // dialog because lowering the threshold may trigger retroactive
  // tier payouts for referrers who already have successful referrals.
  // (floor(successfulCount / newThreshold) > lastPaidReferrerTier
  //  → next trigger fires one or more payouts immediately.)
  const [thresholdWarningOpen, setThresholdWarningOpen] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState<any | null>(null);

  // Form state (separate from the fetched config so admin can edit before saving)
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTrigger, setFormTrigger] = useState<RewardTrigger>('ON_DELIVERIES_COMPLETED');
  const [formRequiredDeliveries, setFormRequiredDeliveries] = useState('30');
  const [formTimeMode, setFormTimeMode] = useState<TimeLimitMode>('CALENDAR_RANGE');
  const [formWindowStart, setFormWindowStart] = useState('');
  const [formWindowEnd, setFormWindowEnd] = useState('');
  const [formReferrerAmount, setFormReferrerAmount] = useState('150');
  const [formThreshold, setFormThreshold] = useState('20');
  const [formReferredGetsReward, setFormReferredGetsReward] = useState(true);
  const [formReferredAmount, setFormReferredAmount] = useState('150');
  // ── V2 form state (Phase 2) ──
  const [formPayoutModel, setFormPayoutModel] = useState<PayoutModel>('TIERED');
  // PER_DELIVERY amounts are stored in cents; we display them in dollars
  // for the admin (e.g. $5.00 instead of 500 cents). The form converts
  // back to cents on save. This matches how Stripe + the backend think
  // about money (avoid floating-point issues).
  const [formPerDeliveryReferrerDollars, setFormPerDeliveryReferrerDollars] = useState('5.00');
  const [formPerDeliveryReferredBonusDollars, setFormPerDeliveryReferredBonusDollars] = useState('50.00');
  const [formPerDeliveryBonusTriggerCount, setFormPerDeliveryBonusTriggerCount] = useState('5');
  // ── V3 fields (window + business/residential programs) ──
  const [formReferralWindowDays, setFormReferralWindowDays] = useState('30');
  const [formBusinessReferralDollars, setFormBusinessReferralDollars] = useState('10.00');
  const [formResidentialReferralDollars, setFormResidentialReferralDollars] = useState('5.00');
  const [formBusinessCapDollars, setFormBusinessCapDollars] = useState('300.00');
  const [formCustomerReferralsEnabled, setFormCustomerReferralsEnabled] = useState(true);
  const [formDriverReferralsEnabled, setFormDriverReferralsEnabled] = useState(true);
  // ── V3.1: who-can-refer-whom editor state ──
  const [formMatrix, setFormMatrix] = useState<RoleMatrix>(DEFAULT_ROLE_MATRIX);

  // ── Referrers list state ──
  const [searchQuery, setSearchQuery] = useState('');
  // V2: referralType filter — 'ALL' (default) shows both driver + customer
  // referrers in separate requests; 'DRIVER' / 'CUSTOMER' filters to one type.
  const [referralTypeFilter, setReferralTypeFilter] = useState<'ALL' | 'DRIVER' | 'CUSTOMER'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ── Detail dialog state ──
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReferrerId, setDetailReferrerId] = useState<string | null>(null);

  // ── V2: All-Referrals list state (new "Referrals" section) ──
  const [referralsPage, setReferralsPage] = useState(1);
  const referralsPageSize = 20;
  const [referralsSearch, setReferralsSearch] = useState('');
  const [referralsTypeFilter, setReferralsTypeFilter] = useState<'ALL' | 'DRIVER' | 'CUSTOMER'>('ALL');
  const [referralsModelFilter, setReferralsModelFilter] = useState<'ALL' | 'TIERED' | 'PER_DELIVERY'>('ALL');
  const [referralsStatusFilter, setReferralsStatusFilter] = useState<string>('ALL');
  // Detail dialog for a single referral — shows credits + payouts + override button
  const [referralDetailOpen, setReferralDetailOpen] = useState(false);
  const [referralDetailId, setReferralDetailId] = useState<string | null>(null);
  // Manual override dialog state
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<'REWARD_PAID' | 'EXPIRED' | 'CLOSED'>('EXPIRED');
  const [overrideReason, setOverrideReason] = useState('');

  // ── V2: ReferralCredit list state (new "Credits" section) ──
  const [creditsPage, setCreditsPage] = useState(1);
  const creditsPageSize = 20;
  const [creditsStatusFilter, setCreditsStatusFilter] = useState<'ALL' | 'PENDING' | 'APPLIED' | 'EXPIRED'>('ALL');
  const [creditsCustomerIdFilter, setCreditsCustomerIdFilter] = useState('');
  const [creditsReferralIdFilter, setCreditsReferralIdFilter] = useState('');
  // Manual apply + expire dialog state
  const [creditActionOpen, setCreditActionOpen] = useState(false);
  const [creditActionType, setCreditActionType] = useState<'APPLY' | 'EXPIRE'>('APPLY');
  const [creditActionId, setCreditActionId] = useState<string | null>(null);
  const [creditActionStripeInvoiceId, setCreditActionStripeInvoiceId] = useState('');
  const [creditActionReason, setCreditActionReason] = useState('');

  // ── Fetch config ──
  // NOTE: useDataQuery wraps TanStack Query's useQuery, which does NOT
  // accept onSuccess (removed in v5). We use configQuery.data directly
  // + a useEffect to sync form state when the data loads/changes.
  const configQuery = useDataQuery<any>({
    apiEndPoint: `${API_URL}/api/appSettings/referral-program`,
    noFilter: true,
  });

  // Sync fetched config → local form state.
  // Runs on initial load + every refetch.
  useEffect(() => {
    const data = configQuery.data;
    if (data) {
      setConfig(data);
      setFormIsActive(data.isActive ?? true);
      setFormTrigger(data.rewardTrigger ?? 'ON_DELIVERIES_COMPLETED');
      setFormRequiredDeliveries(String(data.requiredDeliveries ?? 30));
      setFormTimeMode(data.timeLimitMode ?? 'CALENDAR_RANGE');
      setFormWindowStart(data.windowStartDate ? data.windowStartDate.slice(0, 10) : '');
      setFormWindowEnd(data.windowEndDate ? data.windowEndDate.slice(0, 10) : '');
      setFormReferrerAmount(String(data.referrerRewardAmount ?? 150));
      setFormThreshold(String(data.referralThreshold ?? 20));
      setFormReferredGetsReward(data.referredGetsReward ?? true);
      setFormReferredAmount(String(data.referredRewardAmount ?? 150));
      // ── V2 fields ──
      setFormPayoutModel(data.payoutModel ?? 'TIERED');
      // Convert cents → dollars for display (e.g. 500 → "5.00")
      setFormPerDeliveryReferrerDollars(
        ((data.perDeliveryReferrerAmountCents ?? 500) / 100).toFixed(2),
      );
      setFormPerDeliveryReferredBonusDollars(
        ((data.perDeliveryReferredBonusCents ?? 5000) / 100).toFixed(2),
      );
      setFormPerDeliveryBonusTriggerCount(String(data.perDeliveryBonusTriggerCount ?? 5));
      // ── V3 fields ──
      setFormReferralWindowDays(String(data.referralWindowDays ?? 30));
      setFormBusinessReferralDollars(((data.businessReferralAmountCents ?? 1000) / 100).toFixed(2));
      setFormResidentialReferralDollars(((data.residentialReferralAmountCents ?? 500) / 100).toFixed(2));
      setFormBusinessCapDollars(((data.businessReferralRollingCapCents ?? 30000) / 100).toFixed(2));
      setFormCustomerReferralsEnabled(data.customerReferralsEnabled ?? true);
      setFormDriverReferralsEnabled(data.driverReferralsEnabled ?? true);
      // ── V3.1: hydrate the matrix cell-by-cell (old/partial configs fall
      // back to the default policy per cell) ──
      const m = data.referralRoleMatrix;
      setFormMatrix(
        m
          ? {
              DRIVER: {
                DRIVER: m.DRIVER?.DRIVER ?? DEFAULT_ROLE_MATRIX.DRIVER.DRIVER,
                PERSONAL: m.DRIVER?.PERSONAL ?? DEFAULT_ROLE_MATRIX.DRIVER.PERSONAL,
                BUSINESS: m.DRIVER?.BUSINESS ?? DEFAULT_ROLE_MATRIX.DRIVER.BUSINESS,
              },
              PERSONAL: {
                DRIVER: m.PERSONAL?.DRIVER ?? DEFAULT_ROLE_MATRIX.PERSONAL.DRIVER,
                PERSONAL: m.PERSONAL?.PERSONAL ?? DEFAULT_ROLE_MATRIX.PERSONAL.PERSONAL,
                BUSINESS: m.PERSONAL?.BUSINESS ?? DEFAULT_ROLE_MATRIX.PERSONAL.BUSINESS,
              },
              BUSINESS: {
                DRIVER: m.BUSINESS?.DRIVER ?? DEFAULT_ROLE_MATRIX.BUSINESS.DRIVER,
                PERSONAL: m.BUSINESS?.PERSONAL ?? DEFAULT_ROLE_MATRIX.BUSINESS.PERSONAL,
                BUSINESS: m.BUSINESS?.BUSINESS ?? DEFAULT_ROLE_MATRIX.BUSINESS.BUSINESS,
              },
            }
          : DEFAULT_ROLE_MATRIX,
      );
    }
  }, [configQuery.data]);

  // ── Update config (full save) ──
  // Used by the "Save Configuration" button at the bottom of the form.
  // This endpoint validates ALL fields, so the admin must fill in
  // everything before clicking Save. The form fields are disabled
  // when the program is paused (isActive=false) — the admin must
  // activate first to edit the configuration.
  const updateConfigMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_URL}/api/appSettings/referral-program`,
    method: 'PATCH',
    onSuccess: () => {
      toast.success('Referral program settings saved');
      setSavingConfig(false);
      configQuery.refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to save', { description: error.message });
      setSavingConfig(false);
    },
  });

  // ── Toggle active state (separate endpoint) ──
  // Used by the dedicated "Activate" / "Deactivate" button next to
  // the master toggle. Hits the /active endpoint which ONLY flips
  // the isActive boolean — doesn't run cross-field validation, so
  // the admin can pause/resume the program without having to fill in
  // all the other config fields.
  const toggleActiveMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_URL}/api/appSettings/referral-program/active`,
    method: 'PATCH',
    onSuccess: (data) => {
      toast.success(
        data?.isActive
          ? 'Referral program activated'
          : 'Referral program paused'
      );
      setTogglingActive(false);
      // Update local form state + config immediately so the UI
      // reflects the change without waiting for refetch.
      setFormIsActive(!!data?.isActive);
      setConfig(data);
      configQuery.refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to toggle', { description: error.message });
      setTogglingActive(false);
    },
  });

  // Switch passes the NEW desired value (true = activate, false = pause).
  // We forward it directly to the mutation instead of computing !formIsActive.
  const handleToggleActive = (nextValue: boolean) => {
    setTogglingActive(true);
    toggleActiveMutation.mutate({ isActive: nextValue });
  };

  const handleSaveConfig = () => {
    // Validate
    const threshold = Number(formThreshold);
    const referrerAmount = Number(formReferrerAmount);
    const requiredDeliveries = Number(formRequiredDeliveries);
    const referredAmount = Number(formReferredAmount);
    // V2 validations
    const perDeliveryReferrerDollars = Number(formPerDeliveryReferrerDollars);
    const perDeliveryReferredBonusDollars = Number(formPerDeliveryReferredBonusDollars);
    const perDeliveryBonusTriggerCount = Number(formPerDeliveryBonusTriggerCount);

    // ── Legacy (TIERED-only) validations ──
    // Only enforced when the admin is editing the TIERED model — the
    // legacy fields are hidden (and unused) in PER_DELIVERY mode.
    if (formPayoutModel === 'TIERED') {
      if (isNaN(threshold) || threshold < 1) {
        toast.error('Invalid threshold', { description: 'Threshold must be ≥ 1.' });
        return;
      }
      if (isNaN(referrerAmount) || referrerAmount < 0) {
        toast.error('Invalid referrer amount', { description: 'Referrer reward must be ≥ $0.' });
        return;
      }
      if (formTrigger === 'ON_DELIVERIES_COMPLETED' && (isNaN(requiredDeliveries) || requiredDeliveries < 1)) {
        toast.error('Invalid required deliveries', { description: 'Required deliveries must be ≥ 1.' });
        return;
      }
      if (formReferredGetsReward && (isNaN(referredAmount) || referredAmount < 0)) {
        toast.error('Invalid referred amount', { description: 'Referred reward must be ≥ $0.' });
        return;
      }
      if (formTimeMode === 'CALENDAR_RANGE' && (!formWindowStart || !formWindowEnd)) {
        toast.error('Missing dates', { description: 'Window start + end dates are required for CALENDAR_RANGE mode.' });
        return;
      }
    }
    // V2 validations
    if (formPayoutModel === 'PER_DELIVERY') {
      if (isNaN(perDeliveryReferrerDollars) || perDeliveryReferrerDollars < 0) {
        toast.error('Invalid per-delivery referrer amount', { description: 'Must be ≥ $0.00.' });
        return;
      }
      if (isNaN(perDeliveryReferredBonusDollars) || perDeliveryReferredBonusDollars < 0) {
        toast.error('Invalid per-delivery referred bonus', { description: 'Must be ≥ $0.00.' });
        return;
      }
      if (isNaN(perDeliveryBonusTriggerCount) || perDeliveryBonusTriggerCount < 1) {
        toast.error('Invalid bonus trigger count', { description: 'Must be ≥ 1.' });
        return;
      }
    }

    const payload: any = {
      isActive: formIsActive,
      // ── V2 fields ──
      payoutModel: formPayoutModel,
      // Convert dollars → cents for the backend
      perDeliveryReferrerAmountCents: Math.round(perDeliveryReferrerDollars * 100),
      perDeliveryReferredBonusCents: Math.round(perDeliveryReferredBonusDollars * 100),
      perDeliveryBonusTriggerCount: Math.floor(perDeliveryBonusTriggerCount),
      // ── V3 fields ──
      referralWindowDays: Math.max(1, Math.floor(Number(formReferralWindowDays) || 30)),
      businessReferralAmountCents: Math.round(Number(formBusinessReferralDollars || '0') * 100),
      residentialReferralAmountCents: Math.round(Number(formResidentialReferralDollars || '0') * 100),
      businessReferralRollingCapCents: Math.round(Number(formBusinessCapDollars || '0') * 100),
      customerReferralsEnabled: formCustomerReferralsEnabled,
      driverReferralsEnabled: formDriverReferralsEnabled,
      // ── V3.1: the who-can-refer-whom grid ──
      referralRoleMatrix: formMatrix,
    };

    // ── Legacy (TIERED-only) policy fields ──
    // Sent ONLY when the admin is editing the TIERED model. Omitted
    // keys are preserved by the backend's partial merge, and the
    // PER_DELIVERY engine never reads them for new referrals.
    if (formPayoutModel === 'TIERED') {
      Object.assign(payload, {
        rewardTrigger: formTrigger,
        requiredDeliveries,
        timeLimitMode: formTimeMode,
        windowStartDate: formTimeMode === 'CALENDAR_RANGE' ? new Date(formWindowStart).toISOString() : null,
        windowEndDate: formTimeMode === 'CALENDAR_RANGE' ? new Date(formWindowEnd).toISOString() : null,
        referrerRewardAmount: referrerAmount,
        referralThreshold: threshold,
        referredGetsReward: formReferredGetsReward,
        referredRewardAmount: formReferredGetsReward ? referredAmount : null,
      });
    }

    // ── Threshold-lowering warning (#5) ──
    // If the new threshold is LOWER than the currently-saved one,
    // warn the admin that this may trigger retroactive tier payouts.
    // Example: referrer has 25 successful referrals, current threshold
    // = 20 (paid 1 tier = $150). If admin lowers to 10, the next
    // trigger call fires tier 2 (25/10 = 2) → another $150 paid out
    // immediately for the same 25 referrals.
    if (formPayoutModel === 'TIERED' && config && threshold < config.referralThreshold) {
      setPendingSavePayload(payload);
      setThresholdWarningOpen(true);
      return;
    }

    doSave(payload);
  };

  const doSave = (payload: any) => {
    setSavingConfig(true);
    updateConfigMutation.mutate(payload);
  };

  const confirmThresholdLowering = () => {
    setThresholdWarningOpen(false);
    if (pendingSavePayload) {
      doSave(pendingSavePayload);
      setPendingSavePayload(null);
    }
  };

  const cancelThresholdLowering = () => {
    setThresholdWarningOpen(false);
    setPendingSavePayload(null);
  };

  // ── Fetch program stats ──
  const statsQuery = useDataQuery<AdminStats>({
    apiEndPoint: `${API_URL}/api/referrals/admin/stats`,
    noFilter: true,
  });

  // ── Fetch referrers list ──
  // V2: append `referralType` to the URL when filtering. The backend
  // supports `?referralType=DRIVER|CUSTOMER` (omitting = default DRIVER).
  // We default to ALL → omit the param to keep the URL backward-compatible
  // (the backend defaults to DRIVER when the param is missing).
  const referrersApiUrl = (() => {
    const url = new URL(`${API_URL}/api/referrals/admin/referrers`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    if (searchQuery) {
      url.searchParams.set('search', searchQuery);
    }
    if (referralTypeFilter !== 'ALL') {
      url.searchParams.set('referralType', referralTypeFilter);
    }
    return url.toString();
  })();

  const referrersQuery = useDataQuery<{ referrers: ReferrerRow[]; total: number; page: number; pageSize: number }>({
    apiEndPoint: referrersApiUrl,
    noFilter: true,
    queryKey: ['admin-referrers', page, searchQuery, referralTypeFilter],
  });

  // ── Fetch referrer detail ──
  const detailQuery = useDataQuery<ReferrerDetail>({
    apiEndPoint: `${API_URL}/api/referrals/admin/referrers/${detailReferrerId}`,
    noFilter: true,
    enabled: !!detailReferrerId,
  });

  // ── V2: Fetch all-referrals list ──
  const referralsListApiUrl = (() => {
    const url = new URL(`${API_URL}/api/referrals/admin/referrals`);
    url.searchParams.set('page', String(referralsPage));
    url.searchParams.set('pageSize', String(referralsPageSize));
    if (referralsSearch) {
      url.searchParams.set('search', referralsSearch);
    }
    if (referralsTypeFilter !== 'ALL') {
      url.searchParams.set('referralType', referralsTypeFilter);
    }
    if (referralsModelFilter !== 'ALL') {
      url.searchParams.set('payoutModel', referralsModelFilter);
    }
    if (referralsStatusFilter !== 'ALL') {
      url.searchParams.set('status', referralsStatusFilter);
    }
    return url.toString();
  })();

  const referralsListQuery = useDataQuery<{
    referrals: AdminReferralRow[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    apiEndPoint: referralsListApiUrl,
    noFilter: true,
    queryKey: [
      'admin-referrals-list',
      referralsPage,
      referralsSearch,
      referralsTypeFilter,
      referralsModelFilter,
      referralsStatusFilter,
    ],
  });

  // ── V2: Fetch single referral detail (for the detail dialog) ──
  const referralDetailQuery = useDataQuery<{
    referral: any;
    credits: AdminReferralCreditRow[];
    payouts: any[];
  }>({
    apiEndPoint: `${API_URL}/api/referrals/admin/referrals/${referralDetailId}`,
    noFilter: true,
    enabled: !!referralDetailId,
    queryKey: ['admin-referral-detail', referralDetailId],
  });

  // ── V2: Manual override referral status mutation ──
  const overrideStatusMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_URL}/api/referrals/admin/referrals/${referralDetailId}/override-status`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Referral status updated', {
        description: `Changed to ${overrideStatus}${overrideReason ? ` — ${overrideReason}` : ''}`,
      });
      setOverrideOpen(false);
      setOverrideReason('');
      // Refetch the detail + list + stats so the admin sees the change
      referralDetailQuery.refetch();
      referralsListQuery.refetch();
      statsQuery.refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to override status', { description: error.message });
    },
  });

  // ── V2: Fetch ReferralCredit list ──
  const creditsListApiUrl = (() => {
    const url = new URL(`${API_URL}/api/referrals/admin/credits`);
    url.searchParams.set('page', String(creditsPage));
    url.searchParams.set('pageSize', String(creditsPageSize));
    if (creditsStatusFilter !== 'ALL') {
      url.searchParams.set('status', creditsStatusFilter);
    }
    if (creditsCustomerIdFilter.trim()) {
      url.searchParams.set('customerId', creditsCustomerIdFilter.trim());
    }
    if (creditsReferralIdFilter.trim()) {
      url.searchParams.set('referralId', creditsReferralIdFilter.trim());
    }
    return url.toString();
  })();

  const creditsListQuery = useDataQuery<{
    credits: AdminReferralCreditRow[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    apiEndPoint: creditsListApiUrl,
    noFilter: true,
    queryKey: [
      'admin-referral-credits',
      creditsPage,
      creditsStatusFilter,
      creditsCustomerIdFilter,
      creditsReferralIdFilter,
    ],
  });

  // ── V2: Manual apply ReferralCredit mutation ──
  const applyCreditMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_URL}/api/referrals/admin/credits/${creditActionId}/apply`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Credit applied', {
        description: creditActionStripeInvoiceId
          ? `Marked APPLIED with invoice ${creditActionStripeInvoiceId}`
          : 'Marked APPLIED',
      });
      setCreditActionOpen(false);
      setCreditActionStripeInvoiceId('');
      creditsListQuery.refetch();
      statsQuery.refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to apply credit', { description: error.message });
    },
  });

  // ── V2: Manual expire ReferralCredit mutation ──
  const expireCreditMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_URL}/api/referrals/admin/credits/${creditActionId}/expire`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Credit expired', {
        description: creditActionReason
          ? `Marked EXPIRED — ${creditActionReason}`
          : 'Marked EXPIRED',
      });
      setCreditActionOpen(false);
      setCreditActionReason('');
      creditsListQuery.refetch();
      statsQuery.refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to expire credit', { description: error.message });
    },
  });

  const openDetail = (referrerId: string) => {
    setDetailReferrerId(referrerId);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailReferrerId(null);
  };

  // Reset to page 1 when the search query or referralType filter changes.
  // (The queryKey in referrersQuery already auto-refetches on these
  // changes — no manual refetch needed.)
  useEffect(() => {
    setPage(1);
  }, [searchQuery, referralTypeFilter]);

  const stats = statsQuery.data;
  const referrers = referrersQuery.data?.referrers ?? [];
  const totalReferrers = referrersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalReferrers / pageSize));
  const detail = detailQuery.data;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      <Navbar
        brand={<Brand />}
        items={navItems}
        actions={actionItems}
        onSignOut={signOut}
        title="Admin"
      />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">
        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-lime-500 font-black text-[11px] uppercase tracking-widest">
              <Gift className="h-4 w-4" />
              Referral Program
            </div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-2">
              Driver Referral Program
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
              Configure the driver referral program. The referrer earns <span className="font-bold">${formReferrerAmount}</span> for every <span className="font-bold">{formThreshold}</span> successful referrals (tiered). The referred driver earns a one-shot reward when their referral becomes successful.
            </p>
          </div>
          {config && (
            <Badge variant="outline" className={config.isActive ? "chip-emerald" : "chip-gray"}>
              {config.isActive ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" /> Active
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 mr-1" /> Paused
                </>
              )}
            </Badge>
          )}
        </div>

        {/* ── Section 1: Configuration ── */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
              Configuration
            </CardTitle>
            <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Changes take effect immediately for new referrals. Existing referrals keep their original snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ── Master on/off toggle ──
                Separate from the rest of the form: a dedicated
                Activate / Deactivate button that hits the /active
                endpoint. Doesn't require filling in any other fields. */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Program Status
                </Label>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {/* Use config?.isActive (the actual DB state from the query)
                      to avoid showing a stale "Active" flash before the query
                      loads (formIsActive defaults to true in useState). */}
                  {config
                    ? (formIsActive
                        ? 'Active — drivers can refer friends'
                        : 'Paused — "Refer a Friend" card hidden from drivers')
                    : 'Loading…'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Pausing hides the action button but keeps referral history + accrued rewards visible to drivers.
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={handleToggleActive}
                disabled={togglingActive || !config}
                aria-label="Toggle referral program"
              />
            </div>

            {/* ── Paused notice + form disable wrapper ──
                When the program is paused, the rest of the form is
                disabled (greyed out) and a notice explains that the
                admin must activate the program to edit the configuration.
                This prevents the admin from getting validation errors
                ("Window start + end dates are required...") when they
                just want to pause without filling in everything. */}
            {!formIsActive && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  The program is currently paused. To edit the configuration below, activate the program first using the button above.
                </p>
              </div>
            )}

            <fieldset
              disabled={!formIsActive || savingConfig}
              className={cn(
                'space-y-6 transition-opacity',
                !formIsActive && 'opacity-50 pointer-events-none'
              )}
            >
              {/* ── Legacy (TIERED-only) controls ──
                  The V1/V2 trigger, time-window and tier controls below
                  are read ONLY by legacy TIERED-model referrals. The V3
                  PER_DELIVERY engine (the default) never reads them, so
                  they are hidden unless the payout model is switched
                  back to TIERED — keeping the default view focused on
                  the settings that actually drive payouts. */}
              {formPayoutModel === 'TIERED' && (
              <>
              {/* ── Trigger type ── */}
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  When does the referrer get paid?
                </Label>
                <Select value={formTrigger} onValueChange={(v: RewardTrigger) => setFormTrigger(v)}>
                  <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ON_APPROVED">When the referred driver signs up and is approved</SelectItem>
                  <SelectItem value="ON_DELIVERIES_COMPLETED">When the referred driver completes N deliveries</SelectItem>
                </SelectContent>
              </Select>
              {formTrigger === 'ON_DELIVERIES_COMPLETED' && (
                <div className="space-y-2 mt-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Required deliveries (N)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={formRequiredDeliveries}
                    onChange={(e) => setFormRequiredDeliveries(e.target.value)}
                    placeholder="30"
                    className="h-12 rounded-2xl max-w-xs"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    # of completed deliveries the referred driver must make for the referral to become "successful".
                  </p>
                </div>
              )}
            </div>

            {/* ── Time window ── */}
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Time window
              </Label>
              <Select value={formTimeMode} onValueChange={(v: TimeLimitMode) => setFormTimeMode(v)}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Select window mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALENDAR_RANGE">Calendar range (specific start + end dates)</SelectItem>
                  <SelectItem value="FOREVER">Forever (no deadline)</SelectItem>
                </SelectContent>
              </Select>
              {formTimeMode === 'CALENDAR_RANGE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Window start date
                    </Label>
                    <Input
                      type="date"
                      value={formWindowStart}
                      onChange={(e) => setFormWindowStart(e.target.value)}
                      className="h-12 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Window end date
                    </Label>
                    <Input
                      type="date"
                      value={formWindowEnd}
                      onChange={(e) => setFormWindowEnd(e.target.value)}
                      className="h-12 rounded-2xl"
                    />
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Per-referral: each referral created during the window has <code>expiresAt = windowEndDate</code>. If the trigger fires past expiry, no payout — referral marked EXPIRED.
              </p>
            </div>

            {/* ── Referrer reward (tier model) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Referrer reward per tier ($)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formReferrerAmount}
                  onChange={(e) => setFormReferrerAmount(e.target.value)}
                  placeholder="150"
                  className="h-12 rounded-2xl"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Paid to the referrer every time they cross a new tier.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Referrals per tier
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  placeholder="20"
                  className="h-12 rounded-2xl"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  # of successful referrals needed per tier. E.g. 20 = $150 at 20, $300 at 40, etc.
                </p>
              </div>
            </div>
              </>
              )}

            {/* ── Referred driver reward (legacy TIERED-only) ──
                In PER_DELIVERY mode the referred party's $50 bonus is
                configured in the PER_DELIVERY settings below — this
                legacy toggle applies only to TIERED referrals. */}
            <div className="space-y-3">
              {formPayoutModel === 'TIERED' && (
              <>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Does the referred driver also get paid?
                  </Label>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {formReferredGetsReward ? `Yes — one-shot $${formReferredAmount} when their referral becomes successful` : 'No — only the referrer gets paid'}
                  </p>
                </div>
                <Switch
                  checked={formReferredGetsReward}
                  onCheckedChange={setFormReferredGetsReward}
                  aria-label="Toggle referred driver reward"
                />
              </div>
              {formReferredGetsReward && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Referred reward amount ($)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={formReferredAmount}
                    onChange={(e) => setFormReferredAmount(e.target.value)}
                    placeholder="150"
                    className="h-12 rounded-2xl max-w-xs"
                  />
                </div>
              )}
              </>
              )}

              {/* ── V2 fields (Phase 2) ──────────────────────────────────
                  These control the PER_DELIVERY model + customer-referrer
                  enable toggles. The PER_DELIVERY-specific inputs are only
                  relevant when payoutModel === 'PER_DELIVERY' (gate them
                  visually like the requiredDeliveries field is gated on
                  trigger type). */}

              {/* Payout Model selector */}
              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Payout Model
                </Label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                  TIERED = legacy driver→driver referrals (referral earns $X per N successful).
                  PER_DELIVERY = new model — referrer earns per paid delivery; referred party gets a bonus on the Nth paid delivery.
                  Applies to new referrals only — existing referrals keep their snapshotted model.
                </p>
                {formPayoutModel === 'PER_DELIVERY' && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    PER_DELIVERY is the active program — the legacy trigger / time-window / tier controls are hidden.
                    Switch to TIERED only to maintain older referral policies.
                  </p>
                )}
                <Select
                  value={formPayoutModel}
                  onValueChange={(v) => setFormPayoutModel(v as PayoutModel)}
                >
                  <SelectTrigger className="w-full max-w-xs h-12 rounded-2xl">
                    <SelectValue placeholder="Select payout model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIERED">TIERED — legacy (per N successful referrals)</SelectItem>
                    <SelectItem value="PER_DELIVERY">PER_DELIVERY — per paid delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PER_DELIVERY-specific amounts (only shown when payoutModel=PER_DELIVERY) */}
              {formPayoutModel === 'PER_DELIVERY' && (
                <div className="space-y-4 p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                    PER_DELIVERY Settings
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Referrer per delivery ($)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formPerDeliveryReferrerDollars}
                        onChange={(e) => setFormPerDeliveryReferrerDollars(e.target.value)}
                        placeholder="5.00"
                        className="h-12 rounded-2xl"
                      />
                      <p className="text-[10px] text-slate-500">
                        Paid to referrer on each paid delivery. Default $5.00.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Referred bonus ($)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formPerDeliveryReferredBonusDollars}
                        onChange={(e) => setFormPerDeliveryReferredBonusDollars(e.target.value)}
                        placeholder="50.00"
                        className="h-12 rounded-2xl"
                      />
                      <p className="text-[10px] text-slate-500">
                        One-shot bonus to the referred party on the Nth paid delivery. Default $50.00.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Bonus trigger count
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={formPerDeliveryBonusTriggerCount}
                        onChange={(e) => setFormPerDeliveryBonusTriggerCount(e.target.value)}
                        placeholder="5"
                        className="h-12 rounded-2xl"
                      />
                      <p className="text-[10px] text-slate-500">
                        Which paid delivery triggers the bonus. Default 5 (the 5th).
                      </p>
                    </div>
                  </div>

                  {/* ── V3: driver-referral window ── */}
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Driver referral window (days from signup)
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={formReferralWindowDays}
                      onChange={(e) => setFormReferralWindowDays(e.target.value)}
                      placeholder="30"
                      className="h-12 rounded-2xl max-w-xs"
                    />
                    <p className="text-[10px] text-slate-500">
                      The referred driver must complete the bonus trigger count of paid deliveries
                      within this many days of signing up, or the referral expires UNPAID (no partial
                      payout). Clock starts at the driver's account creation. Default 30.
                    </p>
                  </div>

                  {/* ── V3: business / residential referral rewards ── */}
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Business referral reward ($) — one-time
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formBusinessReferralDollars}
                      onChange={(e) => setFormBusinessReferralDollars(e.target.value)}
                      placeholder="10.00"
                      className="h-12 rounded-2xl"
                    />
                    <p className="text-[10px] text-slate-500">
                      Paid to the referrer ONCE when a referred BUSINESS customer completes their first
                      paid delivery. Default $10.00.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Business referral rolling cap ($ / 30 days)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formBusinessCapDollars}
                      onChange={(e) => setFormBusinessCapDollars(e.target.value)}
                      placeholder="300.00"
                      className="h-12 rounded-2xl"
                    />
                    <p className="text-[10px] text-slate-500">
                      Max a referrer can earn from business referrals in any trailing 30-day window.
                      Overflow is forfeited. 0 disables the cap. Default $300.00.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Residential referral reward ($) — one-time
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formResidentialReferralDollars}
                      onChange={(e) => setFormResidentialReferralDollars(e.target.value)}
                      placeholder="5.00"
                      className="h-12 rounded-2xl"
                    />
                    <p className="text-[10px] text-slate-500">
                      Paid to the referrer ONCE when a referred PERSONAL customer completes their first
                      paid delivery. No cap. Default $5.00.
                    </p>
                  </div>
                </div>
              )}

              {/* ── V3.1: Who can refer whom — the SINGLE SOURCE OF TRUTH.
                  Drives the /test-referral/:code invite-page buttons, the
                  signup-form validation messages, AND server-side apply
                  rejection. Flip a switch + Save — no code change needed. */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Who Can Refer Whom
                </Label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  One switch per referrer → referred combination. This is the single source of truth:
                  it decides which signup buttons appear on the public invite page, whether a signup form
                  accepts a code, and whether the backend rejects the referral. Change it here and save —
                  every surface follows instantly.
                </p>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left font-black uppercase tracking-widest text-slate-500 py-3 pl-3 pr-2">
                          Referrer ↓ refers a…
                        </th>
                        {MATRIX_ROLES.map((target) => (
                          <th
                            key={target}
                            className="py-3 px-2 font-black uppercase tracking-widest text-slate-500 text-center"
                          >
                            {MATRIX_ROLE_LABEL[target]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MATRIX_ROLES.map((referrer) => (
                        <tr
                          key={referrer}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-3 pl-3 pr-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {MATRIX_ROLE_LABEL[referrer]}
                          </td>
                          {MATRIX_ROLES.map((target) => (
                            <td key={target} className="py-3 px-2 text-center">
                              <Switch
                                checked={formMatrix[referrer][target]}
                                onCheckedChange={(v) =>
                                  setFormMatrix((prev) => ({
                                    ...prev,
                                    [referrer]: { ...prev[referrer], [target]: v },
                                  }))
                                }
                                aria-label={`${MATRIX_ROLE_LABEL[referrer]} referring a ${MATRIX_ROLE_LABEL[target]}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500">
                  Reward depends on who IS referred: a referred driver pays $50 on their 5th paid delivery
                  (within the signup window); a referred business pays $10 once (rolling 30-day cap); a
                  referred personal customer pays $5 once (no cap).
                </p>
              </div>

              {/* Referrer-type enable toggles — independent of the master
                  isActive flag. Lets the admin enable customer referrals
                  while keeping driver referrals disabled (or vice versa). */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Referrer Type Toggles
                </Label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Independently enable/disable driver vs customer referrer flows.
                  When the master program is paused (isActive=false), no new
                  referrals of either type are accepted. When unpaused but one
                  of these is off, only the enabled type accepts new codes.
                </p>

                {/* Driver referrals toggle */}
                <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Driver → Driver referrals
                    </Label>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {formDriverReferralsEnabled
                        ? 'Enabled — drivers can refer other drivers'
                        : 'Disabled — driver referral codes are rejected at signup'}
                    </p>
                  </div>
                  <Switch
                    checked={formDriverReferralsEnabled}
                    onCheckedChange={setFormDriverReferralsEnabled}
                    aria-label="Toggle driver referrals"
                  />
                </div>

                {/* Customer referrals toggle */}
                <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Customer → Customer / Driver referrals
                    </Label>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {formCustomerReferralsEnabled
                        ? 'Enabled — dealers + private customers can refer'
                        : 'Disabled — customer referral codes are rejected at signup'}
                    </p>
                  </div>
                  <Switch
                    checked={formCustomerReferralsEnabled}
                    onCheckedChange={setFormCustomerReferralsEnabled}
                    aria-label="Toggle customer referrals"
                  />
                </div>
              </div>
            </div>
            </fieldset>

            {/* ── Save button ──
                Disabled when the program is paused (form fields are
                also disabled, so there's nothing to save). The admin
                must activate the program first to edit + save the config. */}
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                onClick={handleSaveConfig}
                disabled={savingConfig || !formIsActive}
                className="px-6 py-3 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition inline-flex items-center gap-2"
              >
                {savingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Save Configuration
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Program Stats ── */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
              Program Stats
            </CardTitle>
            <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Platform-wide referral totals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
              </div>
            ) : stats ? (
              <>
                {/* ── Primary stats (V1 — kept for backward compatibility) ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                  <StatCard label="Total Referrals" value={String(stats.totalReferrals)} icon={Users} />
                  <StatCard label="Successful" value={String(stats.successfulReferrals)} icon={Check} color="emerald" />
                  <StatCard label="Active" value={String(stats.activeReferrals)} icon={Clock} color="amber" />
                  <StatCard label="Expired" value={String(stats.expiredReferrals)} icon={X} color="red" />
                  <StatCard label="Driver Referrers" value={String(stats.uniqueReferrers)} icon={Users} />
                  <StatCard label="Total Paid Out" value={formatMoney(stats.totalPaidOut)} icon={DollarSign} color="emerald" />
                  <StatCard label="Pending" value={formatMoney(stats.totalPending)} icon={TrendingUp} color="amber" />
                </div>

                {/* ── V2 stats — customer referrers + ReferralCredit totals ── */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                    Customer referrers & ReferralCredit totals
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <StatCard
                      label="Customer Referrers"
                      value={String(stats.uniqueCustomerReferrers ?? 0)}
                      icon={Users}
                    />
                    <StatCard
                      label="Credits Issued"
                      value={formatMoney((stats.totalCreditsIssuedCents ?? 0) / 100)}
                      icon={DollarSign}
                      color="emerald"
                    />
                    <StatCard
                      label="Credits Applied"
                      value={formatMoney((stats.totalCreditsAppliedCents ?? 0) / 100)}
                      icon={Check}
                      color="emerald"
                    />
                    <StatCard
                      label="TIERED Referrals"
                      value={String(stats.perModel?.TIERED?.count ?? 0)}
                      icon={TrendingUp}
                    />
                    <StatCard
                      label="PER_DELIVERY Referrals"
                      value={String(stats.perModel?.PER_DELIVERY?.count ?? 0)}
                      icon={TrendingUp}
                      color="emerald"
                    />
                    <StatCard
                      label="Customer-type Referrals"
                      value={String(stats.perReferrerType?.CUSTOMER?.count ?? 0)}
                      icon={Users}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">Failed to load stats.</div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Referrers Table ── */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                  Referrers
                </CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Click a row to see per-referral breakdown.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* V2: referralType filter (driver vs customer referrers) */}
                <Select
                  value={referralTypeFilter}
                  onValueChange={(v) => setReferralTypeFilter(v as 'ALL' | 'DRIVER' | 'CUSTOMER')}
                >
                  <SelectTrigger className="w-[180px] h-10 rounded-2xl">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All referrers</SelectItem>
                    <SelectItem value="DRIVER">Driver referrers</SelectItem>
                    <SelectItem value="CUSTOMER">Customer referrers</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 pl-10 rounded-2xl"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {referrersQuery.isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
              </div>
            ) : referrers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">No referrers yet.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead className="text-right">Total referrals</TableHead>
                      <TableHead className="text-right">Successful</TableHead>
                      <TableHead className="text-right">Trips total</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Last paid tier</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrers.map((r) => (
                      <TableRow
                        key={r.referrerId}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        onClick={() => openDetail(r.referrerId)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {r.referrerName}
                            </div>
                            {/* V2: show referrer type badge (DRIVER vs CUSTOMER) */}
                            {r.referrerType === 'CUSTOMER' ? (
                              <Badge variant="outline" className="chip-emerald">
                                Customer
                                {r.customerType === 'BUSINESS' && ' (dealer)'}
                                {r.customerType === 'PRIVATE' && ' (private)'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="chip-gray">
                                Driver
                              </Badge>
                            )}
                          </div>
                          {r.referrerEmail && (
                            <div className="text-xs text-slate-500">{r.referrerEmail}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">{r.totalReferrals}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="chip-emerald">
                            {r.successfulReferrals}
                          </Badge>
                        </TableCell>
                        {/* V2: customer referrers don't have totalTrips — show
                            totalPaidDeliveries (PER_DELIVERY model) instead. */}
                        <TableCell className="text-right">
                          {r.referrerType === 'CUSTOMER'
                            ? (r.totalPaidDeliveries ?? 0)
                            : (r.totalTrips ?? 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {/* V2: customer referrers earn credits in cents;
                              driver referrers earn dollars (from DriverPayout). */}
                          {r.referrerType === 'CUSTOMER'
                            ? formatMoney((r.totalEarnedCents ?? 0) / 100)
                            : formatMoney(r.totalEarned)}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* V2: only driver referrers have tier payouts */}
                          {r.referrerType === 'DRIVER' && r.lastPaidTier > 0 ? (
                            <Badge variant="outline" className="chip-gray">
                              Tier {r.lastPaidTier}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalReferrers)} of {totalReferrers}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-2xl"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="rounded-2xl"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4 (V2): All Referrals Table ── */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                  All Referrals
                </CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Every referral record — filter by type, model, status, or search by code/email.
                  Click a row to see the full detail (credits + payouts) + manual override.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={referralsTypeFilter}
                  onValueChange={(v) => {
                    setReferralsTypeFilter(v as any);
                    setReferralsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px] h-10 rounded-2xl">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All types</SelectItem>
                    <SelectItem value="DRIVER">Driver referrer</SelectItem>
                    <SelectItem value="CUSTOMER">Customer referrer</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={referralsModelFilter}
                  onValueChange={(v) => {
                    setReferralsModelFilter(v as any);
                    setReferralsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px] h-10 rounded-2xl">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All models</SelectItem>
                    <SelectItem value="TIERED">TIERED</SelectItem>
                    <SelectItem value="PER_DELIVERY">PER_DELIVERY</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={referralsStatusFilter}
                  onValueChange={(v) => {
                    setReferralsStatusFilter(v as any);
                    setReferralsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px] h-10 rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="REGISTERED">REGISTERED</SelectItem>
                    <SelectItem value="ONBOARDING_COMPLETE">ONBOARDING_COMPLETE</SelectItem>
                    <SelectItem value="TRIPPING">TRIPPING</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                    <SelectItem value="REWARD_PAID">REWARD_PAID</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                    <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="Search by code or email..."
                    value={referralsSearch}
                    onChange={(e) => {
                      setReferralsSearch(e.target.value);
                      setReferralsPage(1);
                    }}
                    className="h-10 pl-10 rounded-2xl"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {referralsListQuery.isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
              </div>
            ) : (referralsListQuery.data?.referrals ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">No referrals match the current filters.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Referrer</TableHead>
                      <TableHead>Referred</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(referralsListQuery.data?.referrals ?? []).map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        onClick={() => {
                          setReferralDetailId(r.id);
                          setReferralDetailOpen(true);
                        }}
                      >
                        <TableCell>
                          <span className="font-mono font-bold text-slate-900 dark:text-white tracking-wider">
                            {r.referralCode}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {r.referrer?.name ?? '—'}
                          </div>
                          {r.referrer?.type && (
                            <Badge variant="outline" className={r.referrer.type === 'CUSTOMER' ? 'chip-emerald' : 'chip-gray'}>
                              {r.referrer.type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {r.referredDriver?.name ?? r.referredCustomer?.name ?? r.referredEmail ?? '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.referredDriver?.email ?? r.referredCustomer?.email ?? r.referredEmail ?? ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.referralType && (
                            <Badge variant="outline" className={r.referralType === 'CUSTOMER' ? 'chip-emerald' : 'chip-gray'}>
                              {r.referralType}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.payoutModel && (
                            <Badge variant="outline" className="chip-gray">
                              {r.payoutModel}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            r.status === 'REWARD_PAID' ? 'chip-emerald' :
                            r.status === 'EXPIRED' || r.status === 'CLOSED' ? 'chip-red' :
                            'chip-gray'
                          }>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.payoutModel === 'PER_DELIVERY' ? (
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {r.completedPaidDeliveries} paid / {r.requiredDeliveries} req
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {r.tripsCompleted} / {r.requiredDeliveries}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(r.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    Showing {(referralsPage - 1) * referralsPageSize + 1}–{Math.min(referralsPage * referralsPageSize, referralsListQuery.data?.total ?? 0)} of {referralsListQuery.data?.total ?? 0}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={referralsPage <= 1}
                      onClick={() => setReferralsPage(referralsPage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-bold">Page {referralsPage} of {Math.max(1, Math.ceil((referralsListQuery.data?.total ?? 0) / referralsPageSize))}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={referralsPage >= Math.ceil((referralsListQuery.data?.total ?? 0) / referralsPageSize)}
                      onClick={() => setReferralsPage(referralsPage + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 5 (V2): ReferralCredits Table ── */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                  Referral Credits
                </CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Per-delivery credits applied to customer invoices. Filter by status,
                  customerId, or referralId. Click Apply or Expire to manually
                  transition a PENDING credit.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={creditsStatusFilter}
                  onValueChange={(v) => {
                    setCreditsStatusFilter(v as any);
                    setCreditsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px] h-10 rounded-2xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="APPLIED">APPLIED</SelectItem>
                    <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="customerId filter..."
                  value={creditsCustomerIdFilter}
                  onChange={(e) => {
                    setCreditsCustomerIdFilter(e.target.value);
                    setCreditsPage(1);
                  }}
                  className="h-10 w-[140px] rounded-2xl"
                />
                <Input
                  type="text"
                  placeholder="referralId filter..."
                  value={creditsReferralIdFilter}
                  onChange={(e) => {
                    setCreditsReferralIdFilter(e.target.value);
                    setCreditsPage(1);
                  }}
                  className="h-10 w-[140px] rounded-2xl"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {creditsListQuery.isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
              </div>
            ) : (creditsListQuery.data?.credits ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <DollarSign className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">No credits match the current filters.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Referral</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(creditsListQuery.data?.credits ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(c.amountCents / 100)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-[260px] truncate" title={c.reason}>
                          {c.reason}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.customerId ? c.customerId.slice(-8) : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.deliveryId ? c.deliveryId.slice(-8) : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.referralId.slice(-8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            c.status === 'APPLIED' ? 'chip-emerald' :
                            c.status === 'EXPIRED' ? 'chip-red' :
                            'chip-amber'
                          }>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(c.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === 'PENDING' && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl chip-emerald"
                                onClick={() => {
                                  setCreditActionType('APPLY');
                                  setCreditActionId(c.id);
                                  setCreditActionStripeInvoiceId('');
                                  setCreditActionOpen(true);
                                }}
                              >
                                Apply
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl chip-red"
                                onClick={() => {
                                  setCreditActionType('EXPIRE');
                                  setCreditActionId(c.id);
                                  setCreditActionReason('');
                                  setCreditActionOpen(true);
                                }}
                              >
                                Expire
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    Showing {(creditsPage - 1) * creditsPageSize + 1}–{Math.min(creditsPage * creditsPageSize, creditsListQuery.data?.total ?? 0)} of {creditsListQuery.data?.total ?? 0}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creditsPage <= 1}
                      onClick={() => setCreditsPage(creditsPage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-bold">Page {creditsPage} of {Math.max(1, Math.ceil((creditsListQuery.data?.total ?? 0) / creditsPageSize))}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creditsPage >= Math.ceil((creditsListQuery.data?.total ?? 0) / creditsPageSize)}
                      onClick={() => setCreditsPage(creditsPage + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── V2: Referral detail dialog (with credits + payouts + override) ── */}
        <Dialog open={referralDetailOpen} onOpenChange={(o) => {
          setReferralDetailOpen(o);
          if (!o) setReferralDetailId(null);
        }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                Referral Detail
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                Full breakdown + manual override.
              </DialogDescription>
            </DialogHeader>
            {referralDetailQuery.isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 mx-auto text-slate-400 animate-spin" />
              </div>
            ) : referralDetailQuery.data ? (
              <div className="space-y-4">
                {/* Referral summary */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-slate-900 dark:text-white tracking-wider">
                      {referralDetailQuery.data.referral?.referralCode}
                    </span>
                    <Badge variant="outline" className={
                      referralDetailQuery.data.referral?.status === 'REWARD_PAID' ? 'chip-emerald' :
                      referralDetailQuery.data.referral?.status === 'EXPIRED' || referralDetailQuery.data.referral?.status === 'CLOSED' ? 'chip-red' :
                      'chip-gray'
                    }>
                      {referralDetailQuery.data.referral?.status}
                    </Badge>
                    {referralDetailQuery.data.referral?.referralType && (
                      <Badge variant="outline" className={
                        referralDetailQuery.data.referral.referralType === 'CUSTOMER' ? 'chip-emerald' : 'chip-gray'
                      }>
                        {referralDetailQuery.data.referral.referralType}
                      </Badge>
                    )}
                    {referralDetailQuery.data.referral?.payoutModel && (
                      <Badge variant="outline" className="chip-gray">
                        {referralDetailQuery.data.referral.payoutModel}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>Created: {formatDate(referralDetailQuery.data.referral?.createdAt)}</div>
                    <div>Expires: {formatDate(referralDetailQuery.data.referral?.expiresAt)}</div>
                    <div>
                      Progress: {referralDetailQuery.data.referral?.payoutModel === 'PER_DELIVERY'
                        ? `${referralDetailQuery.data.referral?.completedPaidDeliveries} paid deliveries`
                        : `${referralDetailQuery.data.referral?.tripsCompleted} / ${referralDetailQuery.data.referral?.requiredDeliveries} trips`}
                    </div>
                  </div>
                </div>

                {/* Credits section */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                    Referral Credits ({referralDetailQuery.data.credits?.length ?? 0})
                  </p>
                  {(referralDetailQuery.data.credits ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">No credits yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(referralDetailQuery.data.credits ?? []).map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {formatMoney(c.amountCents / 100)}
                              <span className="ml-2 text-xs font-normal text-slate-500">
                                ({c.reason})
                              </span>
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDate(c.createdAt)} · {c.status}
                              {c.stripeInvoiceId && ` · invoice ${c.stripeInvoiceId}`}
                            </p>
                          </div>
                          <Badge variant="outline" className={
                            c.status === 'APPLIED' ? 'chip-emerald' :
                            c.status === 'EXPIRED' ? 'chip-red' :
                            'chip-amber'
                          }>
                            {c.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payouts section */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                    Driver Payouts ({referralDetailQuery.data.payouts?.length ?? 0})
                  </p>
                  {(referralDetailQuery.data.payouts ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">No payouts yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(referralDetailQuery.data.payouts ?? []).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {formatMoney(p.amount)}
                              <span className="ml-2 text-xs font-normal text-slate-500">
                                ({p.type}{p.tierNumber ? ` tier ${p.tierNumber}` : ''}{p.isPerDelivery ? ` · PER_DELIVERY ${p.perDeliveryId}` : ''})
                              </span>
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDate(p.createdAt)} · {p.status}
                              {p.paidAt && ` · paid ${formatDate(p.paidAt)}`}
                            </p>
                          </div>
                          <Badge variant="outline" className={
                            p.status === 'PAID' ? 'chip-emerald' :
                            p.status === 'FAILED' ? 'chip-red' :
                            'chip-amber'
                          }>
                            {p.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manual override button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    className="w-full py-3 rounded-2xl"
                    onClick={() => {
                      setOverrideStatus('EXPIRED');
                      setOverrideReason('');
                      setOverrideOpen(true);
                    }}
                    disabled={referralDetailQuery.data.referral?.status === 'REWARD_PAID'}
                  >
                    Manual Override Status
                  </Button>
                  {referralDetailQuery.data.referral?.status === 'REWARD_PAID' && (
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      REWARD_PAID referrals can't be overridden (would require a clawback).
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">Failed to load.</p>
            )}
          </DialogContent>
        </Dialog>

        {/* ── V2: Manual override referral status dialog ── */}
        <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Override Referral Status
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Admin escape hatch. Use sparingly — prefer fixing the underlying
                issue (program config, expiry window) so the trigger fires
                naturally next time.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  New status
                </Label>
                <Select
                  value={overrideStatus}
                  onValueChange={(v) => setOverrideStatus(v as any)}
                >
                  <SelectTrigger className="w-full h-12 rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REWARD_PAID">REWARD_PAID (force-fire payout)</SelectItem>
                    <SelectItem value="EXPIRED">EXPIRED (admin manually expires)</SelectItem>
                    <SelectItem value="CLOSED">CLOSED (close without payout)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Reason (optional, for audit trail)
                </Label>
                <Input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. 'admin adjusted due to support ticket #1234'"
                  className="h-12 rounded-2xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOverrideOpen(false)} className="rounded-2xl">
                Cancel
              </Button>
              <Button
                onClick={() => overrideStatusMutation.mutate({ status: overrideStatus, reason: overrideReason || undefined })}
                disabled={overrideStatusMutation.isPending}
                className="rounded-2xl lime-btn"
              >
                {overrideStatusMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Override Status</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── V2: Manual apply/expire ReferralCredit dialog ── */}
        <Dialog open={creditActionOpen} onOpenChange={setCreditActionOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                {creditActionType === 'APPLY' ? (
                  <><Check className="w-5 h-5 text-emerald-500" /> Apply Referral Credit</>
                ) : (
                  <><AlertCircle className="w-5 h-5 text-red-500" /> Expire Referral Credit</>
                )}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {creditActionType === 'APPLY'
                  ? 'Mark a PENDING credit as APPLIED. Use when you have manually applied the credit to a Stripe invoice outside of the automated flow.'
                  : 'Mark a PENDING credit as EXPIRED. Use when a credit was issued in error (wrong delivery, wrong customer) and should not be applied to an invoice.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {creditActionType === 'APPLY' && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Stripe Invoice ID (optional, for audit trail)
                  </Label>
                  <Input
                    type="text"
                    value={creditActionStripeInvoiceId}
                    onChange={(e) => setCreditActionStripeInvoiceId(e.target.value)}
                    placeholder="in_..."
                    className="h-12 rounded-2xl"
                  />
                </div>
              )}
              {creditActionType === 'EXPIRE' && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Reason (optional, appended to the credit's reason for audit trail)
                  </Label>
                  <Input
                    type="text"
                    value={creditActionReason}
                    onChange={(e) => setCreditActionReason(e.target.value)}
                    placeholder="e.g. 'wrong delivery, customer refunded separately'"
                    className="h-12 rounded-2xl"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreditActionOpen(false)} className="rounded-2xl">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (creditActionType === 'APPLY') {
                    applyCreditMutation.mutate({
                      stripeInvoiceId: creditActionStripeInvoiceId || undefined,
                    });
                  } else {
                    expireCreditMutation.mutate({
                      reason: creditActionReason || undefined,
                    });
                  }
                }}
                disabled={applyCreditMutation.isPending || expireCreditMutation.isPending}
                className={creditActionType === 'APPLY' ? 'rounded-2xl chip-emerald' : 'rounded-2xl chip-red'}
              >
                {(applyCreditMutation.isPending || expireCreditMutation.isPending) ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : creditActionType === 'APPLY' ? (
                  <><Check className="w-4 h-4 mr-2" /> Apply Credit</>
                ) : (
                  <><AlertCircle className="w-4 h-4 mr-2" /> Expire Credit</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Threshold-lowering warning dialog (#5) ── */}
        {/* ── Threshold-lowering warning dialog (#5) ── */}
        <Dialog open={thresholdWarningOpen} onOpenChange={(o) => !o && cancelThresholdLowering()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Lowering the threshold?
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                You're lowering the threshold from <span className="font-bold">{config?.referralThreshold}</span> to <span className="font-bold">{formThreshold}</span>.
                Referrers who already have successful referrals may immediately qualify for one or more new tier payouts on the next trigger fire.
                <br /><br />
                <span className="font-semibold">Example:</span> a referrer with 25 successful referrals at threshold 20 has been paid for tier 1 ($150). If you lower to 10, the next trigger call sees floor(25/10) = 2 tiers → another $150 paid out immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                onClick={cancelThresholdLowering}
                className="flex-1 rounded-2xl"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmThresholdLowering}
                className="flex-1 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold"
              >
                Save anyway
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Referrer detail dialog ── */}
        <Dialog open={detailOpen} onOpenChange={(o) => !o && closeDetail()}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <Users className="w-5 h-5 text-lime-500" />
                {detail?.referrer.name ?? 'Loading...'}
              </DialogTitle>
              <DialogDescription>
                {detail?.referrer.email ?? '—'} · Last paid tier: {detail?.referrer.lastPaidTier ?? 0}
              </DialogDescription>
            </DialogHeader>

            {detailQuery.isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-slate-400 animate-spin" />
              </div>
            ) : detail ? (
              <div className="space-y-6">
                {/* Referrals list */}
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
                    Referrals ({detail.referrals.length})
                  </h4>
                  <div className="space-y-2">
                    {detail.referrals.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">No referrals yet.</p>
                    ) : (
                      detail.referrals.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {r.referredName}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Created {formatDate(r.createdAt)} ·{' '}
                              {r.rewardTrigger === 'ON_APPROVED'
                                ? 'Trigger: on approval'
                                : `Trigger: ${r.tripsCompleted}/${r.requiredDeliveries} deliveries`}
                              {r.expiresAt && ` · Expires ${formatDate(r.expiresAt)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {r.referredRewardAmount != null && (
                              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                ${r.referredRewardAmount.toFixed(2)}
                              </div>
                            )}
                            <Badge variant="outline" className={cn(
                              'chip',
                              r.status === 'REWARD_PAID' && 'chip-emerald',
                              r.status === 'EXPIRED' && 'chip-red',
                              r.status === 'PENDING' && 'chip-gray',
                              r.status === 'REGISTERED' && 'chip-gray',
                              r.status === 'TRIPPING' && 'chip-amber',
                            )}>
                              {r.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Tier payouts */}
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
                    Tier Payouts ({detail.tierPayouts.length})
                  </h4>
                  <div className="space-y-2">
                    {detail.tierPayouts.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">No tier payouts yet.</p>
                    ) : (
                      detail.tierPayouts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white">
                              {p.tierNumber != null ? `Tier ${p.tierNumber}` : 'Payout'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Created {formatDate(p.createdAt)}
                              {p.paidAt && ` · Paid ${formatDate(p.paidAt)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(p.amount)}
                            </div>
                            <Badge variant="outline" className={cn(
                              'chip',
                              p.status === 'PAID' && 'chip-emerald',
                              p.status === 'PENDING' && 'chip-amber',
                              p.status === 'FAILED' && 'chip-red',
                            )}>
                              {p.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">Failed to load detail.</div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Stat card subcomponent
// ────────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color = 'slate',
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'slate' | 'emerald' | 'amber' | 'red';
}) {
  const colorClasses: Record<string, string> = {
    slate: 'text-slate-700 dark:text-slate-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-red-700 dark:text-red-300',
  };
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {label}
        </p>
      </div>
      <p className={`text-xl font-black ${colorClasses[color]}`}>
        {value}
      </p>
    </div>
  );
}
