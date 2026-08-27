/**
 * CustomerPricingCard — Pricing & Billing card for the admin user detail page.
 *
 * Shows a customer's current pricing configuration (read-only) with quick
 * stats: config name, mode, override, postpaid status. Includes action
 * buttons for inline edit (item 7), preview quote (item 9), and a mini
 * audit log of recent pricing changes (item 8).
 *
 * Items implemented here:
 *   - Item 6: read-only pricing summary card
 *   - Item 7: inline edit pricing form (toggle edit mode)
 *   - Item 8: recent pricing audit log (filtered to PRICING_UPDATE for this customer)
 *   - Item 9: preview quote dialog (uses the shared calculatePricing utility)
 */
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  Edit,
  Eye,
  History,
  Crown,
  AlertCircle,
  Calculator,
  CheckCircle,
  XCircle,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDataQuery, useDataMutation, getUser } from '@/lib/tanstack/dataQuery';
import { usePricingConfigs } from '@/hooks/pricing/usePricingConfigs';
import { calculatePricing, type PricingCalcResult } from '@/lib/pricing/calculate';
import type {
  AdminUserCustomerDetail,
  AdminUserCustomerPricingConfig,
} from '@/types/users';
import type { PricingConfig } from '@/types/pricing';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ── Helpers ────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  PER_MILE: 'Flat Pricing',
  // FLAT_TIER: 'Flat Tier',
  CATEGORY_ABC: 'Category A/B/C',
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

// ── Audit log entry shape (subset returned by GET /api/adminAuditLogs) ─────

interface AuditLogEntry {
  id: string;
  action: string;
  actorType: string;
  reason: string | null;
  createdAt: string;
  beforeJson: unknown;
  afterJson: unknown;
  actor?: { id: string } | null;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface CustomerPricingCardProps {
  customer: AdminUserCustomerDetail;
  onPricingChanged?: () => void;
  /** Called when the admin clicks the billing mode switch button.
   * Opens the confirmation dialog in the parent (admin-user-detail). */
  onBillingSwitch?: (target: 'PREPAID' | 'POSTPAID') => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CustomerPricingCard({
  customer,
  onPricingChanged,
  onBillingSwitch,
}: CustomerPricingCardProps) {
  const [editMode, setEditMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const config = customer.pricingConfig;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-xl font-black">Pricing &amp; Billing</CardTitle>
              <CardDescription className="text-sm mt-1">
                Current pricing configuration and billing settings for this customer
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold"
              onClick={() => setPreviewOpen(true)}
              disabled={!config}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Quote
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold"
              onClick={() => setEditMode((v) => !v)}
            >
              <Edit className="w-3.5 h-3.5" />
              {editMode ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-7">
        {editMode ? (
          <InlineEditPricing
            customer={customer}
            onSaved={() => {
              setEditMode(false);
              onPricingChanged?.();
            }}
            onCancel={() => setEditMode(false)}
          />
        ) : (
          <ReadOnlyPricingSummary customer={customer} config={config} />
        )}

        <Separator className="my-6" />

        <RecentPricingAuditLog customerId={customer.id} />
      </CardContent>

      {/* Preview Quote dialog (item 9) */}
      <PreviewQuoteDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        config={config}
        customerOverride={customer.pricingModeOverride}
      />
    </Card>
  );
}

// ── Item 6: Read-only pricing summary ──────────────────────────────────────

function ReadOnlyPricingSummary({
  customer,
  config,
}: {
  customer: AdminUserCustomerDetail;
  config: AdminUserCustomerPricingConfig | null;
}) {
  if (!config) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
            No pricing configuration assigned
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            This customer will use the system default pricing config. Click
            "Edit" to assign a specific config.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Config name + badges */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
            Configuration
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">
            {config.name || 'Untitled'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.isDefault && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] font-bold gap-1">
              <Crown className="w-3 h-3" />
              Default
            </Badge>
          )}
          <Badge
            className={cn(
              "text-[10px] font-bold",
              config.active
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            )}
          >
            {config.active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[10px] font-bold">
            {MODE_LABELS[config.pricingMode] || config.pricingMode}
          </Badge>
        </div>
      </div>

      {/* Mode override display — HIDDEN per product decision (the picker
          above is also hidden). Legacy overrides are silently cleared on
          the next save (handleSubmit sends pricingModeOverride: null).
          To re-enable: uncomment this block. */}
      {/*
      {customer.pricingModeOverride && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30">
          <div className="text-xs">
            <span className="font-bold text-purple-800 dark:text-purple-300">
              Mode override:
            </span>{' '}
            <span className="text-purple-700 dark:text-purple-400">
              {MODE_LABELS[customer.pricingModeOverride] || customer.pricingModeOverride}
            </span>
            <span className="text-purple-600 dark:text-purple-500 ml-1">
              (replaces the config's default mode for this customer)
            </span>
          </div>
        </div>
      )}
      */}

      {/* Financial summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Base Fee" value={`$${config.baseFee.toFixed(2)}`} />
        {config.pricingMode === 'PER_MILE' && (
          <>
            <StatBox
              label="Rate per Mile"
              value={config.perMileRate != null ? `$${config.perMileRate.toFixed(2)}` : '—'}
            />
            <StatBox
              label="Flat Miles"
              value={config.flatMiles != null ? `${config.flatMiles.toFixed(0)} mi` : '—'}
              hint="Free miles in base"
            />
          </>
        )}
        <StatBox label="Insurance" value={`$${config.insuranceFee.toFixed(2)}`} />
        <StatBox
          label="Tx Fee %"
          value={config.transactionFeePct != null ? `${config.transactionFeePct}%` : '—'}
        />
        <StatBox
          label="Tx Fee Fixed"
          value={config.transactionFeeFixed != null ? `$${config.transactionFeeFixed.toFixed(2)}` : '—'}
        />
        <StatBox
          label="Driver Share"
          value={`${config.driverSharePct}%`}
          hint={config.feePassThrough ? 'Pass-through' : 'No pass-through'}
        />
      </div>

      {/* Postpaid status */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            Billing Mode
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {customer.postpaidEnabled
              ? 'Postpaid — customer is invoiced after delivery'
              : 'Prepaid — customer pays at quote time'}
          </div>
        </div>
        <Badge
          className={cn(
            "text-xs font-bold",
            customer.postpaidEnabled
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800"
          )}
        >
          {customer.postpaidEnabled ? 'POSTPAID' : 'PREPAID'}
        </Badge>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-sm font-black text-slate-900 dark:text-white">
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>
      )}
    </div>
  );
}

