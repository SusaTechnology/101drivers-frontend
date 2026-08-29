-- Add toUserId to NotificationEvent for proper recipient routing
--
-- The notification bell was showing notifications to the wrong roles
-- (admin seeing dealer notifications, driver seeing dealer notifications).
-- Root cause: the visibility query matched on actorUserId OR customer.userId
-- OR driver.userId — so if a notification had BOTH customerId and driverId
-- set, both the dealer and driver saw it, even if the email was only for one.
--
-- Fix: add a toUserId field that explicitly stores the actual recipient.
-- The visibility query now matches on toUserId only (with backward compat
-- for old rows without toUserId set).

ALTER TABLE "NotificationEvent"
  ADD COLUMN IF NOT EXISTS "toUserId" TEXT;

-- FK constraint — the User relation for the recipient
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationEvent_toUserId_fkey'
  ) THEN
    ALTER TABLE "NotificationEvent"
      ADD CONSTRAINT "NotificationEvent_toUserId_fkey"
      FOREIGN KEY ("toUserId") REFERENCES "User" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for the bell's visibility query (the primary lookup path)
CREATE INDEX IF NOT EXISTS "NotificationEvent_toUserId_isRead_createdAt_idx"
  ON "NotificationEvent" ("toUserId", "isRead", "createdAt");

-- ── Backfill toUserId for existing rows ──
-- Best-effort: use templateCode to determine who should see each
-- notification. Old rows without a clear templateCode pattern will
-- have toUserId = null and fall back to the old OR visibility query.
UPDATE "NotificationEvent" ne
SET "toUserId" = CASE
  -- Admin-facing notifications → actorUserId (the admin who triggered it)
  WHEN ne."templateCode" ~* '(admin|commission|pricing-edit|usage-report|remainder-uncollectible|compensation|lock-in-retained)' THEN
    ne."actorUserId"
  -- Driver-facing notifications → driver.userId
  WHEN ne."templateCode" ~* '(driver|payout|booked|trip-started-driver|dispute-opened-driver|support)' THEN
    (SELECT d."userId" FROM "Driver" d WHERE d."id" = ne."driverId")
  -- Customer/dealer-facing notifications → customer.userId
  WHEN ne."templateCode" ~* '(customer|dealer|delivery|payment|schedule|tracking|reminder)' THEN
    (SELECT c."userId" FROM "Customer" c WHERE c."id" = ne."customerId")
  -- Fallback: if only customerId is set (no driverId) → customer.userId
  WHEN ne."customerId" IS NOT NULL AND ne."driverId" IS NULL THEN
    (SELECT c."userId" FROM "Customer" c WHERE c."id" = ne."customerId")
  -- Fallback: if only driverId is set (no customerId) → driver.userId
  WHEN ne."driverId" IS NOT NULL AND ne."customerId" IS NULL THEN
    (SELECT d."userId" FROM "Driver" d WHERE d."id" = ne."driverId")
  -- Ultimate fallback → actorUserId
  ELSE ne."actorUserId"
END
WHERE ne."toUserId" IS NULL;
