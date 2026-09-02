-- Dispute feature: add REJECTED status + refund/rejection audit fields.
--
-- Background: the dispute feature was half-built. Resolving a dispute did
-- NOT issue a refund, there was no way to reject (vs approve) a dispute,
-- and the audit trail didn't record who resolved it or which Stripe refund
-- was issued. This migration:
--   1. Adds the REJECTED value to the EnumDisputeCaseStatus enum.
--   2. Adds rejectionReason, stripeRefundId, resolvedById columns to
--      DisputeCase for the new resolve/reject flow.
--   3. Adds an index on resolvedById + openedAt for typical admin queries.
--
-- Backward compatible: all new columns are nullable. Existing rows keep
-- working unchanged.

-- ─── 1. Add REJECTED to the EnumDisputeCaseStatus enum ───
ALTER TYPE "EnumDisputeCaseStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- ─── 2. Add new nullable columns to DisputeCase ───
ALTER TABLE "DisputeCase"
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeRefundId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolvedById" TEXT;

-- ─── 3. FK constraint: resolvedById → User.id ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DisputeCase_resolvedById_fkey'
  ) THEN
    ALTER TABLE "DisputeCase"
      ADD CONSTRAINT "DisputeCase_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "User" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ─── 4. Indexes for typical admin queries ───
CREATE INDEX IF NOT EXISTS "DisputeCase_resolvedById_idx"
  ON "DisputeCase" ("resolvedById");

CREATE INDEX IF NOT EXISTS "DisputeCase_openedAt_idx"
  ON "DisputeCase" ("openedAt");
