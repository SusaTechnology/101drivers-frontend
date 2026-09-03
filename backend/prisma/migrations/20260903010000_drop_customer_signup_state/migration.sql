-- Drop Customer.signupState: the state-based auto-approval gate was removed.
-- Private customers are now auto-approved at signup regardless of location,
-- so the self-declared signup state is no longer captured or needed.
-- (Pair with migration 20260903000000_customer_signup_state which added it —
-- applying both in order is a net no-op on fresh databases.)
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "signupState";
