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
}

interface AdminStats {
  totalReferrals: number;
  successfulReferrals: number;
  activeReferrals: number;
  expiredReferrals: number;
  uniqueReferrers: number;
  totalPaidOut: number;
  totalPending: number;
}

interface ReferrerRow {
  referrerId: string;
  referrerName: string;
  referrerEmail: string | null;
  totalReferrals: number;
  successfulReferrals: number;
  totalTrips: number;
  totalEarned: number;
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

  // ── Referrers list state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ── Detail dialog state ──
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReferrerId, setDetailReferrerId] = useState<string | null>(null);

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

  const handleToggleActive = () => {
    setTogglingActive(true);
    toggleActiveMutation.mutate({ isActive: !formIsActive });
  };

  const handleSaveConfig = () => {
    // Validate
    const threshold = Number(formThreshold);
    const referrerAmount = Number(formReferrerAmount);
    const requiredDeliveries = Number(formRequiredDeliveries);
    const referredAmount = Number(formReferredAmount);

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

    const payload = {
      isActive: formIsActive,
      rewardTrigger: formTrigger,
      requiredDeliveries,
      timeLimitMode: formTimeMode,
      windowStartDate: formTimeMode === 'CALENDAR_RANGE' ? new Date(formWindowStart).toISOString() : null,
      windowEndDate: formTimeMode === 'CALENDAR_RANGE' ? new Date(formWindowEnd).toISOString() : null,
      referrerRewardAmount: referrerAmount,
      referralThreshold: threshold,
      referredGetsReward: formReferredGetsReward,
      referredRewardAmount: formReferredGetsReward ? referredAmount : null,
    };

    // ── Threshold-lowering warning (#5) ──
    // If the new threshold is LOWER than the currently-saved one,
    // warn the admin that this may trigger retroactive tier payouts.
    // Example: referrer has 25 successful referrals, current threshold
    // = 20 (paid 1 tier = $150). If admin lowers to 10, the next
    // trigger call fires tier 2 (25/10 = 2) → another $150 paid out
    // immediately for the same 25 referrals.
    if (config && threshold < config.referralThreshold) {
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
  const referrersQuery = useDataQuery<{ referrers: ReferrerRow[]; total: number; page: number; pageSize: number }>({
    apiEndPoint: `${API_URL}/api/referrals/admin/referrers?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(searchQuery)}`,
    noFilter: true,
  });

  // ── Fetch referrer detail ──
  const detailQuery = useDataQuery<ReferrerDetail>({
    apiEndPoint: `${API_URL}/api/referrals/admin/referrers/${detailReferrerId}`,
    noFilter: true,
    enabled: !!detailReferrerId,
  });

  const openDetail = (referrerId: string) => {
    setDetailReferrerId(referrerId);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailReferrerId(null);
  };

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Re-trigger referrers query when debouncedSearch or page changes
  useEffect(() => {
    if (debouncedSearch !== searchQuery || page !== 1) {
      referrersQuery.refetch();
    }
  }, [debouncedSearch, page]);

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
              <Button
                onClick={handleToggleActive}
                disabled={togglingActive || !config}
                className={
                  // Button color reflects the ACTION the button will perform:
                  //   - currently ACTIVE → amber (warning, clicking will pause)
                  //   - currently PAUSED → emerald (go, clicking will activate)
                  formIsActive
                    ? 'px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold transition inline-flex items-center gap-2 shrink-0' 
                    : 'px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold transition inline-flex items-center gap-2 shrink-0'
                }
              >
                {togglingActive || !config ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> ...
                  </>
                ) : formIsActive ? (
                  // Currently ACTIVE → button says "Deactivate" (clicking pauses)
                  <>
                    <Power className="w-4 h-4" /> Deactivate
                  </>
                ) : (
                  // Currently PAUSED → button says "Activate" (clicking resumes)
                  <>
                    <Check className="w-4 h-4" /> Activate
                  </>
                )}
              </Button>
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

            {/* ── Referred driver reward ── */}
            <div className="space-y-3">
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <StatCard label="Total Referrals" value={String(stats.totalReferrals)} icon={Users} />
                <StatCard label="Successful" value={String(stats.successfulReferrals)} icon={Check} color="emerald" />
                <StatCard label="Active" value={String(stats.activeReferrals)} icon={Clock} color="amber" />
                <StatCard label="Expired" value={String(stats.expiredReferrals)} icon={X} color="red" />
                <StatCard label="Unique Referrers" value={String(stats.uniqueReferrers)} icon={Users} />
                <StatCard label="Total Paid Out" value={formatMoney(stats.totalPaidOut)} icon={DollarSign} color="emerald" />
                <StatCard label="Pending" value={formatMoney(stats.totalPending)} icon={TrendingUp} color="amber" />
              </div>
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
                          <div className="font-bold text-slate-900 dark:text-white">
                            {r.referrerName}
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
                        <TableCell className="text-right">{r.totalTrips}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(r.totalEarned)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.lastPaidTier > 0 ? (
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
