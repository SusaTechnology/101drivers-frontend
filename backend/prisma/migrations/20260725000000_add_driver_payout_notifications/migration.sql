-- AlterEnum: add DRIVER_PAYOUT_PAID and DRIVER_PAYOUT_FAILED to EnumNotificationEventType
-- Using ADD VALUE so existing rows are unaffected.

ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'DRIVER_PAYOUT_PAID';
ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'DRIVER_PAYOUT_FAILED';
