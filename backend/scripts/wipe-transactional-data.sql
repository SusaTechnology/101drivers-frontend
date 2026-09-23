-- ============================================================================
-- WIPE ALL TRANSACTIONAL DATA — "start from zero" for deliveries + billing.
--
-- KEEPS (untouched): users + logins, dealer (Customer) accounts, drivers,
--   saved addresses/vehicles, saved cards (stripeCustomerId +
--   stripeDefaultPaymentMethodId), driver Stripe Connect linkage (see
--   OPTIONAL block below), pricing configs AND each dealer's pricing-config
--   assignment (Customer.pricingConfigId), schedules, operating hours,
--   service districts, app settings, dealer/investor leads.
-- DELETES: every delivery (and everything hanging off it), every payment,
--   every payout, all referral state + credits, all notifications, admin
--   audit rows, support tickets, and resets every dealer's billing flags.
--
-- ⚠️  RULES:
--   1. STOP the backend first (crons + webhooks must not run mid-wipe).
--   2. Take a backup first (this is your undo button):
--        docker exec -t <db_container> pg_dump -U <db_user> <db_name> > backup_before_wipe.sql
--   3. Run scripts/wipe-transactional-data.precheck.sql first and keep it.
--   4. Run scripts/stripe-wipe-billing.ts AFTER this — the DB wipe alone
--      does NOT remove Stripe InvoiceItems; dealers would still be billed.
--   5. Restart the backend only after BOTH steps are done.
--
-- Run:  docker exec -i <db_container> psql -U <db_user> -d <db_name> \
--         -v ON_ERROR_STOP=1 < scripts/wipe-transactional-data.sql
-- (or plain psql: psql -U <db_user> -d <db_name> -v ON_ERROR_STOP=1 -f scripts/wipe-transactional-data.sql)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Self-references first: a delivery can point at the delivery it was
--    resubmitted from. Clear the pointers so the bulk delete can't hit FKs.
-- ---------------------------------------------------------------------------
UPDATE "DeliveryRequest" SET "resubmittedFromId" = NULL;

-- ---------------------------------------------------------------------------
-- 1) Delivery children — deepest first (FK-safe order).
--    NOTE: DeliveryAssignment rows are delivery HISTORY (which driver had
--    which delivery) — they go with the deliveries. Driver accounts,
--    preferences and district preferences are NOT touched.
-- ---------------------------------------------------------------------------
DELETE FROM "DriverRouteCache";        -- has ON DELETE CASCADE anyway; explicit is harmless
DELETE FROM "TrackingPoint";
DELETE FROM "TrackingSession";
DELETE FROM "DisputeNote";
DELETE FROM "DisputeCase";
DELETE FROM "DeliveryEvidence";
DELETE FROM "DeliveryCompliance";
DELETE FROM "EvidenceExport";
DELETE FROM "DeliveryStatusHistory";
DELETE FROM "ScheduleChangeRequest";
DELETE FROM "DeliveryRating";
DELETE FROM "Tip";
DELETE FROM "DeliveryAssignment";

-- ---------------------------------------------------------------------------
-- 2) Billing + payout chain — children before parents.
--    (ReferralCredit before Referral; Referral before DriverPayout, because
--    Referral holds the FK to payouts; Invoice before Payment; PayoutBatchItem
--    before DriverPayout/PayoutBatch.)
--    Referral CODES on dealers and the referral PROGRAM settings in
--    AppSetting are configuration — kept.
-- ---------------------------------------------------------------------------
DELETE FROM "ReferralCredit";
DELETE FROM "PaymentEvent";
DELETE FROM "DriverPayoutAdjustment";
DELETE FROM "PayoutBatchItem";
DELETE FROM "PayoutBatch";
DELETE FROM "Invoice";
DELETE FROM "Payment";
DELETE FROM "Referral";
DELETE FROM "DriverPayout";

-- ---------------------------------------------------------------------------
-- 3) The deliveries themselves (all children are gone now).
-- ---------------------------------------------------------------------------
DELETE FROM "DeliveryRequest";

-- ---------------------------------------------------------------------------
-- 4) Pricing quotes created during delivery creation / quote requests.
--    Pricing CONFIGS themselves (PricingConfig / PricingTier /
--    PricingCategoryRule) are NOT touched — they are configuration.
-- ---------------------------------------------------------------------------
DELETE FROM "Quote";

