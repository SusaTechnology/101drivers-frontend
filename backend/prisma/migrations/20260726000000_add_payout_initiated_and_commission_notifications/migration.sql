-- AlterEnum: add DRIVER_PAYOUT_INITIATED and ADMIN_COMMISSION_RECEIVED
-- to EnumNotificationEventType.
--
-- DRIVER_PAYOUT_INITIATED: fires immediately after the Stripe transfer API
-- call returns successfully (in PaymentPayoutEngine.initiateDriverTransfer).
-- Tells the driver "your payout for delivery #X is on its way to your
-- Connect account" without waiting for the transfer.paid webhook (which
-- can take 1-2 business days for standard transfers).
--
-- ADMIN_COMMISSION_RECEIVED: fires from the transfer.paid webhook handler
-- (handleTransferPaid) — at that point the customer's payment is captured,
-- the driver's transfer has settled, and the platform's commission
-- (gross - driverNet) is realized in the platform balance.

ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'DRIVER_PAYOUT_INITIATED';
ALTER TYPE "EnumNotificationEventType" ADD VALUE IF NOT EXISTS 'ADMIN_COMMISSION_RECEIVED';
