-- Product analytics: immutable event ledger (Task 72).
--
-- One row per business/traffic event: PAGE_VIEW, SIGNUP, LOGIN,
-- DELIVERY_CREATED. Server-side events are written by the services that
-- perform the action (auth.service login/signup, deliveryRequest.service
-- creation chains); PAGE_VIEW is pinged by the SPA via
-- POST /analytics/events (public, per-IP budgeted, PAGE_VIEW-only).
--
-- Drives the admin metrics dashboard (GET /analytics/overview,
-- /analytics/timeseries, /analytics/records):
--   * hourly / daily / monthly time series with gap-free buckets
--   * period-over-period deltas (vs previous equal-length window)
--   * cumulative growth curves
--   * raw records table (the "track of records" — never pruned)
--
-- The ledger is append-only by convention: nothing in the app ever
-- UPDATEs or DELETEs an AnalyticsEvent row.

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "role" TEXT,
    "sessionId" TEXT,
    "path" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- Every dashboard query filters by type + time window: this is THE index.
CREATE INDEX "AnalyticsEvent_type_occurredAt_idx" ON "AnalyticsEvent"("type", "occurredAt");

-- All-window scans (overview totals, cumulative backfills).
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

-- Per-user history lookups (records table filter).
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
