-- Migration: Add CLOSED status to EnumDeliveryRequestStatus
--
-- Run this ONCE in PostgreSQL to:
-- 1. Add 'CLOSED' to the enum types
-- 2. Migrate existing COMPLETED deliveries without dropoff evidence → CLOSED
-- 3. Add status history entries for the CLOSED transition
--
-- IMPORTANT: After running this, restart all backend connections
-- (pm2 stop + sleep 5 + pm2 start) because existing connections cache
-- the old enum metadata.
--
-- Usage:
--   psql -U <user> -d <database> -f add-closed-status.sql

-- Step 1: Add CLOSED to the enums (must be done outside a transaction)
ALTER TYPE "EnumDeliveryRequestStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "EnumDeliveryStatusHistoryToStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "EnumDeliveryStatusHistoryFromStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- Step 2: Migrate existing COMPLETED deliveries without dropoff evidence → CLOSED
UPDATE "DeliveryRequest"
SET status = 'CLOSED'
WHERE status = 'COMPLETED'
  AND NOT EXISTS (
    SELECT 1 FROM "DeliveryEvidence"
    WHERE "DeliveryEvidence"."deliveryId" = "DeliveryRequest"."id"
      AND "DeliveryEvidence".phase = 'DROPOFF'
  );

-- Step 3: Add a status history entry for each migrated delivery
INSERT INTO "DeliveryStatusHistory" (
  id,
  "deliveryId",
  "actorUserId",
  "actorRole",
  "actorType",
  note,
  "fromStatus",
  "toStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  dr.id,
  COALESCE(
    (SELECT dsh."actorUserId" FROM "DeliveryStatusHistory" dsh
     WHERE dsh."deliveryId" = dr.id AND dsh."toStatus" = 'COMPLETED'
     ORDER BY dsh."createdAt" DESC LIMIT 1),
    NULL
  ),
  COALESCE(
    (SELECT dsh."actorRole" FROM "DeliveryStatusHistory" dsh
     WHERE dsh."deliveryId" = dr.id AND dsh."toStatus" = 'COMPLETED'
     ORDER BY dsh."createdAt" DESC LIMIT 1),
    'ADMIN'
  ),
  'USER',
  'Migrated: COMPLETED → CLOSED (no dropoff evidence)',
  'COMPLETED',
  'CLOSED',
  NOW(),
  NOW()
FROM "DeliveryRequest" dr
WHERE dr.status = 'CLOSED'
  AND NOT EXISTS (
    SELECT 1 FROM "DeliveryStatusHistory" dsh
    WHERE dsh."deliveryId" = dr.id AND dsh."toStatus" = 'CLOSED'
  );

-- Step 4: Verify the migration
SELECT status, COUNT(*) as count
FROM "DeliveryRequest"
GROUP BY status
ORDER BY status;
