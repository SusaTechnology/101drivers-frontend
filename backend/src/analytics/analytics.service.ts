import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { AppEventsService, APP_EVENT } from "../common/appEvents/appEvents.service";

// ═══════════════════════════════════════════════════════════════════════
// Product analytics — immutable event ledger (Task 72)
//
// One Prisma row per event. Server-side events (SIGNUP / LOGIN /
// DELIVERY_CREATED) are recorded by the services that PERFORM the action
// (never trusted from the client); PAGE_VIEW is pinged by the SPA and
// enriched with the session user when a valid Bearer token is present.
//
// Contract that keeps this safe to call from hot paths:
//   recordSafe() NEVER throws and NEVER needs awaiting — an analytics
//   failure can never fail a signup, a login or a delivery creation.
// ═══════════════════════════════════════════════════════════════════════

export const ANALYTICS_EVENT_TYPES = [
  "PAGE_VIEW",
  "SIGNUP",
  "LOGIN",
  "DELIVERY_CREATED",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** Whitelist — interpolated into date_trunc, so anything else is rejected. */
export const ANALYTICS_INTERVALS = ["hour", "day", "month"] as const;

export type AnalyticsInterval = (typeof ANALYTICS_INTERVALS)[number];

export interface RecordAnalyticsEventInput {
  type: AnalyticsEventType;
  userId?: string | null;
  role?: string | null;
  sessionId?: string | null;
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  /** Client IP (x-forwarded-for aware) — attribution for the records ledger. */
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Clamp free-text client input to sane lengths before it hits the ledger. */
function clampText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface TimeseriesBucket {
  /** ISO timestamp of the bucket start (UTC). */
  bucket: string;
  [eventType: string]: number | string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  /** Last AppEventsService publish — the live ping is throttled so a burst
   *  of PAGE_VIEWs cannot flood the staff:ops socket room. */
  private lastLivePublishAt = 0;
  private static LIVE_PUBLISH_THROTTLE_MS = 3000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly appEvents?: AppEventsService
  ) {}

  // ── Recording ────────────────────────────────────────────────────────

  /**
   * Fire-and-forget event recording. Call WITHOUT `await` from hot paths.
   * Never throws: prisma failures are logged and swallowed so analytics
   * can never break a customer flow.
   */
  async recordSafe(input: RecordAnalyticsEventInput): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          type: input.type,
          userId: clampText(input.userId, 64) ?? null,
          role: clampText(input.role, 64) ?? null,
          sessionId: clampText(input.sessionId, 128) ?? null,
          path: clampText(input.path, 512) ?? null,
          referrer: clampText(input.referrer, 512) ?? null,
          userAgent: clampText(input.userAgent, 512) ?? null,
          ip: clampText(input.ip, 128) ?? null,
          metadata: (input.metadata ?? undefined) as any,
        },
      });
      this.publishLivePingThrottled();
    } catch (err: any) {
      this.logger.warn(
        `analytics record failed (${input.type}): ${err?.message ?? err}`
      );
    }
  }

  /**
   * Contentless "metrics changed" ping (staff:ops room via the socket
   * gateway) so the admin metrics page live-refreshes between its 15s
   * safety-net polls. Throttled to one per few seconds — a visit burst
   * is ONE refresh, not one per event.
   */
  private publishLivePingThrottled(): void {
    const now = Date.now();
    if (now - this.lastLivePublishAt < AnalyticsService.LIVE_PUBLISH_THROTTLE_MS) {
      return;
    }
    this.lastLivePublishAt = now;
    try {
      this.appEvents?.emit(APP_EVENT.ANALYTICS_CHANGED);
    } catch {
      // The bus never breaks the emitter — belt and braces.
    }
  }

  // ── Aggregation (admin dashboard) ────────────────────────────────────

  /**
   * Bucketed counts per event type in [from, to).
   * Buckets are gap-free: every interval between from and to gets a row
   * (zeros where nothing happened), which is what graphs expect.
   */
  async timeseries(params: {
    interval: AnalyticsInterval;
    from: Date;
    to: Date;
    type?: AnalyticsEventType | null;
  }): Promise<TimeseriesBucket[]> {
    const { interval, from, to } = params;
    const type = params.type ?? null;

    const rows = await this.prisma.$queryRaw<
      { bucket: Date; type: string; count: bigint }[]
    >`
      SELECT date_trunc(${interval}::text, "occurredAt") AS bucket,
             "type",
             COUNT(*)::bigint AS count
      FROM "AnalyticsEvent"
      WHERE "occurredAt" >= ${from}
        AND "occurredAt" < ${to}
        AND (${type}::text IS NULL OR "type" = ${type})
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    // Sparse SQL rows -> dense lookup: bucket -> type -> count
    const counts = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const key = new Date(row.bucket).toISOString();
      if (!counts.has(key)) counts.set(key, new Map());
      counts.get(key)!.set(row.type, Number(row.count));
    }

    // Walk the bucket sequence so charts never see gaps.
    const buckets: TimeseriesBucket[] = [];
    const stepMs =
      interval === "hour" ? MS_PER_HOUR : interval === "day" ? MS_PER_DAY : 0;

    // date_trunc aligns to UTC; build sequence from the truncated start.
    const start = truncateToInterval(from, interval);
    const end = truncateToInterval(to, interval);

    let cursorMs = start.getTime();
    const endMs = end.getTime();
    let guard = 0;
    while (cursorMs < endMs && guard < 10000) {
      const key = new Date(cursorMs).toISOString();
      const perType = counts.get(key);
      const entry: TimeseriesBucket = { bucket: key };
      for (const t of ANALYTICS_EVENT_TYPES) {
        if (type && t !== type) continue;
        entry[t] = perType?.get(t) ?? 0;
      }
      buckets.push(entry);
      if (stepMs > 0) {
        cursorMs += stepMs;
      } else {
        // month: advance by calendar month, keeping day-of-month aligned
        const d = new Date(cursorMs);
        cursorMs = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
        ).getTime();
      }
      guard++;
    }
    return buckets;
  }

  /**
   * Everything the metrics dashboard needs in ONE round trip:
   * totals with period-over-period deltas, today/yesterday,
   * gap-free daily + monthly series, and cumulative growth.
   */
  async overview(params?: { from?: Date; to?: Date }): Promise<any> {
    const to = params?.to ?? new Date();
    const from = params?.from ?? new Date(to.getTime() - 30 * MS_PER_DAY);
    const spanMs = Math.max(to.getTime() - from.getTime(), MS_PER_HOUR);
    const prevFrom = new Date(from.getTime() - spanMs);
    const prevTo = from;

    const dayStart = truncateToInterval(to, "day");
    const yesterdayStart = new Date(dayStart.getTime() - MS_PER_DAY);
    const monthStart = truncateToInterval(to, "month");
    const monthlyFrom = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 11, 1)
    );

    const [
      currentCounts,
      previousCounts,
      todayCounts,
      yesterdayCounts,
      daily,
      monthly,
    ] = await Promise.all([
      this.countByType(from, to),
      this.countByType(prevFrom, prevTo),
      this.countByType(dayStart, to),
      this.countByType(yesterdayStart, dayStart),
      this.timeseries({ interval: "day", from, to }),
      this.timeseries({ interval: "month", from: monthlyFrom, to }),
    ]);

    const metric = (type: AnalyticsEventType) => {
      const current = currentCounts[type] ?? 0;
      const previous = previousCounts[type] ?? 0;
      return {
        current,
        previous,
        deltaPct:
          previous === 0
            ? current === 0
              ? 0
              : null // infinite growth — dashboards show "new"
            : Math.round(((current - previous) / previous) * 1000) / 10,
        today: todayCounts[type] ?? 0,
        yesterday: yesterdayCounts[type] ?? 0,
      };
    };

    // Cumulative running totals across the daily window (growth curves).
    const cumulative: TimeseriesBucket[] = [];
    const running: Record<string, number> = {};
    for (const row of daily) {
      const entry: TimeseriesBucket = { bucket: row.bucket };
      for (const t of ANALYTICS_EVENT_TYPES) {
        running[t] = (running[t] ?? 0) + (Number(row[t] ?? 0) as number);
        entry[t] = running[t];
      }
      cumulative.push(entry);
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        PAGE_VIEW: metric("PAGE_VIEW"),
        SIGNUP: metric("SIGNUP"),
        LOGIN: metric("LOGIN"),
        DELIVERY_CREATED: metric("DELIVERY_CREATED"),
      },
      daily,
      monthly,
      cumulative,
    };
  }

  /**
   * Raw ledger records — the "track of records". Append-only, newest
   * first, filterable by type and window, always paginated (hard cap).
   */
  async records(params: {
    type?: AnalyticsEventType | null;
    from?: Date | null;
    to?: Date | null;
    page?: number | null;
    pageSize?: number | null;
  }): Promise<any> {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(params.pageSize ?? 25)));

    const where: any = {};
    if (params.type) where.type = params.type;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lt = params.to;
    }

    const [rows, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.analyticsEvent.count({ where }),
    ]);

    return { rows, total, page, pageSize };
  }

  /**
   * Admin spam radar: driver-registration attempts rejected by the
   * mobile-only user-agent guard. Window counts + the raw rows
   * (timestamp, IP, user agent, attempted email, reason) feed the
   * "Blocked signups" panel on the metrics page.
   */
  async blockedSignups(params: {
    from?: Date | null;
    to?: Date | null;
    page?: number | null;
    pageSize?: number | null;
  }): Promise<any> {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(params.pageSize ?? 25)));

    const where: any = {};
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lt = params.to;
    }

    const [rows, total] = await Promise.all([
      this.prisma.blockedSignup.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          ip: true,
          userAgent: true,
          email: true,
          reason: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.blockedSignup.count({ where }),
    ]);

    return { rows, total, page, pageSize };
  }

  /** Totals per type in [from, to) — one grouped query. */
  private async countByType(from: Date, to: Date): Promise<Record<string, number>> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: { occurredAt: { gte: from, lt: to } },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const row of rows) out[row.type] = Number(row._count._all);
    return out;
  }
}

/** UTC-align a date to the start of its hour/day/calendar month. */
function truncateToInterval(date: Date, interval: AnalyticsInterval): Date {
  const d = new Date(date);
  if (interval === "hour") {
    d.setUTCMinutes(0, 0, 0);
    return d;
  }
  if (interval === "day") {
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
