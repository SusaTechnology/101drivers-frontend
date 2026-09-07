-- Customer referral-credit notification types:
--   CUSTOMER_REFERRAL_CREDIT_EARNED — a referral credit was ADDED to the
--     customer's account (per-delivery referrer reward, one-time
--     business/residential reward, or referred-customer bonus). The email
--     tells the customer how the money will reach them (card refund for
--     personal / weekly-invoice discount for business).
--   CUSTOMER_REFERRAL_CREDIT_APPLIED — the credit's money is ON ITS WAY:
--     refunded to the customer's card (prepaid, statement credit) or
--     applied as a negative line item on the weekly invoice (postpaid).
-- Safe to skip: if these values are missing, only the customer emails
-- fail (logged warnings) — credits and refunds are unaffected.
ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_REFERRAL_CREDIT_EARNED';
ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_REFERRAL_CREDIT_APPLIED';
