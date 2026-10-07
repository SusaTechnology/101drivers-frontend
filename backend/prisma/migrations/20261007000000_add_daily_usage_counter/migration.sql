-- DailyUsageCounter: per-identity per-day usage counters for metered
-- operations. The first (and today only) scope is "quote_preview" — the
-- quote calculation endpoints that trigger billed Google Maps API calls
-- (Geocoding + Routes API). One row per (scope, identity, UTC day); the
-- identity is "user:<id>" for authenticated callers or "ip:<address>"
-- for guests. The daily quote budget itself is admin-configurable via
-- the QUOTE_USAGE_LIMITS app setting (see src/appSetting/quote-usage-limits.ts).
--
-- scope/identity/day are plain TEXT with app-level validation — no enum
-- types, so this migration has no ALTER TYPE ownership concerns.
-- Rows for past days are opportunistically deleted by the app.

-- CREATE TABLE
CREATE TABLE "DailyUsageCounter" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyUsageCounter_pkey" PRIMARY KEY ("id")
);

-- CREATE UNIQUE INDEX (compound natural key — one counter per identity per day)
CREATE UNIQUE INDEX "DailyUsageCounter_scope_identity_day_key" ON "DailyUsageCounter"("scope", "identity", "day");

-- CREATE INDEX (day-rollover cleanup scans by scope+day)
CREATE INDEX "DailyUsageCounter_scope_day_idx" ON "DailyUsageCounter"("scope", "day");
