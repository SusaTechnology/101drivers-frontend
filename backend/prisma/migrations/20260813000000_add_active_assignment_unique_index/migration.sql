-- Enforce one active DeliveryAssignment per DeliveryRequest.
--
-- Problem this solves:
--   The driver booking flow (delivery-lifecycle.service.ts:bookDelivery) checks
--   "does this delivery already have an active assignment?" via findFirst, then
--   creates a new DeliveryAssignment row. Under PostgreSQL's default READ
--   COMMITTED isolation, two concurrent driver-book requests can BOTH read
--   "no existing booking" and then BOTH insert — resulting in two drivers
--   thinking they booked the same gig. The application-level check is a TOCTOU
--   race condition.
--
-- Fix: a partial UNIQUE index on DeliveryAssignment(deliveryId) restricted to
-- rows where unassignedAt IS NULL. The database itself will reject the second
-- insert, regardless of what application code does. The Prisma client catches
-- the resulting P2002 error and converts it to a user-friendly GoneException.
--
-- Why PARTIAL (not full @@unique):
--   We want to KEEP historical assignment rows for audit — every driver who
--   was ever assigned, when they were assigned, when they were unassigned,
--   and why. A full @@unique([deliveryId]) would force us to UPDATE the
--   existing row on reassignment, losing history. A partial index lets us
--   keep N historical rows per delivery, while still guaranteeing at most
--   ONE active (unassignedAt IS NULL) row at any time.
--
-- Admin reassign flow (adminDelivery.engine.ts:reassignDelivery) is compatible:
--   it does `updateMany WHERE unassignedAt IS NULL SET unassignedAt = now()`
--   FIRST, then `create` the new row. By the time the new row is inserted,
--   the old row's unassignedAt is non-null so it's excluded from the index —
--   the new insert succeeds.
--
-- Idempotent: IF NOT EXISTS guards the index creation. Safe to run multiple
-- times. The pre-flight SELECT (Step 1) is read-only and safe to re-run.
--
-- Usage:
--   psql -U <user> -d <database> -f migration.sql
-- Or via Prisma:
--   npx prisma db execute --file migration.sql --schema ../../prisma/schema.prisma

-- ── Step 1: Pre-flight check — find any deliveries with multiple active
-- assignments. If any exist, the CREATE UNIQUE INDEX below will fail. We
-- surface them here so the operator can decide how to resolve them (typically:
-- unassign all but the most recent by setting unassignedAt = now() on the
-- older rows). ──
SELECT
  da."deliveryId",
  COUNT(*) AS active_assignment_count,
  ARRAY_AGG(da.id ORDER BY da."assignedAt" DESC) AS assignment_ids,
  ARRAY_AGG(da."driverId" ORDER BY da."assignedAt" DESC) AS driver_ids
FROM "DeliveryAssignment" da
WHERE da."unassignedAt" IS NULL
GROUP BY da."deliveryId"
HAVING COUNT(*) > 1;

-- If the query above returns rows, the index creation below will fail.
-- To auto-resolve (KEEP MOST RECENT, unassign the rest), uncomment and run:
--
-- UPDATE "DeliveryAssignment" da
-- SET "unassignedAt" = NOW(),
--     "reason" = COALESCE(da."reason", '') || ' | Auto-unassigned by migration: duplicate active assignment'
-- WHERE da."unassignedAt" IS NULL
--   AND da.id NOT IN (
--     SELECT id FROM (
--       SELECT id,
--              ROW_NUMBER() OVER (
--                PARTITION BY "deliveryId"
--                ORDER BY "assignedAt" DESC
--              ) AS rn
--       FROM "DeliveryAssignment"
--       WHERE "unassignedAt" IS NULL
--     ) ranked
--     WHERE ranked.rn = 1
--   );

-- ── Step 2: Create the partial unique index. ──
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_assignment_active_unique"
  ON "DeliveryAssignment"("deliveryId")
  WHERE "unassignedAt" IS NULL;

-- ── Step 3: Verify the index exists. ──
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'DeliveryAssignment'
  AND indexname = 'delivery_assignment_active_unique';
