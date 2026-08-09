-- Migration: Cleanup orphaned User rows from failed business signups
--
-- Run this ONCE in PostgreSQL to delete User rows that were created by
-- failed business-signup attempts before commit e478bfd (which wrapped
-- User+Customer creation in a $transaction).
--
-- WHAT IS AN ORPHAN?
--   A User row whose role is BUSINESS_CUSTOMER or PRIVATE_CUSTOMER but
--   which has NO Customer row attached. These were created when:
--     1. AuthService.signupBusinessCustomer created the User row, then
--     2. CustomerService.createCustomer threw (typically because the
--        businessPlaceId @unique constraint was violated by a duplicate
--        business name), and
--     3. The User row was NOT rolled back (no $transaction).
--
-- WHY DELETE THEM?
--   - They block the dealer from retrying with the same email
--     (ensureEmailDoesNotExist sees the orphan and 409s).
--   - They pollute the admin user list with misleading "PENDING" badges
--     (now fixed to show "Incomplete Signup" — commit after e478bfd).
--   - They have no business value: no Customer record means no deliveries,
--     no payments, no history. Just an email + password hash sitting there.
--
-- SAFETY
--   - 7-day grace period so we don't nuke in-progress signups (dealer may
--     still be on the OTP step).
--   - We only delete users with ZERO related records (no deliveries, no
--     assignments, no audit logs, no notifications, no status actions).
--     This mirrors UserPolicyService.beforeDelete's hasDependencies check.
--   - We also explicitly skip ADMIN users — admins are never created via
--     the signup flow, so any admin without a Customer/Driver row is
--     legitimate and must NOT be deleted.
--
-- DRY-RUN
--   The SELECT at the bottom shows what WOULD be deleted before you commit.
--   Run the SELECT first, eyeball the list, then re-run with the DELETE
--   uncommented (or just run the DELETE — the SELECT is informational).
--
-- Usage:
--   psql -U <user> -d <database> -f cleanup-orphan-users.sql

-- ─── Step 1: Preview the orphans that will be deleted ────────────────
-- Shows email, full name, phone (if any), and signup date for each orphan.
-- Review this list before running the DELETE in Step 2.
SELECT
  u.id,
  u.email,
  u."fullName",
  u.phone,
  u."createdAt",
  u.roles
FROM "User" u
LEFT JOIN "Customer" c ON c."userId" = u.id
LEFT JOIN "Driver" d ON d."userId" = u.id
WHERE u.roles IN ('BUSINESS_CUSTOMER', 'PRIVATE_CUSTOMER')
  AND c.id IS NULL
  AND d.id IS NULL
  AND u."createdAt" < NOW() - INTERVAL '7 days'
  -- Mirror UserPolicyService.beforeDelete's hasDependencies check — only
  -- delete users with ZERO related records of any kind.
  AND NOT EXISTS (SELECT 1 FROM "DeliveryRequest" dr WHERE dr."createdByUserId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "DeliveryAssignment" da WHERE da."driverUserId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "AdminAuditLog" aal WHERE aal."actorUserId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "NotificationEvent" ne WHERE ne."userId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "DeliveryStatusHistory" dsh WHERE dsh."actorUserId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "ScheduleChangeRequest" scr WHERE scr."requestedByUserId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "ScheduleChangeRequest" scr WHERE scr."decidedByUserId" = u.id)
ORDER BY u."createdAt" DESC;

-- ─── Step 2: Delete the orphans ──────────────────────────────────────
-- Uncomment the DELETE below to actually perform the cleanup. The WHERE
-- clause is identical to the SELECT above so the preview is exact.
--
-- DELETE FROM "User"
-- WHERE id IN (
--   SELECT u.id
--   FROM "User" u
--   LEFT JOIN "Customer" c ON c."userId" = u.id
--   LEFT JOIN "Driver" d ON d."userId" = u.id
--   WHERE u.roles IN ('BUSINESS_CUSTOMER', 'PRIVATE_CUSTOMER')
--     AND c.id IS NULL
--     AND d.id IS NULL
--     AND u."createdAt" < NOW() - INTERVAL '7 days'
--     AND NOT EXISTS (SELECT 1 FROM "DeliveryRequest" dr WHERE dr."createdByUserId" = u.id)
--     AND NOT EXISTS (SELECT 1 FROM "DeliveryAssignment" da WHERE da."driverUserId" = u.id)
--     AND NOT EXISTS (SELECT 1 FROM "AdminAuditLog" aal WHERE aal."actorUserId" = u.id)
--     AND NOT EXISTS (SELECT 1 FROM "NotificationEvent" ne WHERE ne."userId" = u.id)
--     AND NOT EXISTS (SELECT 1 FROM "DeliveryStatusHistory" dsh WHERE dsh."actorUserId" = u.id)
--     AND NOT EXISTS (SELECT 1 FROM "ScheduleChangeRequest" scr WHERE scr."requestedByUserId" = u.id)
--     AND NOT EXISTS (SELECT 1 FROM "ScheduleChangeRequest" scr WHERE scr."decidedByUserId" = u.id)
-- );

-- ─── Step 3: Verify ──────────────────────────────────────────────────
-- After running the DELETE, this should return zero rows.
SELECT COUNT(*) AS remaining_orphans
FROM "User" u
LEFT JOIN "Customer" c ON c."userId" = u.id
LEFT JOIN "Driver" d ON d."userId" = u.id
WHERE u.roles IN ('BUSINESS_CUSTOMER', 'PRIVATE_CUSTOMER')
  AND c.id IS NULL
  AND d.id IS NULL
  AND u."createdAt" < NOW() - INTERVAL '7 days';