-- ---------------------------------------------------------------------------
-- 5) Communication + audit history from the test era.
--    (Keep any line by commenting it out — but SupportRequest must at least
--    have deliveryId cleared or deleted, its FK blocks the delivery wipe.)
-- ---------------------------------------------------------------------------
DELETE FROM "SupportRequestNote";
DELETE FROM "SupportRequest";
DELETE FROM "NotificationEvent";
DELETE FROM "AdminAuditLog";

-- ---------------------------------------------------------------------------
-- 6) Reset EVERY dealer's billing state to factory-fresh:
--    prepaid, never configured, not frozen, no subscription.
--    NOTE: stripeCustomerId + saved card are deliberately KEPT so dealers
--    don't have to re-add their cards. Pricing-config assignment
--    (pricingConfigId / pricingModeOverride) is deliberately KEPT.
-- ---------------------------------------------------------------------------
UPDATE "Customer" SET
  "billingMode"              = NULL,
  "postpaidEnabled"          = false,
  "billingFrozen"            = false,
  "billingFrozenAt"          = NULL,
  "billingFrozenReason"      = NULL,
  "stripeSubscriptionId"     = NULL,
  "postpaidCreditLimitCents" = NULL,
  "updatedAt"                = now();

-- ---------------------------------------------------------------------------
-- 7) OPTIONAL — driver Stripe Connect reset (COMMENTED OUT by default).
--    Default: drivers keep their Connect accounts and onboarding state, so
--    they do NOT have to redo identity verification + bank details.
--    If your drivers are TEST-ONLY and should onboard from scratch,
--    uncomment the UPDATE below AND run the stripe script with
--    --also-delete-connect-accounts (both or neither — a linkage pointing
--    at a deleted account would break the next payout until re-onboarded).
--    ("DriverBankAccount" rows are harmless legacy data; no need to touch.)
-- ---------------------------------------------------------------------------
-- UPDATE "Driver" SET
--   "stripeConnectAccountId"          = NULL,
--   "stripeConnectOnboardingComplete" = false,
--   "updatedAt"                       = now();

-- ---------------------------------------------------------------------------
-- 8) Verify — every number here MUST be 0 before you commit.
-- ---------------------------------------------------------------------------
\echo ''
\echo '================ VERIFY (all rows must show 0) ================'
SELECT 'DeliveryRequest'    AS t, COUNT(*) AS rows FROM "DeliveryRequest"
UNION ALL SELECT 'Quote'                FROM "Quote"
UNION ALL SELECT 'Payment'              FROM "Payment"
UNION ALL SELECT 'PaymentEvent'         FROM "PaymentEvent"
UNION ALL SELECT 'Invoice'              FROM "Invoice"
UNION ALL SELECT 'DriverPayout'         FROM "DriverPayout"
UNION ALL SELECT 'DriverPayoutAdjustment' FROM "DriverPayoutAdjustment"
UNION ALL SELECT 'PayoutBatch'          FROM "PayoutBatch"
UNION ALL SELECT 'Referral'             FROM "Referral"
UNION ALL SELECT 'ReferralCredit'       FROM "ReferralCredit"
UNION ALL SELECT 'DisputeCase'          FROM "DisputeCase"
UNION ALL SELECT 'DeliveryRating'       FROM "DeliveryRating"
UNION ALL SELECT 'Tip'                  FROM "Tip"
UNION ALL SELECT 'TrackingSession'      FROM "TrackingSession"
UNION ALL SELECT 'NotificationEvent'    FROM "NotificationEvent"
UNION ALL SELECT 'AdminAuditLog'        FROM "AdminAuditLog"
UNION ALL SELECT 'SupportRequest'       FROM "SupportRequest"
ORDER BY t;

SELECT 'Dealers still on postpaid (must be 0)' AS check,
       COUNT(*) AS rows
FROM "Customer"
WHERE "billingMode" IS NOT NULL
   OR "postpaidEnabled" = true
   OR "billingFrozen" = true
   OR "stripeSubscriptionId" IS NOT NULL;

SELECT 'Dealers kept (accounts + cards safe)' AS check,
       COUNT(*) AS rows,
       COUNT("stripeDefaultPaymentMethodId") AS with_saved_card;

SELECT 'Pricing configs kept' AS check, COUNT(*) AS rows FROM "PricingConfig";

COMMIT;

\echo ''
\echo 'DONE. Now run:  npx ts-node scripts/stripe-wipe-billing.ts  (dry run first, then --apply)'
