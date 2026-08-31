-- Referral V2 — per-delivery payouts, customer referrers, referral codes, credits
--
-- This migration adds support for:
-- 1. Customer referral codes (on Customer + Driver tables)
-- 2. Per-delivery payout model (TIERED vs PER_DELIVERY)
-- 3. Customer→Customer and Customer→Driver referrals
-- 4. ReferralCredit model for tracking per-delivery credits
-- 5. ReferralType enum (CUSTOMER vs DRIVER)

-- ── New enums ────────────────────────────────────────────────────

CREATE TYPE "EnumReferralPayoutModel" AS ENUM ('TIERED', 'PER_DELIVERY');
CREATE TYPE "EnumReferralType" AS ENUM ('CUSTOMER', 'DRIVER');
CREATE TYPE "EnumReferralCreditStatus" AS ENUM ('PENDING', 'APPLIED', 'EXPIRED');

-- ── Customer: add referral code fields ───────────────────────────

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "referralCode" TEXT,
  ADD COLUMN IF NOT EXISTS "referralCodeLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_referralCode_key"
  ON "Customer" ("referralCode")
  WHERE "referralCode" IS NOT NULL;

-- ── Driver: add referral code fields ─────────────────────────────

ALTER TABLE "Driver"
  ADD COLUMN IF NOT EXISTS "referralCode" TEXT,
  ADD COLUMN IF NOT EXISTS "referralCodeLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Driver_referralCode_key"
  ON "Driver" ("referralCode")
  WHERE "referralCode" IS NOT NULL;

-- ── Referral: add new fields for customer referrers + per-delivery ─

ALTER TABLE "Referral"
  ADD COLUMN IF NOT EXISTS "referrerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "referredCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "referralType" "EnumReferralType",
  ADD COLUMN IF NOT EXISTS "payoutModel" "EnumReferralPayoutModel" NOT NULL DEFAULT 'TIERED',
  ADD COLUMN IF NOT EXISTS "completedPaidDeliveries" INTEGER NOT NULL DEFAULT 0;

-- FK for referredCustomerId → Customer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Referral_referredCustomerId_fkey'
  ) THEN
    ALTER TABLE "Referral"
      ADD CONSTRAINT "Referral_referredCustomerId_fkey"
      FOREIGN KEY ("referredCustomerId") REFERENCES "Customer" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Referral_referredCustomerId_key"
  ON "Referral" ("referredCustomerId")
  WHERE "referredCustomerId" IS NOT NULL;

-- ── ReferralCredit table ─────────────────────────────────────────

CREATE TABLE "ReferralCredit" (
  "id"              TEXT                       NOT NULL,
  "createdAt"        TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)               NOT NULL,
  "referralId"       TEXT                       NOT NULL,
  "customerId"        TEXT,
  "deliveryId"       TEXT,
  "amountCents"      INTEGER                    NOT NULL,
  "reason"           TEXT                       NOT NULL,
  "status"           "EnumReferralCreditStatus" NOT NULL DEFAULT 'PENDING',
  "appliedAt"        TIMESTAMP(3),
  "stripeInvoiceId"  TEXT,

  PRIMARY KEY ("id"),
  CONSTRAINT "ReferralCredit_referralId_fkey"
    FOREIGN KEY ("referralId") REFERENCES "Referral" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReferralCredit_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ReferralCredit_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "DeliveryRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ReferralCredit_customerId_status_idx"
  ON "ReferralCredit" ("customerId", "status");
CREATE INDEX IF NOT EXISTS "ReferralCredit_referralId_idx"
  ON "ReferralCredit" ("referralId");
CREATE INDEX IF NOT EXISTS "ReferralCredit_deliveryId_idx"
  ON "ReferralCredit" ("deliveryId");
