-- Link DriverPayoutAdjustment rows to the PayoutBatch they were settled in.
--
-- Why: the batch payout rails (WEEKLY_AUTO / MANUAL_FREE / INSTANT) mark
-- adjustments APPLIED inside the batch transaction, but had no linkage
-- back to the batch. When a batch's Stripe transfer failed,
-- revertFailedBatch could not identify which adjustments to restore
-- (it queried by appliedToPayoutId, which the batch rails never set), so
-- a failed transfer silently erased clawback debts and drivers' late tips.
--
-- With appliedBatchId, revertFailedBatch restores every APPLIED
-- adjustment of the failed batch to PENDING and deletes the PENDING
-- leftover rows the batch created (their debt returns via the re-opened
-- original adjustment).
ALTER TABLE "DriverPayoutAdjustment" ADD COLUMN "appliedBatchId" TEXT;

CREATE INDEX "DriverPayoutAdjustment_appliedBatchId_idx" ON "DriverPayoutAdjustment"("appliedBatchId");

ALTER TABLE "DriverPayoutAdjustment" ADD CONSTRAINT "DriverPayoutAdjustment_appliedBatchId_fkey" FOREIGN KEY ("appliedBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
