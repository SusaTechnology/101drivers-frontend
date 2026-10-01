-- Remember where a held driver was in the funnel so "release hold"
-- restores them to the same stage (WAITLISTED / INVITED /
-- PENDING_APPROVAL) instead of always dumping them back to waitlist.
-- heldAt records when the current hold started (UI + audit context).
-- Full hold/release history lives in AdminAuditLog (DRIVER_HOLD /
-- DRIVER_RELEASE actions).
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "heldFromStatus" "EnumDriverStatus",
                    ADD COLUMN IF NOT EXISTS "heldAt" TIMESTAMP(3);
