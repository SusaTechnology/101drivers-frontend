// Product analytics hooks (Task 72) — admin-only queries against
// GET /api/analytics/overview, /analytics/timeseries, /analytics/records.
// All endpoints are ADMIN-gated server-side; the fetch wrapper attaches
// the session token and the backend rejects non-admins with 403.
//
// LIVE DASHBOARD: every hook polls on the shared interval below so the
// page reflects new visits/sign-ups/log-ins/deliveries without a manual
// refresh (React Query skips interval fires while the tab is hidden, so
// a backgrounded dashboard costs nothing).

import { useDataQuery } from '@/lib/tanstack/dataQuery';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export type MetricsRange = '24H' | '7D' | '30D' | '12M' | 'CUSTOM';

/** Shared live-poll cadence — the metrics page is real-time, not a snapshot. */
export const LIVE_REFRESH_MS = 15 * 1000;

export interface MetricsWindow {
  from: string; // ISO
  to: string; // ISO
  /** Bucket size the main chart should use for this window. */
  interval: 'hour' | 'day' | 'month';
  /** Human label for "vs previous period" hints. */
  prevLabel: string;
}

/** Window presets — mirrors what the backend aggregates over. */
export function metricsWindow(
  range: MetricsRange,
  customFrom?: string,
  customTo?: string
): MetricsWindow {
  const to = new Date();
  const iso = (d: Date) => d.toISOString();

  if (range === '24H') {
    return {
      from: iso(new Date(to.getTime() - 24 * 60 * 60 * 1000)),
      to: iso(to),
      interval: 'hour',
      prevLabel: 'vs previous 24h',
    };
  }
  if (range === '7D') {
    return {
      from: iso(new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)),
      to: iso(to),
      interval: 'day',
      prevLabel: 'vs previous 7 days',
    };
  }
  if (range === '12M') {
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 11, 1));
    return {
      from: iso(from),
      to: iso(to),
      interval: 'month',
      prevLabel: 'vs previous 12 months',
    };
  }
  if (range === 'CUSTOM' && customFrom && customTo) {
    const from = new Date(`${customFrom}T00:00:00.000Z`);
    const toD = new Date(`${customTo}T23:59:59.999Z`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(toD.getTime()) && from < toD) {
      const spanDays = (toD.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
      return {
        from: iso(from),
        to: iso(toD),
        interval: spanDays > 100 ? 'month' : 'day',
        prevLabel: 'vs previous period',
      };
    }
  }
  // 30D default (and CUSTOM fallback until both dates are picked)
  return {
    from: iso(new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)),
    to: iso(to),
    interval: 'day',
    prevLabel: 'vs previous 30 days',
  };
}

export interface MetricsTotals {
  current: number;
  previous: number;
  /** null = previous window was empty → treat as "new", not 0%. */
  deltaPct: number | null;
  today: number;
  yesterday: number;
}

export interface AnalyticsOverview {
  range: { from: string; to: string };
  totals: {
    PAGE_VIEW: MetricsTotals;
    SIGNUP: MetricsTotals;
    LOGIN: MetricsTotals;
    DELIVERY_CREATED: MetricsTotals;
  };
  daily: Record<string, number | string>[];
  monthly: Record<string, number | string>[];
  cumulative: Record<string, number | string>[];
}

export function useAnalyticsOverview(win: MetricsWindow) {
  return useDataQuery<AnalyticsOverview>({
    apiEndPoint: `${API_BASE_URL}/api/analytics/overview?from=${encodeURIComponent(
      win.from
    )}&to=${encodeURIComponent(win.to)}`,
    noFilter: true,
    queryKey: ['analytics', 'overview', win.from, win.to],
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

/** Hourly drill-down (24H view) — only fetched when the range needs it. */
export function useAnalyticsHourly(win: MetricsWindow, enabled: boolean) {
  return useDataQuery<Record<string, number | string>[]>({
    apiEndPoint: `${API_BASE_URL}/api/analytics/timeseries?interval=hour&from=${encodeURIComponent(
      win.from
    )}&to=${encodeURIComponent(win.to)}`,
    noFilter: true,
    queryKey: ['analytics', 'timeseries-hour', win.from, win.to],
    enabled,
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export interface AnalyticsRecordRow {
  id: string;
  type: string;
  occurredAt: string;
  userId: string | null;
  role: string | null;
  sessionId: string | null;
  path: string | null;
  referrer: string | null;
  userAgent: string | null;
  /** Server-captured client IP (new rows only — historical rows are null). */
  ip?: string | null;
  metadata: Record<string, unknown> | null;
}

export function useAnalyticsRecords(
  win: MetricsWindow,
  type: string,
  page: number,
  pageSize = 20
) {
  const params = new URLSearchParams({
    from: win.from,
    to: win.to,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (type && type !== 'ALL') params.set('type', type);

  return useDataQuery<{ rows: AnalyticsRecordRow[]; total: number }>({
    apiEndPoint: `${API_BASE_URL}/api/analytics/records?${params.toString()}`,
    noFilter: true,
    queryKey: ['analytics', 'records', type, win.from, win.to, String(page)],
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

// ── Spam radar: blocked signup attempts ─────────────────────────────

export interface BlockedSignupRow {
  id: string;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  email: string | null;
  reason: string | null;
}

/**
 * Driver-registration attempts the mobile-only UA guard rejected
 * (GET /api/analytics/blocked-signups, ADMIN-only) — the audit trail
 * for the desktop-blocking rule and the spam radar panel.
 */
export function useAnalyticsBlockedSignups(
  win: MetricsWindow,
  page: number,
  pageSize = 20
) {
  const params = new URLSearchParams({
    from: win.from,
    to: win.to,
    page: String(page),
    pageSize: String(pageSize),
  });

  return useDataQuery<{ rows: BlockedSignupRow[]; total: number }>({
    apiEndPoint: `${API_BASE_URL}/api/analytics/blocked-signups?${params.toString()}`,
    noFilter: true,
    queryKey: ['analytics', 'blocked-signups', win.from, win.to, String(page)],
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
  });
}