// ── Item 7: Inline Edit form ───────────────────────────────────────────────

function InlineEditPricing({
  customer,
  onSaved,
  onCancel,
}: {
  customer: AdminUserCustomerDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Fetch all pricing configs so the admin can pick from a dropdown
  const { data: allConfigs, isLoading: configsLoading } = usePricingConfigs({
    enabled: true,
  });

  // Local form state — initialized from the customer's current values
  const [selectedConfigId, setSelectedConfigId] = useState<string>(
    customer.pricingConfigId ?? ''
  );
  const [pricingModeOverride, setPricingModeOverride] = useState<string>(
    customer.pricingModeOverride ?? 'null'
  );
  const [postpaidEnabled, setPostpaidEnabled] = useState<boolean>(
    customer.postpaidEnabled
  );
  const [note, setNote] = useState<string>('');

  // Mutation — uses the existing POST /api/customers/:id/admin-pricing endpoint
  const assignMutation = useDataMutation<any, any>({
    apiEndPoint: `${API_BASE_URL}/api/customers/:id/admin-pricing`,
    method: 'POST',
    onSuccess: () => {
      toast.success('Pricing updated successfully');
      onSaved();
    },
    onError: (error: any) => {
      toast.error(`Failed to update pricing: ${error?.message || 'Unknown error'}`);
    },
    invalidateQueryKey: [
      ['admin-user-detail'],
      ['data', `${API_BASE_URL}/api/customers`],
    ],
  });

  const handleSubmit = () => {
    if (!selectedConfigId) {
      toast.error('Please select a pricing configuration');
      return;
    }
    const user = getUser();
    assignMutation.mutate({
      pathParams: { id: customer.id },
      pricingConfigId: selectedConfigId,
      // Pricing Mode Override is hidden in the UI per product decision —
      // always send null so the backend clears any stale override.
      pricingModeOverride: null,
      // postpaidEnabled is NOT sent here — billing mode is managed
      // via the safe-switch button + dialog (see onBillingSwitch prop).
      actorUserId: user?.id || 'admin_user',
      note: note.trim() || undefined,
    });
  };

  const selectedConfig = allConfigs?.find((c) => c.id === selectedConfigId);

  return (
    <div className="space-y-4">
      {/* Config selector */}
      <div className="space-y-2">
        <Label className="text-sm font-bold">Pricing Configuration</Label>
        {configsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a pricing configuration" />
            </SelectTrigger>
            <SelectContent>
              {allConfigs?.length === 0 ? (
                <SelectItem value="none" disabled>
                  No pricing configurations available
                </SelectItem>
              ) : (
                allConfigs?.map((cfg) => (
                  <SelectItem key={cfg.id} value={cfg.id}>
                    <div className="flex items-center gap-2">
                      {cfg.isDefault && (
                        <Crown className="w-3 h-3 text-amber-500" />
                      )}
                      <span>{cfg.name || 'Untitled'}</span>
                      <span className="text-xs text-slate-500">
                        ({MODE_LABELS[cfg.pricingMode] || cfg.pricingMode})
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Mode override — HIDDEN per product decision.
          The pricing config already defines the mode (Flat Pricing or
          Category A/B/C). If a dealer needs a different mode, switch their
          pricing config — no need for a per-customer override.
          The backend field (pricingModeOverride) remains in the schema and
          the submitted payload (always sent as null below), so legacy
          overrides keep working until admins clear them.
          To re-enable: uncomment this block. */}
      {/*
      <div className="space-y-2">
        <Label className="text-sm font-bold">Pricing Mode Override</Label>
        <Select value={pricingModeOverride} onValueChange={setPricingModeOverride}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">No override (use config's mode)</SelectItem>
            <SelectItem value="PER_MILE">Flat Pricing</SelectItem>
            <SelectItem value="CATEGORY_ABC">Category A/B/C</SelectItem>
            <SelectItem value="FLAT_TIER" className="text-amber-600 dark:text-amber-400">
              Flat Tier (deprecated — switch to Flat Pricing)
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Override the config's pricing mode for this customer only. Leave as
          "No override" to use the config's default.
        </p>
      </div>
      */}

      {/* Postpaid toggle — replaced with a Switch button that opens
          a confirmation dialog (safe switch with pre-checks).
          The old Switch directly saved postpaidEnabled via the API,
          bypassing the safe-switch logic (Stripe subscription cancellation,
          pre-check for failed charges, etc.). */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div>
          <Label className="text-sm font-bold">Billing Mode</Label>
          <p className="text-xs text-slate-500 mt-0.5">
            Current: <strong>{customer.postpaidEnabled ? 'Postpaid (invoiced after delivery)' : 'Prepaid (charged at creation)'}</strong>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Switching billing modes requires confirmation — pending charges and failed payments are checked first.
          </p>
        </div>
        <Button
          onClick={() => onBillingSwitch(customer.postpaidEnabled ? 'PREPAID' : 'POSTPAID')}
          variant="outline"
          size="sm"
          className={cn(
            'rounded-xl font-bold',
            customer.postpaidEnabled
              ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300'
              : 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300'
          )}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span className="ml-1">
            {customer.postpaidEnabled ? 'Switch to Prepaid' : 'Switch to Postpaid'}
          </span>
        </Button>
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label className="text-sm font-bold">Note (optional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for the audit log..."
          className="rounded-xl"
        />
      </div>

      {/* Preview of selected config */}
      {selectedConfig && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Selected Config Preview
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {selectedConfig.name || 'Untitled'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Mode: {MODE_LABELS[selectedConfig.pricingMode] || selectedConfig.pricingMode}
            {' · '}Base: ${selectedConfig.baseFee.toFixed(2)}
            {' · '}Insurance: ${selectedConfig.insuranceFee.toFixed(2)}
            {' · '}Driver: {selectedConfig.driverSharePct}%
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="rounded-xl">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={assignMutation.isPending || !selectedConfigId}
          className="rounded-xl bg-primary text-slate-950"
        >
          {assignMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ── Item 8: Recent pricing audit log ───────────────────────────────────────

function RecentPricingAuditLog({ customerId }: { customerId: string }) {
  // Fetch the latest 5 pricing-related audit entries for this customer.
  // The existing GET /api/adminAuditLogs endpoint accepts customerId + action
  // filters, so no new endpoint is needed.
  const { data: auditEntries, isLoading } = useDataQuery<AuditLogEntry[]>({
    apiEndPoint: `${API_BASE_URL}/api/adminAuditLogs?customerId=${customerId}&action=PRICING_UPDATE&take=5&orderBy=createdAt:desc`,
    enabled: !!customerId,
    noFilter: true,
    staleTime: 30 * 1000,
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-slate-500" />
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">
          Recent Pricing Changes
        </h4>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !auditEntries || auditEntries.length === 0 ? (
        <div className="text-sm text-slate-500 py-3 text-center">
          No pricing changes recorded for this customer yet.
        </div>
      ) : (
        <div className="space-y-2">
          {auditEntries.map((entry) => (
            <AuditLogRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  // Try to extract a readable summary from beforeJson/afterJson
  const summary = useMemo(() => {
    try {
      const before = (entry.beforeJson ?? {}) as Record<string, unknown>;
      const after = (entry.afterJson ?? {}) as Record<string, unknown>;

      // CustomerPricingEngine writes the full customer row (id, type,
      // approvalStatus, pricingConfigId, pricingModeOverride, postpaidEnabled)
      // before + after. Extract the meaningful deltas.
      const beforeConfigId = before.pricingConfigId as string | null | undefined;
      const afterConfigId = after.pricingConfigId as string | null | undefined;
      const beforeOverride = before.pricingModeOverride as string | null | undefined;
      const afterOverride = after.pricingModeOverride as string | null | undefined;
      const beforePostpaid = before.postpaidEnabled as boolean | undefined;
      const afterPostpaid = after.postpaidEnabled as boolean | undefined;

      const changes: string[] = [];
      if (beforeConfigId !== afterConfigId) {
        changes.push(
          `config: ${beforeConfigId ?? 'none'} → ${afterConfigId ?? 'none'}`
        );
      }
      if (beforeOverride !== afterOverride) {
        changes.push(
          `override: ${beforeOverride ?? 'none'} → ${afterOverride ?? 'none'}`
        );
      }
      if (beforePostpaid !== afterPostpaid) {
        changes.push(
          `postpaid: ${beforePostpaid ? 'on' : 'off'} → ${afterPostpaid ? 'on' : 'off'}`
        );
      }

      return changes.length > 0 ? changes.join(' · ') : 'No field changes detected';
    } catch {
      return 'Unable to parse change details';
    }
  }, [entry.beforeJson, entry.afterJson]);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex-shrink-0 mt-0.5">
        <Calculator className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] font-bold">
            {entry.action}
          </Badge>
          <span className="text-xs text-slate-500 font-mono">
            {formatDate(entry.createdAt)}
          </span>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
          {summary}
        </div>
        {entry.reason && (
          <div className="text-xs text-slate-500 mt-1 italic">
            "{entry.reason}"
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item 9: Preview Quote dialog ───────────────────────────────────────────

function PreviewQuoteDialog({
  open,
  onOpenChange,
  config,
  customerOverride,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AdminUserCustomerPricingConfig | null;
  customerOverride: string | null;
}) {
  const [distance, setDistance] = useState<number>(50);
  const [categoryOverride, setCategoryOverride] = useState<string>('null');

  // The admin-detail endpoint returns a SUBSET of the pricing config (no
  // tiers or categoryRules). For PER_MILE mode, that's enough — the math
  // only needs baseFee, perMileRate, flatMiles. For CATEGORY_ABC (and
  // legacy FLAT_TIER), we need the full config (with rules). So for those
  // modes, fetch the full config on demand when the dialog opens.
  const needsFullConfig =
    config?.pricingMode === 'FLAT_TIER' || config?.pricingMode === 'CATEGORY_ABC';

  const { data: fullConfig, isLoading: fullConfigLoading } = useDataQuery<PricingConfig>({
    apiEndPoint: `${API_BASE_URL}/api/pricingConfigs/${config?.id}`,
    enabled: open && !!config?.id && needsFullConfig,
    noFilter: true,
    staleTime: 60 * 1000,
  });

  // Build the PricingCalcConfig from whichever source we have
  const calcConfig = useMemo(() => {
    if (!config) return null;
    // For PER_MILE, the admin-detail subset is sufficient
    if (config.pricingMode === 'PER_MILE') {
      return {
        id: config.id,
        pricingMode: 'PER_MILE' as const,
        baseFee: config.baseFee,
        flatMiles: config.flatMiles,
        perMileRate: config.perMileRate,
        insuranceFee: config.insuranceFee,
        transactionFeePct: config.transactionFeePct,
        transactionFeeFixed: config.transactionFeeFixed,
        feePassThrough: config.feePassThrough,
        driverSharePct: config.driverSharePct,
        tiers: [],
        categoryRules: [],
      };
    }
    // For other modes, we need the full config (with tiers/rules)
    if (!fullConfig) return null;
    return {
      id: fullConfig.id,
      pricingMode: fullConfig.pricingMode,
      baseFee: fullConfig.baseFee,
      flatMiles: fullConfig.flatMiles,
      perMileRate: fullConfig.perMileRate,
      insuranceFee: fullConfig.insuranceFee,
      transactionFeePct: fullConfig.transactionFeePct,
      transactionFeeFixed: fullConfig.transactionFeeFixed,
      feePassThrough: fullConfig.feePassThrough,
      driverSharePct: fullConfig.driverSharePct,
      tiers: (fullConfig.tiers ?? []).map((t) => ({
        id: t.id,
        minMiles: t.minMiles,
        maxMiles: t.maxMiles ?? null,
        flatPrice: t.flatPrice,
      })),
      categoryRules: (fullConfig.categoryRules ?? []).map((r) => ({
        id: r.id,
        category: r.category,
        minMiles: r.minMiles,
        maxMiles: r.maxMiles ?? null,
        baseFee: r.baseFee ?? null,
        flatPrice: r.flatPrice ?? null,
        perMileRate: r.perMileRate ?? null,
      })),
    };
  }, [config, fullConfig]);

  // Calculate the preview using the shared utility (item 15)
  const preview: PricingCalcResult | null = useMemo(() => {
    if (!calcConfig) return null;
    if (distance == null || distance < 0) return null;
    try {
      return calculatePricing({
        config: calcConfig,
        distanceMiles: distance,
        customerPricingModeOverride:
          customerOverride && customerOverride !== 'null'
            ? (customerOverride as 'PER_MILE' | 'FLAT_TIER' | 'CATEGORY_ABC')
            : null,
        categoryOverride:
          categoryOverride !== 'null'
            ? (categoryOverride as 'A' | 'B' | 'C')
            : null,
      });
    } catch {
      return null;
    }
  }, [calcConfig, distance, customerOverride, categoryOverride]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Preview Quote
          </DialogTitle>
          <DialogDescription>
            Live preview for {config?.name || 'this config'} using the same
            math as the backend quote engine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Distance input */}
          <div className="flex items-center gap-3">
            <Label htmlFor="preview-distance" className="text-sm font-bold w-20">
              Distance
            </Label>
            <Input
              id="preview-distance"
              type="number"
              min={0}
              step={0.1}
              value={distance}
              onChange={(e) => {
                const v = e.target.value;
                setDistance(v === '' ? 0 : Number(v));
              }}
              className="w-28"
            />
            <span className="text-xs text-slate-500">miles</span>
          </div>

          {/* Category override (only for CATEGORY_ABC mode) */}
          {config?.pricingMode === 'CATEGORY_ABC' && (
            <div className="flex items-center gap-3">
              <Label className="text-sm font-bold w-20">Category</Label>
              <Select value={categoryOverride} onValueChange={setCategoryOverride}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Auto (from distance)</SelectItem>
                  <SelectItem value="A">A (force)</SelectItem>
                  <SelectItem value="B">B (force)</SelectItem>
                  <SelectItem value="C">C (force)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-500">
                Force a category to preview edge cases.
              </span>
            </div>
          )}

          {/* Loading state for full config fetch */}
          {needsFullConfig && fullConfigLoading && (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              Loading full config (tiers/rules)...
            </div>
          )}

          {/* Results */}
          {preview ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              {preview.mileageCategory && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                  Category {preview.mileageCategory}
                </Badge>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Base + Distance
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${(preview.feesBreakdown.baseFare + preview.feesBreakdown.distanceCharge).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Insurance</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${preview.feesBreakdown.insuranceFee.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Transaction Fee
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${preview.feesBreakdown.transactionFee.toFixed(2)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900 dark:text-white uppercase">
                  Dealer Total
                </span>
                <span className="text-xl font-black text-primary">
                  ${preview.estimatedPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-sm">Driver Share</span>
                <span className="font-bold">
                  ${preview.estimatedDriverPayout.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {!calcConfig
                  ? 'Loading configuration...'
                  : 'Unable to calculate preview — check the config has the required fields for its mode.'}
              </span>
            </div>
          )}

          {/* Customer override notice — HIDDEN per product decision
              (Pricing Mode Override is no longer surfaced in the UI).
              To re-enable: uncomment this block. */}
          {/*
          {customerOverride && customerOverride !== 'null' && (
            <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Using customer's mode override: {MODE_LABELS[customerOverride] || customerOverride}
            </div>
          )}
          */}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
