-- Task 19 — money-visibility alerts.
--
-- 1) Three new notification event types, all admin-facing:
--    • PAYMENT_REFUNDED         — a customer refund COMPLETED (charge.refunded
--      webhook or the reconciliation sweep). Tells admins the delivery/payment
--      now carry refund state (REFUNDED badge + refundedAt) and a driver
--      clawback adjustment was created.
--    • ADMIN_PAYOUT_RUN_FAILED  — the weekly sweep finished with FAILED batches
--      or drivers skipped for insufficient platform balance (the exact
--      "insufficient funds" failure the run report shows).
--    • ADMIN_PLATFORM_PAYOUT    — Stripe moved platform money to the company
--      bank account (payout.paid / payout.failed). Closes the last untracked
--      money rail: previously Stripe→bank payouts were only visible in the
--      Stripe Dashboard, never in our admin surface.
--
-- 2) PROCESSING PaymentEvent status — written by the admin refund endpoint
--    the moment Stripe accepts a refund, upgraded to REFUNDED by the
--    charge.refunded webhook or the reconciler. Gives the Payment Events
--    timeline an audit row even when the webhook is lost, and gives the
--    reconciler a durable work queue to self-heal from.

ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_REFUNDED';
ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'ADMIN_PAYOUT_RUN_FAILED';
ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'ADMIN_PLATFORM_PAYOUT';

ALTER TYPE "EnumPaymentEventStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
