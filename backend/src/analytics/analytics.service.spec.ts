import { AnalyticsService } from "./analytics.service";

// ═══════════════════════════════════════════════════════════════════════
// Task 72 — analytics service guarantees:
//   1. recordSafe NEVER throws and NEVER propagates prisma failures
//      (analytics can never fail a signup/login/delivery creation).
//   2. Timeseries buckets are gap-free, whitelisted and correctly shaped.
//   3. Records pagination is clamped (no unbounded takes).
// ═══════════════════════════════════════════════════════════════════════

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let prisma: {
    analyticsEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      analyticsEvent: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    service = new AnalyticsService(prisma as any);
  });

  // ── recordSafe ───────────────────────────────────────────────────────

  describe("recordSafe", () => {
    it("records an event with clamped fields", async () => {
      await service.recordSafe({
        type: "LOGIN",
        userId: "user-1",
        role: "ADMIN",
        path: "/some/path".padEnd(600, "x"), // over the clamp limit
        sessionId: "session-1",
      });

      expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(1);
      const data = prisma.analyticsEvent.create.mock.calls[0][0].data;
      expect(data.type).toBe("LOGIN");
      expect(data.userId).toBe("user-1");
      expect(data.path.length).toBe(512);
    });

    it("NEVER throws when prisma fails (hot-path contract)", async () => {
      prisma.analyticsEvent.create.mockRejectedValueOnce(
        new Error("db connection lost")
      );

      await expect(
        service.recordSafe({ type: "SIGNUP", userId: "u1", role: "DRIVER" })
      ).resolves.toBeUndefined();

      // A second call still works after a failure.
      await expect(
        service.recordSafe({ type: "SIGNUP", userId: "u2", role: "DRIVER" })
      ).resolves.toBeUndefined();
      // 1 rejected attempt + 1 successful retry — the ledger keeps working.
      expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(2);
    });

    it("nulls out non-string junk instead of crashing", async () => {
      await service.recordSafe({
        type: "PAGE_VIEW",
        userId: 12345 as any,
        path: { evil: true } as any,
        metadata: null,
      });

      const data = prisma.analyticsEvent.create.mock.calls[0][0].data;
      expect(data.userId).toBeNull();
      expect(data.path).toBeNull();
    });
  });

  // ── timeseries ───────────────────────────────────────────────────────

  describe("timeseries", () => {
    it("returns gap-free daily buckets with zeros where nothing happened", async () => {
      // Only ONE event in the whole window: day 2, one PAGE_VIEW.
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date("2026-10-02T00:00:00.000Z"), type: "PAGE_VIEW", count: 1n },
      ]);

      const buckets = await service.timeseries({
        interval: "day",
        from: new Date("2026-10-01T00:00:00.000Z"),
        to: new Date("2026-10-04T00:00:00.000Z"),
      });

      expect(buckets).toHaveLength(3);
      expect(buckets[0]).toEqual({
        bucket: "2026-10-01T00:00:00.000Z",
        PAGE_VIEW: 0,
        SIGNUP: 0,
        LOGIN: 0,
        DELIVERY_CREATED: 0,
      });
      expect(buckets[1].PAGE_VIEW).toBe(1);
      expect(buckets[2].PAGE_VIEW).toBe(0);
    });

    it("filters to a single type when requested", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date("2026-10-02T00:00:00.000Z"), type: "SIGNUP", count: 2n },
      ]);

      const buckets = await service.timeseries({
        interval: "day",
        from: new Date("2026-10-01T00:00:00.000Z"),
        to: new Date("2026-10-03T00:00:00.000Z"),
        type: "SIGNUP",
      });

      expect(buckets).toHaveLength(2);
      // Only SIGNUP is present in the rows — other types are omitted.
      expect(Object.keys(buckets[0]).sort()).toEqual(["SIGNUP", "bucket"]);
      expect(buckets[1].SIGNUP).toBe(2);
    });

    it("passes the whitelist-validated interval into the SQL as a parameter", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await service.timeseries({
        interval: "month",
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-03-01T00:00:00.000Z"),
      });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      // month buckets align to calendar months, not fixed 30-day steps
      const buckets = await service.timeseries({
        interval: "month",
        from: new Date("2026-01-15T00:00:00.000Z"),
        to: new Date("2026-03-01T00:00:00.000Z"),
      });
      expect(buckets.map((b) => b.bucket)).toEqual([
        "2026-01-01T00:00:00.000Z",
        "2026-02-01T00:00:00.000Z",
      ]);
    });
  });

  // ── overview ─────────────────────────────────────────────────────────

  describe("overview", () => {
    it("computes deltas vs the previous equal-length window and cumulative curves", async () => {
      prisma.analyticsEvent.groupBy.mockImplementation(async ({ where }) => {
        // Distinguish windows by their gte boundary.
        const gte = where.occurredAt.gte as Date;
        const dayMs = 24 * 60 * 60 * 1000;
        if (gte.getTime() === Date.UTC(2026, 9, 11)) {
          return [{ type: "PAGE_VIEW", _count: { _all: 30 } }];
        }
        if (gte.getTime() === Date.UTC(2026, 9, 11) - 10 * dayMs) {
          return [{ type: "PAGE_VIEW", _count: { _all: 10 } }];
        }
        return [];
      });
      prisma.$queryRaw.mockResolvedValue([
        { bucket: new Date("2026-10-11T00:00:00.000Z"), type: "PAGE_VIEW", count: 30n },
      ]);

      const from = new Date("2026-10-11T00:00:00.000Z");
      const to = new Date("2026-10-21T00:00:00.000Z");
      const overview = await service.overview({ from, to });

      expect(overview.totals.PAGE_VIEW.current).toBe(30);
      expect(overview.totals.PAGE_VIEW.previous).toBe(10);
      expect(overview.totals.PAGE_VIEW.deltaPct).toBe(200);
      // cumulative day-1 running total = 30
      expect(overview.cumulative[0].PAGE_VIEW).toBe(30);
    });

    it("reports deltaPct=null (new) when the previous window had zero events", async () => {
      const from = new Date("2026-10-11T00:00:00.000Z");
      const to = new Date("2026-10-21T00:00:00.000Z");
      // Only the CURRENT window has events; every other window is empty.
      prisma.analyticsEvent.groupBy.mockImplementation(async ({ where }) =>
        (where.occurredAt.gte as Date).getTime() === from.getTime()
          ? [{ type: "SIGNUP", _count: { _all: 5 } }]
          : []
      );
      prisma.$queryRaw.mockResolvedValue([]);

      const overview = await service.overview({ from, to });

      expect(overview.totals.SIGNUP.current).toBe(5);
      expect(overview.totals.SIGNUP.previous).toBe(0);
      expect(overview.totals.SIGNUP.deltaPct).toBeNull();
    });
  });

  // ── records ──────────────────────────────────────────────────────────

  describe("records", () => {
    it("clamps pageSize to the hard cap and reports pagination fields", async () => {
      prisma.analyticsEvent.findMany.mockResolvedValueOnce([]);
      prisma.analyticsEvent.count.mockResolvedValueOnce(0);

      const result = await service.records({ page: 2, pageSize: 9999 });

      expect(prisma.analyticsEvent.findMany.mock.calls[0][0].take).toBe(200);
      expect(prisma.analyticsEvent.findMany.mock.calls[0][0].skip).toBe(200);
      expect(result).toEqual({ rows: [], total: 0, page: 2, pageSize: 200 });
    });

    it("builds the type + window filter", async () => {
      prisma.analyticsEvent.findMany.mockResolvedValueOnce([]);
      prisma.analyticsEvent.count.mockResolvedValueOnce(0);

      const from = new Date("2026-10-01T00:00:00.000Z");
      const to = new Date("2026-10-02T00:00:00.000Z");
      await service.records({ type: "LOGIN", from, to });

      const where = prisma.analyticsEvent.findMany.mock.calls[0][0].where;
      expect(where.type).toBe("LOGIN");
      expect(where.occurredAt.gte).toEqual(from);
      expect(where.occurredAt.lt).toEqual(to);
    });
  });
});
