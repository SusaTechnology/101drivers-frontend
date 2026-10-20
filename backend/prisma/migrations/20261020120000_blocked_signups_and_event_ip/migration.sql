-- Mobile-only driver signup: block table + event IP attribution.
--
-- 1) "BlockedSignup" — one row per driver-registration attempt rejected by
--    the mobile-only user-agent guard on POST /auth/signup/driver. This is
--    the audit trail for the desktop-blocking rule and the spam radar
--    (same IP + many attempted emails = a script). Indexed on
--    (ip, createdAt) for the repeat-offender query and createdAt for
--    window counts on the admin metrics page.
--
-- 2) "AnalyticsEvent.ip" — client IP captured server-side on every event
--    (LOGIN / SIGNUP / PAGE_VIEW) so the records ledger can show WHO an
--    event came from next to the user agent. Null for historical rows.

CREATE TABLE "BlockedSignup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "email" TEXT,
    "reason" TEXT,

    CONSTRAINT "BlockedSignup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlockedSignup_ip_createdAt_idx" ON "BlockedSignup"("ip", "createdAt");
CREATE INDEX "BlockedSignup_createdAt_idx" ON "BlockedSignup"("createdAt");

ALTER TABLE "AnalyticsEvent" ADD COLUMN "ip" TEXT;
