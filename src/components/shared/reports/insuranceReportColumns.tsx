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

export const INSURANCE_REPORT_COLUMNS: ColumnDef<any>[] = [
  // ── Original insurance-portal columns (kept intact) ──────────────────────
  {
    accessorKey: 'status',
    header: 'Status',
    size: 90,
    meta: { label: 'Status', sortable: true, sortKey: 'delivery.status' },
    cell: ({ getValue }) => (
      <Badge variant="outline" className="text-[10px] font-bold">
        {getValue() || '—'}
      </Badge>
    ),
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
    size: 120,
    meta: { label: 'Customer', sortable: false },
    cell: ({ getValue }) => <span>{getValue() || '—'}</span>,
  },
  {
    accessorKey: 'driverName',
    header: 'Driver',
    size: 120,
    meta: { label: 'Driver', sortable: false },
    cell: ({ getValue }) => <span>{getValue() || '—'}</span>,
  },
  // ── Per-ride insurance-compliance spec columns (added) ───────────────────
  {
    accessorKey: 'driverId',
    header: 'Driver ID',
    size: 140,
    meta: { label: 'Driver ID', sortable: false },
    cell: ({ getValue }) => (
      <span className="font-mono">{getValue() || '—'}</span>
    ),
  },
  {
    accessorKey: 'deliveryId',
    header: 'Ride ID',
    size: 140,
    meta: { label: 'Ride ID', sortable: false },
    cell: ({ getValue }) => <span className="font-mono">{getValue() || '—'}</span>,
  },
  // ── Original Route column (kept — combined pickup → dropoff view) ─────────
  {
    id: 'route',
    header: 'Route',
    size: 180,
    meta: { label: 'Route', sortable: false },
    cell: ({ row }) => (
      <span>
        {row.original.pickupAddress ? `${row.original.pickupAddress.split(',')[0]} → ` : ''}
        {row.original.dropoffAddress ? row.original.dropoffAddress.split(',')[0] : '—'}
      </span>
    ),
  },
  // ── Per-ride insurance-compliance spec: separate start/end location ──────
  {
    accessorKey: 'pickupAddress',
    header: 'Start Location',
    size: 220,
    meta: { label: 'Start Location', sortable: false },
    cell: ({ getValue }) => <span>{getValue() || '—'}</span>,
  },
  {
    accessorKey: 'dropoffAddress',
    header: 'End Location',
    size: 220,
    meta: { label: 'End Location', sortable: false },
    cell: ({ getValue }) => <span>{getValue() || '—'}</span>,
  },
  // ── Original Started / Stopped columns (= insurance spec Start/End Time) ─
  {
    accessorKey: 'startedAt',
    header: 'Started',
    size: 130,
    meta: { label: 'Started', sortable: true, sortKey: 'startedAt' },
    cell: ({ getValue }) => <span>{getValue() ? formatReportDate(getValue()) : '—'}</span>,
  },
  {
    accessorKey: 'stoppedAt',
    header: 'Stopped',
    size: 130,
    meta: { label: 'Stopped', sortable: true, sortKey: 'stoppedAt' },
    cell: ({ getValue }) => <span>{getValue() ? formatReportDate(getValue()) : '—'}</span>,
  },
  // ── Original Miles / Hours / Payment / Payout columns ────────────────────
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
