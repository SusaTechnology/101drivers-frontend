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

/** Session gap for VISITS — a visitor idle longer than this starts a NEW
 *  visit. This is the Google-Analytics standard 30-minute inactivity rule;
 *  it is a derived metric computed at read time, NEVER a recorded type
 *  (the ingest endpoint still rejects anything but PAGE_VIEW, so a client
 *  cannot forge visit counts). */
const SESSION_GAP_SECONDS = 30 * 60;

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

  /**
   * Tiny TTL result cache for the overview payload. The dashboard polls
   * every 15s AND websocket "metrics changed" pings trigger extra
   * refetches; recomputing ~10 aggregations per request — including the
   * 12-month sessionization windows — is wasted work when one or several
   * admins watch the same windows. 10s keeps the live readout honest
   * (well under the poll cadence) while collapsing bursts to ONE query
   * round. Instance-level (per pod) on purpose: no external cache to run.
   */
  private overviewCache = new Map<string, { at: number; value: any }>();
  private static OVERVIEW_CACHE_TTL_MS = 10_000;

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

    // VISITS (sessionized page views) ride along with every unfiltered
    // series — and with a PAGE_VIEW-filtered one — so the dashboard can
    // chart one-visit-per-person next to the raw page-view counts. When
    // the caller filters to any other type, no VISITS key is emitted
    // (sessions are derived from page views; nothing else produces them).
    const includeVisits = type === null || type === "PAGE_VIEW";

    const [rows, visits] = await Promise.all([
      this.prisma.$queryRaw<
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
    `,
      includeVisits
        ? this.visitsByBucket(from, to, interval)
        : Promise.resolve(new Map<string, number>()),
    ]);

    // Sparse SQL rows -> dense lookup: bucket -> type -> count
    const counts = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const key = new Date(row.bucket).toISOString();
      if (!counts.has(key)) counts.set(key, new Map());
      counts.get(key)!.set(row.type, Number(row.count));
    }
    const visitCounts = visits instanceof Map ? visits : new Map<string, number>();

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
      if (includeVisits) {
        entry.VISITS = visitCounts.get(key) ?? 0;
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

    // TTL cache: identical windows within 10s return the same payload
    // without touching the database (see overviewCache doc above).
    const cacheKey = `${from.toISOString()}|${to.toISOString()}`;
    const cached = this.overviewCache.get(cacheKey);
    if (cached && Date.now() - cached.at < AnalyticsService.OVERVIEW_CACHE_TTL_MS) {
      return cached.value;
    }

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
      visitsCurrent,
      visitsPrevious,
      visitsToday,
      visitsYesterday,
      daily,
      monthly,
    ] = await Promise.all([
      this.countByType(from, to),
      this.countByType(prevFrom, prevTo),
      this.countByType(dayStart, to),
      this.countByType(yesterdayStart, dayStart),
      this.countVisits(from, to),
      this.countVisits(prevFrom, prevTo),
      this.countVisits(dayStart, to),
      this.countVisits(yesterdayStart, dayStart),
      this.timeseries({ interval: "day", from, to }),
      this.timeseries({ interval: "month", from: monthlyFrom, to }),
    ]);

    const deltaPctOf = (current: number, previous: number): number | null =>
      previous === 0
        ? current === 0
          ? 0
          : null // infinite growth — dashboards show "new"
        : Math.round(((current - previous) / previous) * 1000) / 10;

    const metric = (type: AnalyticsEventType) => {
      const current = currentCounts[type] ?? 0;
      const previous = previousCounts[type] ?? 0;
      return {
        current,
        previous,
        deltaPct: deltaPctOf(current, previous),
        today: todayCounts[type] ?? 0,
        yesterday: yesterdayCounts[type] ?? 0,
      };
    };

    // VISITS — one visit per person per 30-minute activity window (see
    // SESSION_GAP_SECONDS). Same tile shape as the recorded event metrics;
    // values come from the sessionization queries, not the type counter.
    const visits = {
      current: visitsCurrent,
      previous: visitsPrevious,
      deltaPct: deltaPctOf(visitsCurrent, visitsPrevious),
      today: visitsToday,
      yesterday: visitsYesterday,
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

    return this.cacheOverview(cacheKey, {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        VISITS: visits,
        PAGE_VIEW: metric("PAGE_VIEW"),
        SIGNUP: metric("SIGNUP"),
        LOGIN: metric("LOGIN"),
        DELIVERY_CREATED: metric("DELIVERY_CREATED"),
      },
      daily,
      monthly,
      cumulative,
    });
  }

  /** Store an overview result in the TTL cache, pruning stale entries. */
  private cacheOverview(cacheKey: string, payload: any): any {
    const now = Date.now();
    this.overviewCache.set(cacheKey, { at: now, value: payload });
    if (this.overviewCache.size > 16) {
      const cutoff = now - AnalyticsService.OVERVIEW_CACHE_TTL_MS;
      for (const [key, entry] of this.overviewCache) {
        if (entry.at < cutoff) this.overviewCache.delete(key);
      }
    }
    return payload;
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

    // Resolve the humans behind the rows — the ledger stores only userId;
    // the admin records table shows the full name (role is already stored
    // at event time). One batched query per page, never per row.
    const userIds = Array.from(
      new Set(
        rows
          .map((row) => row.userId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true },
          })
        : [];
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      rows: rows.map((row) => ({
        ...row,
        userName:
          (row.userId ? nameById.get(row.userId) : null) ?? null,
      })),
      total,
      page,
      pageSize,
    };
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

  /**
   * VISITS in [from, to) — sessionized page views.
   *
   * A visit = a run of PAGE_VIEWs from one sessionId with gaps of at most
   * 30 minutes (LAG window function marks the first event after every
   * inactivity gap). Edge cases, deliberately:
   *   • A session straddling the window boundary can be counted in BOTH
   *     windows — the same day-attribution compromise Google Analytics
   *     makes; it cannot inflate a single window.
   *   • Rows with a NULL sessionId (storage-blocked browsers that skipped
   *     the client fallback) cannot be grouped — each counts as its own
   *     visit rather than silently merging into one giant session.
   */
  private async countVisits(from: Date, to: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      WITH pv AS (
        SELECT "sessionId", "occurredAt",
               LAG("occurredAt") OVER (
                 PARTITION BY "sessionId" ORDER BY "occurredAt"
               ) AS "prevAt"
        FROM "AnalyticsEvent"
        WHERE "type" = 'PAGE_VIEW'
          AND "occurredAt" >= ${from}
          AND "occurredAt" < ${to}
          AND "sessionId" IS NOT NULL
      )
      SELECT (
        (SELECT COUNT(*)::bigint FROM pv
          WHERE "prevAt" IS NULL
             OR EXTRACT(EPOCH FROM ("occurredAt" - "prevAt")) > ${SESSION_GAP_SECONDS}::int)
        +
        (SELECT COUNT(*)::bigint FROM "AnalyticsEvent"
          WHERE "type" = 'PAGE_VIEW'
            AND "occurredAt" >= ${from}
            AND "occurredAt" < ${to}
            AND "sessionId" IS NULL)
      )::bigint AS count
    `;
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * VISITS per date_trunc bucket in [from, to) — sessions STARTING in
   * each bucket (the same attribution the raw per-bucket counts use),
   * returned as bucketKey -> count for merging into the dense series.
   */
  private async visitsByBucket(
    from: Date,
    to: Date,
    interval: AnalyticsInterval
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
      WITH pv AS (
        SELECT "sessionId", "occurredAt",
               LAG("occurredAt") OVER (
                 PARTITION BY "sessionId" ORDER BY "occurredAt"
               ) AS "prevAt"
        FROM "AnalyticsEvent"
        WHERE "type" = 'PAGE_VIEW'
          AND "occurredAt" >= ${from}
          AND "occurredAt" < ${to}
          AND "sessionId" IS NOT NULL
      ),
      started AS (
        SELECT date_trunc(${interval}::text, "occurredAt") AS bucket,
               COUNT(*)::bigint AS count
        FROM pv
        WHERE "prevAt" IS NULL
           OR EXTRACT(EPOCH FROM ("occurredAt" - "prevAt")) > ${SESSION_GAP_SECONDS}::int
        GROUP BY 1
      ),
      anon AS (
        SELECT date_trunc(${interval}::text, "occurredAt") AS bucket,
               COUNT(*)::bigint AS count
        FROM "AnalyticsEvent"
        WHERE "type" = 'PAGE_VIEW'
          AND "occurredAt" >= ${from}
          AND "occurredAt" < ${to}
          AND "sessionId" IS NULL
        GROUP BY 1
      )
      SELECT bucket, SUM(count)::bigint AS count
      FROM (SELECT bucket, count FROM started UNION ALL SELECT bucket, count FROM anon) s
      GROUP BY bucket
    `;
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(new Date(row.bucket).toISOString(), Number(row.count));
    }
    return map;
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
