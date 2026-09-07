-- New notification event type: fired when a referral bonus is ADDED to a
-- driver's available balance (born-ELIGIBLE referral payouts). The email
-- tells the driver the money is ready to cash out from the wallet.
ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'DRIVER_REFERRAL_BONUS_EARNED';
