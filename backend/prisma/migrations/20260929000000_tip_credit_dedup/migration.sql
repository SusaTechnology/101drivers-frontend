-- Idempotency for tip payout credits — stores the Stripe event id that
-- last credited this tip to the driver payout (or TIP adjustment).
ALTER TABLE "Tip" ADD COLUMN "payoutCreditedEventId" TEXT;
