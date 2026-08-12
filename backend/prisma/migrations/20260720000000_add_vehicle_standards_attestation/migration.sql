-- Vehicle Standards Attestation
--
-- Insurance requires that the customer attest, at delivery-creation time,
-- that the vehicle being transported meets these three standards:
--   1. Under 12 years old
--   2. Under 120,000 miles
--   3. Valued under $75,000
--
-- This migration adds two columns to DeliveryRequest that record the
-- attestation: a boolean flag + the timestamp it was made. The combination
-- gives insurers an audit trail: "Did the customer attest? When?"
--
-- The frontend renders a single checkbox (with bold attestation text) on
-- the dealer-create-delivery and dealer-edit-delivery pages. The checkbox
-- is required (z.literal(true)) — submission is blocked if unchecked.
--
-- Both columns are nullable so existing rows (deliveries created before
-- this feature shipped) are treated as "attestation not captured" rather
-- than false. The admin UI surfaces this as "Not required at time of
-- creation" rather than a missing/false negative.
--
-- This migration is safe and idempotent. Usage:
--   psql -U <user> -d <database> -f migration.sql
-- Or via Prisma:
--   npx prisma db execute --file migration.sql --schema ../../prisma/schema.prisma

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
