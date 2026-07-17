//@ts-nocheck
// components/shared/reports/insuranceReportColumns.tsx
//
// Single source of truth for the per-ride report column set used by BOTH:
//   - src/components/pages/insurance-portal.tsx (password-gated carrier portal)
//   - src/components/pages/admin-insurance-reporting.tsx (admin internal view)
//
// Column set = the original insurance-portal table that the dealer side already
// trusted (Status, Customer, Driver, Route, Started, Stopped, Miles, Hours,
// Payment, Payout) PLUS the per-ride insurance-compliance spec columns
// (Driver ID, Ride ID, Start Location, End Location). Start Time, End Time,
// and Miles are already covered by the original Started / Stopped / Miles
// columns so they are not duplicated.
//
// Every cell uses a fallback chain so a field never shows "—" when there is
// any usable underlying data. Example: if `customerName` is empty, the
// Customer cell falls back to `customerEmail`; if `driverId` is null, the
// Driver ID cell falls back to `driverEmail`, then to "Unassigned".
//
// Any change here automatically flows to both pages so a carrier sees exactly
// the same report an admin sees.

import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { formatReportDate, formatReportMiles } from '@/hooks/useAdminReports';

function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

/** First non-empty string from a list of candidates. */
function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return '';
}

export const INSURANCE_REPORT_COLUMNS: ColumnDef<any>[] = [
  // ── Status (delivery status preferred, tracking-session status as fallback) ──
  {
    accessorKey: 'status',
    header: 'Status',
    size: 90,
    meta: { label: 'Status', sortable: true, sortKey: 'delivery.status' },
    cell: ({ row }) => {
      const value = firstNonEmpty(
        row.original.deliveryStatus,
        row.original.status,
        row.original.trackingStatus,
      );
      return (
        <Badge variant="outline" className="text-[10px] font-bold">
          {value || '—'}
        </Badge>
      );
    },
  },

  // ── Customer (business name → contact name → full name → email) ──────────
  {
    accessorKey: 'customerName',
    header: 'Customer',
    size: 140,
    meta: { label: 'Customer', sortable: false },
    cell: ({ row }) => {
      const value = firstNonEmpty(
        row.original.customerName,
        row.original.customerEmail,
      );
      return <span>{value || '—'}</span>;
    },
  },

  // ── Driver (full name → email) ───────────────────────────────────────────
  {
    accessorKey: 'driverName',
    header: 'Driver',
    size: 140,
    meta: { label: 'Driver', sortable: false },
    cell: ({ row }) => {
      const value = firstNonEmpty(
        row.original.driverName,
        row.original.driverEmail,
      );
      return <span>{value || '—'}</span>;
    },
  },

  // ── Per-ride insurance-compliance spec: Driver ID ────────────────────────
  // Falls back to driver email (truncated) when the driver row exists but the
  // ID column is somehow null, then to "Unassigned" when no driver at all.
  {
    accessorKey: 'driverId',
    header: 'Driver ID',
    size: 150,
    meta: { label: 'Driver ID', sortable: false },
    cell: ({ row }) => {
      const id = firstNonEmpty(row.original.driverId);
      if (id) return <span className="font-mono">{id}</span>;
      const email = firstNonEmpty(row.original.driverEmail);
      if (email) return <span className="font-mono text-slate-500">{email}</span>;
      return <span className="text-slate-400 italic">Unassigned</span>;
    },
  },

  // ── Per-ride insurance-compliance spec: Ride ID (delivery ID) ────────────
  // Falls back to trackingSessionId if deliveryId is missing.
  {
    accessorKey: 'deliveryId',
    header: 'Ride ID',
    size: 150,
    meta: { label: 'Ride ID', sortable: false },
    cell: ({ row }) => {
      const id = firstNonEmpty(
        row.original.deliveryId,
        row.original.trackingSessionId,
      );
      return <span className="font-mono">{id || '—'}</span>;
    },
  },

  // ── Original Route column (combined pickup → dropoff view) ───────────────
  {
    id: 'route',
    header: 'Route',
    size: 180,
    meta: { label: 'Route', sortable: false },
    cell: ({ row }) => {
      const pickup = firstNonEmpty(row.original.pickupAddress);
      const dropoff = firstNonEmpty(row.original.dropoffAddress);
      const pickupShort = pickup ? pickup.split(',')[0] : '';
      const dropoffShort = dropoff ? dropoff.split(',')[0] : '';
      if (!pickupShort && !dropoffShort) return <span className="text-slate-400">—</span>;
      return (
        <span>
          {pickupShort ? `${pickupShort} → ` : '— → '}
          {dropoffShort || '—'}
        </span>
      );
    },
  },

  // ── Per-ride insurance-compliance spec: Start Location ───────────────────
  {
    accessorKey: 'pickupAddress',
    header: 'Start Location',
    size: 220,
    meta: { label: 'Start Location', sortable: false },
    cell: ({ row }) => (
      <span>{firstNonEmpty(row.original.pickupAddress) || '—'}</span>
    ),
  },

  // ── Per-ride insurance-compliance spec: End Location ─────────────────────
  {
    accessorKey: 'dropoffAddress',
    header: 'End Location',
    size: 220,
    meta: { label: 'End Location', sortable: false },
    cell: ({ row }) => (
      <span>{firstNonEmpty(row.original.dropoffAddress) || '—'}</span>
    ),
  },

  // ── Started / Stopped (= insurance spec Start Time / End Time) ───────────
  {
    accessorKey: 'startedAt',
    header: 'Started',
    size: 130,
    meta: { label: 'Started', sortable: true, sortKey: 'startedAt' },
    cell: ({ getValue }) => (
      <span>{getValue() ? formatReportDate(getValue()) : '—'}</span>
    ),
  },
  {
    accessorKey: 'stoppedAt',
    header: 'Stopped',
    size: 130,
    meta: { label: 'Stopped', sortable: true, sortKey: 'stoppedAt' },
    cell: ({ getValue }) => (
      <span>{getValue() ? formatReportDate(getValue()) : '—'}</span>
    ),
  },

  // ── Miles / Hours / Payment / Payout ─────────────────────────────────────
  {
    accessorKey: 'drivenMiles',
    header: 'Miles',
    size: 70,
    meta: { label: 'Miles', sortable: true, sortKey: 'drivenMiles' },
    cell: ({ getValue }) => (
      <span className="font-bold tabular-nums">{formatReportMiles(getValue())}</span>
    ),
  },
  {
    accessorKey: 'drivenHours',
    header: 'Hours',
    size: 60,
    meta: { label: 'Hours', sortable: true, sortKey: 'drivenHours' },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatHours(getValue())}</span>
    ),
  },
  {
    accessorKey: 'paymentAmount',
    header: 'Payment',
    size: 80,
    meta: { label: 'Payment', sortable: false },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatMoney(getValue())}</span>
    ),
  },
  {
    accessorKey: 'payoutAmount',
    header: 'Payout',
    size: 80,
    meta: { label: 'Payout', sortable: false },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatMoney(getValue())}</span>
    ),
  },
];

export default INSURANCE_REPORT_COLUMNS;
