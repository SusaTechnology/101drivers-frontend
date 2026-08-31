-- Down migration for 20260827120000_payment_resilience_fixes
--
-- Drops everything added by the up migration. Run this if you need to
-- roll back the payment resilience fixes.
--
-- WARNING: this will lose data in the new columns + the entire
-- DriverPayoutAdjustment table. Only run if you're sure.
--
-- Order matters — drop foreign keys + indexes before dropping columns
-- + tables, and drop tables before dropping the enums they reference.

-- ── Drop DriverPayoutAdjustment table (Fix #6) ──
DROP INDEX IF EXISTS "DriverPayoutAdjustment_driverId_status_idx";
DROP INDEX IF EXISTS "DriverPayoutAdjustment_deliveryId_idx";
DROP INDEX IF EXISTS "DriverPayoutAdjustment_paymentId_idx";
DROP INDEX IF EXISTS "DriverPayoutAdjustment_stripeEventId_key";
DROP TABLE IF EXISTS "DriverPayoutAdjustment";

-- ── Drop Payment indexes added by up migration ──
DROP INDEX IF EXISTS "Payment_usageReportStatus_usageReportNextRetryAt_idx";
DROP INDEX IF EXISTS "Payment_remainderChargeStatus_idx";
DROP INDEX IF EXISTS "Payment_disputeId_idx";

-- ── Drop Payment columns (Fixes #1, #3, #5, #7) ──
ALTER TABLE "Payment"
  DROP COLUMN IF EXISTS "usageReportStatus",
  DROP COLUMN IF EXISTS "usageReportAttempts",
  DROP COLUMN IF EXISTS "usageReportLastError",
  DROP COLUMN IF EXISTS "usageReportNextRetryAt",
  DROP COLUMN IF EXISTS "refundedAmountCents",
  DROP COLUMN IF EXISTS "refundStatus",
  DROP COLUMN IF EXISTS "disputeId",
  DROP COLUMN IF EXISTS "disputeStatus",
  DROP COLUMN IF EXISTS "remainderChargeStatus",
  DROP COLUMN IF EXISTS "remainderAmount",
  DROP COLUMN IF EXISTS "remainderDueAt";

-- ── Drop PaymentEvent stripeEventId (Fix #4) ──
DROP INDEX IF EXISTS "PaymentEvent_stripeEventId_key";
ALTER TABLE "PaymentEvent" DROP COLUMN IF EXISTS "stripeEventId";

-- ── Drop enums (must be last — after all column references are gone) ──
DROP TYPE IF EXISTS "EnumUsageReportStatus";
DROP TYPE IF EXISTS "EnumRefundStatus";
DROP TYPE IF EXISTS "EnumRemainderChargeStatus";
DROP TYPE IF EXISTS "EnumAdjustmentStatus";
