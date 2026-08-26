-- Add attemptCount column to Payment table.
--
-- Stores Stripe's invoice.attempt_count at webhook time so the admin
-- can see which retry attempt this failure was (1st, 2nd, 3rd, etc.)
-- without making a live Stripe API call.
--
-- Nullable — existing rows and non-postpaid payments have null.
-- Only set when the invoice.payment_failed webhook fires.

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER;
