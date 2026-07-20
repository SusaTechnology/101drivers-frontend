-- Migration: Add vehicle standards attestation columns to DeliveryRequest
--
-- Insurance requires the customer to attest at delivery-creation time that
-- the vehicle is:
--   1. Under 12 years old
--   2. Under 120,000 miles
--   3. Valued under $75,000
--
-- Two columns are added: a boolean flag + the timestamp the attestation
-- was made. Both are nullable so existing deliveries are treated as
-- "attestation not captured" (NOT false) — this preserves historical data
-- integrity and avoids implying a customer attested to something they
-- never saw.
--
-- This migration is safe and idempotent. Usage:
--   psql -U <user> -d <database> -f add-vehicle-standards-attestation.sql
-- Or via Prisma:
--   npx prisma db execute --file scripts/migrations/add-vehicle-standards-attestation.sql --schema prisma/schema.prisma

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "vehicleStandardsConfirmed" BOOLEAN;

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "vehicleStandardsConfirmedAt" TIMESTAMP(3);

-- Verify
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'DeliveryRequest'
  AND column_name IN ('vehicleStandardsConfirmed', 'vehicleStandardsConfirmedAt')
ORDER BY column_name;
