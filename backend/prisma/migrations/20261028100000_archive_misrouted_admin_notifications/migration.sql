-- Archive notifications that were MISROUTED into an admin's bell.
--
-- WHY: NotificationEventEngine.queueAndSend used to fall back to
-- toUserId = actorUserId when a customer/driver notification could not be
-- routed to a linked user account. The actor is usually the ADMIN who
-- performed the action (approve/reject/suspend...), so admins received
-- customer-facing notifications like "Your customer account has been
-- approved" in their bell. The engine no longer falls back (fix shipped
-- the same day); this migration cleans up the rows already stored.
--
-- WHAT is archived (archivedAt = now(), nothing is deleted):
--   - rows addressed to an ADMIN-role user,
--   - whose template code is NOT admin-facing (no admin/commission/
--     pricing-edit/usage-report/remainder-uncollectible/compensation/
--     lock-in-retained token — legit admin notifications all carry
--     admin-* style codes, which these filters protect),
--   - with a customerId or driverId whose LINKED user is somebody else
--     (or has no linked user at all) — i.e. provably not the recipient.
--
-- Rows where the admin IS the linked customer/driver user (owner testing
-- their own accounts) are left untouched: cu/dr."userId" = toUserId fails
-- the mismatch test. NULL templateCode rows are left untouched (cannot be
-- classified safely).

UPDATE "NotificationEvent" AS ne
SET "archivedAt" = NOW()
FROM "User" AS recipient
LEFT JOIN "Customer" AS cu ON cu."id" = ne."customerId"
LEFT JOIN "Driver" AS dr ON dr."id" = ne."driverId"
WHERE ne."toUserId" = recipient."id"
  AND recipient."roles" = 'ADMIN'
  AND ne."archivedAt" IS NULL
  AND ne."templateCode" IS NOT NULL
  AND ne."templateCode" NOT ILIKE '%admin%'
  AND ne."templateCode" NOT ILIKE '%commission%'
  AND ne."templateCode" NOT ILIKE '%pricing-edit%'
  AND ne."templateCode" NOT ILIKE '%usage-report%'
  AND ne."templateCode" NOT ILIKE '%remainder-uncollectible%'
  AND ne."templateCode" NOT ILIKE '%compensation%'
  AND ne."templateCode" NOT ILIKE '%lock-in-retained%'
  AND (
    (
      ne."customerId" IS NOT NULL
      AND (cu."userId" IS NULL OR cu."userId" <> ne."toUserId")
    )
    OR
    (
      ne."driverId" IS NOT NULL
      AND (dr."userId" IS NULL OR dr."userId" <> ne."toUserId")
    )
  );
