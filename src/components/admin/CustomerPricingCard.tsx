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
import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  Edit,
  Eye,
  History,
  Crown,
  AlertCircle,
  X,
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
import { cn } from '@/lib/utils';
import { useDataQuery, useDataMutation, getUser } from '@/lib/tanstack/dataQuery';
import { calculatePricing, type PricingCalcResult } from '@/lib/pricing/calculate';
import type { AdminUserCustomerDetail, AdminUserCustomerPricingConfig } from '@/types/users';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ── Helpers ────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  PER_MILE: 'Per Mile',
  FLAT_TIER: 'Flat Tier',
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
}

// ── Component ──────────────────────────────────────────────────────────────

export function CustomerPricingCard({
  customer,
  onPricingChanged,
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

      {/* Mode override */}
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

      {/* Financial summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Base Fee" value={`$${config.baseFee.toFixed(2)}`} />
        {config.pricingMode === 'PER_MILE' && (
          <>
            <StatBox
              label="Per Mile"
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
// (added in commit 2 — placeholder for now)

function InlineEditPricing({
  customer,
  onSaved,
  onCancel,
}: {
  customer: AdminUserCustomerDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Placeholder — replaced with real form in next commit
  return (
    <div className="text-sm text-slate-500">
      Inline edit coming in next commit (item 7).
    </div>
  );
}

// ── Item 8: Recent pricing audit log ───────────────────────────────────────
// (added in commit 2 — placeholder for now)

function RecentPricingAuditLog({ customerId }: { customerId: string }) {
  return (
    <div className="text-sm text-slate-500">
      Recent pricing changes coming in next commit (item 8).
    </div>
  );
}

// ── Item 9: Preview Quote dialog ───────────────────────────────────────────
// (added in commit 2 — placeholder for now)

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Preview Quote</DialogTitle>
          <DialogDescription>
            Preview dialog coming in next commit (item 9).
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
