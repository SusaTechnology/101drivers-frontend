-- ============================================================================
-- PRE-CHECK (READ-ONLY) — run this BEFORE the wipe and keep the output.
-- Shows exactly what exists today so you have a record of what is about
-- to be deleted, and can confirm nothing valuable is hiding in here.
--
-- Run:  psql -U <db_user> -d <db_name> -f scripts/wipe-transactional-data.precheck.sql
-- or:   docker exec -i <db_container> psql -U <db_user> -d <db_name> \
--         < scripts/wipe-transactional-data.precheck.sql
-- ============================================================================

\echo ''
\echo '================ 1) ROW COUNTS — WHAT WILL BE DELETED ================'
SELECT 'Deliveries'            AS what, COUNT(*) AS rows FROM "DeliveryRequest"
UNION ALL SELECT 'Quotes (pricing snapshots)' FROM "Quote"
UNION ALL SELECT 'Payments'                   FROM "Payment"
UNION ALL SELECT 'Payment events (audit)'     FROM "PaymentEvent"
UNION ALL SELECT 'Invoices (DB copy)'         FROM "Invoice"
UNION ALL SELECT 'Driver payouts'             FROM "DriverPayout"
UNION ALL SELECT 'Payout adjustments'         FROM "DriverPayoutAdjustment"
UNION ALL SELECT 'Payout batches'             FROM "PayoutBatch"
UNION ALL SELECT 'Referrals'                  FROM "Referral"
UNION ALL SELECT 'Referral credits'           FROM "ReferralCredit"
UNION ALL SELECT 'Disputes'                   FROM "DisputeCase"
UNION ALL SELECT 'Ratings'                    FROM "DeliveryRating"
UNION ALL SELECT 'Tips'                       FROM "Tip"
UNION ALL SELECT 'Tracking sessions'          FROM "TrackingSession"
UNION ALL SELECT 'Notifications (bell history)' FROM "NotificationEvent"
UNION ALL SELECT 'Admin audit rows'           FROM "AdminAuditLog"
UNION ALL SELECT 'Support requests (+notes)'  FROM "SupportRequest"
ORDER BY what;

\echo ''
\echo '================ 2) MONEY CHECK — anything actually PAID? ============'
-- If this shows rows and you are on LIVE Stripe keys, those are real
-- charges. Deleting DB rows does NOT refund anyone — refund in Stripe first.
SELECT status,
       COUNT(*)                        AS payments,
 ROUND(COALESCE(SUM(amount), 0), 2)    AS total_amount,
 ROUND(COALESCE(SUM("refundedAmountCents"), 0) / 100.0, 2) AS total_refunded
FROM "Payment"
GROUP BY status
ORDER BY status;

\echo ''
\echo '================ 3) DEALER BILLING STATE (these rows are KEPT, flags reset) ================'
SELECT c."businessName"            AS business,
       u."email"                   AS login_email,
       c."billingMode"             AS mode,
       c."postpaidEnabled"         AS postpaid,
       c."billingFrozen"           AS frozen,
       (c."stripeSubscriptionId" IS NOT NULL)          AS has_stripe_subscription,
       (c."stripeCustomerId" IS NOT NULL)              AS has_stripe_customer,
       (c."stripeDefaultPaymentMethodId" IS NOT NULL)  AS has_saved_card
FROM "Customer" c
LEFT JOIN "User" u ON u."id" = c."userId"
ORDER BY c."createdAt";

\echo ''
\echo '================ 4) POSTPAID ROWS WITH REAL STRIPE InvoiceItems ================'
-- These are the rows that ALSO exist inside Stripe. The DB wipe alone will
-- NOT remove them from Stripe — that is what scripts/stripe-wipe-billing.ts
-- is for. Run BOTH.
SELECT status, COUNT(*) AS rows,
 ROUND(COALESCE(SUM(amount), 0), 2) AS amount,
 COUNT("stripeInvoiceItemId")       AS has_stripe_invoice_item
FROM "Payment"
WHERE "stripeInvoiceItemId" IS NOT NULL
GROUP BY status;
