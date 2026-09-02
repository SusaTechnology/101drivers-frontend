-- Add signupState to Customer: US state declared at signup (2-letter code).
-- Nullable additive column — existing rows are untouched (NULL = not captured).
-- Private customers in CA are auto-approved at signup; this preserves the
-- audit trail of why an account skipped manual approval.
ALTER TABLE "Customer" ADD COLUMN "signupState" TEXT;
