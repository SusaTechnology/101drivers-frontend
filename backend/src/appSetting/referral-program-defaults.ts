// src/appSetting/referral-program-defaults.ts
//
// DEFAULT referral program policy — a STANDALONE module (no Nest, no
// Prisma) so it can be imported from BOTH:
//   1. appSetting.service.ts  — the runtime fallback when the DB row is
//      missing or partial, and
//   2. scripts/seed/index.ts  — the DB seed that writes the row.
// Sharing this one function guarantees the service fallback and the
// seeded DB row can NEVER drift apart.
//
// Matches the current advertised policy: $150 to referrer per 20
// successful referrals (legacy tiered), $150 to the referred driver
// once when they complete 30 deliveries within a 1-year calendar
// window (legacy), and the V3 PER_DELIVERY program below.
import {
  ReferralProgramSettingsResponseDto,
  ReferralRewardTrigger,
  ReferralTimeLimitMode,
  ReferralPayoutModelDto,
} from "./dto/appSetting.dto";

export function defaultReferralProgramSettings(): ReferralProgramSettingsResponseDto {
  // Default window: 1 year from now (renewed each time the admin
  // resets, but stable enough for first run).
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

  return {
    isActive: true,
    rewardTrigger: ReferralRewardTrigger.ON_DELIVERIES_COMPLETED,
    requiredDeliveries: 30,
    timeLimitMode: ReferralTimeLimitMode.CALENDAR_RANGE,
    windowStartDate: windowStart,
    windowEndDate: windowEnd,
    referrerRewardAmount: 150,
    referralThreshold: 20,
    // V3 spec: payouts go to REFERRERS only — the referred party earns
    // nothing themselves. Flip via admin settings if that ever changes.
    referredGetsReward: false,
    referredRewardAmount: 150,
    // ── PER_DELIVERY defaults (Phase 2) ──
    // V3 spec default is PER_DELIVERY — the unified driver referral
    // ($50 on the 5th paid delivery) + business/residential programs
    // are all PER_DELIVERY concepts. Legacy TIERED snapshots keep
    // paying per their frozen policy regardless of this default.
    payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
    // $5 to referrer per paid delivery
    // ── V2 spec: separate per-delivery amounts by referrer type ──
    perDeliveryPersonalReferrerAmountCents: 500,    // $5
    perDeliveryBusinessReferrerAmountCents: 1000,   // $10
    perDeliveryDriverReferrerAmountCents: 500,      // $5
    // OLD: uniform amount — kept for backward compat
    perDeliveryReferrerAmountCents: 500,
    // $50 bonus to the referred party
    perDeliveryReferredBonusCents: 5000,
    // Bonus fires on the 5th paid delivery
    perDeliveryBonusTriggerCount: 5,
    // ── V3 spec: window + business/residential programs ──
    // DRIVER_REFERRAL $50 window: 30 days from the referred driver's
    // signup (clock anchor = account creation — documented decision).
    referralWindowDays: 30,
    // BUSINESS_REFERRAL: $10 one-time on the referred business
    // customer's first paid delivery, rolling 30-day cap $300/referrer.
    businessReferralAmountCents: 1000,
    businessReferralRollingCapCents: 30000,
    // RESIDENTIAL_REFERRAL: $5 one-time on the referred personal
    // customer's first paid delivery. No cap.
    residentialReferralAmountCents: 500,
    // Both referral types enabled by default
    customerReferralsEnabled: true,
    driverReferralsEnabled: true,
    // ── V3.1: who can refer whom (SINGLE SOURCE OF TRUTH) ──
    // matrix[referrerRole][referredRole] = allowed?
    // Roles: DRIVER | PERSONAL | BUSINESS (customer referrers map to
    // PERSONAL/BUSINESS by customerType; drivers always map to DRIVER).
    // Default policy:
    //   - DRIVER referrers can refer drivers + personal customers,
    //     NOT businesses (owner: "a driver cannot refer a business").
    //   - PERSONAL referrers can refer drivers (owner: "customer-to-
    //     driver referrals are worth keeping") + personal customers,
    //     NOT businesses (mirrors drivers).
    //   - BUSINESS referrers can refer everyone — B2B is the source
    //     of the $10 business-referral program ($300 rolling cap).
    // Every cell is admin-tunable from the admin referral program page;
    // ALL consumers (invite page buttons, signup-form validation, and
    // the apply endpoints' hard rejection) derive from this one shape.
    referralRoleMatrix: {
      DRIVER: { DRIVER: true, PERSONAL: true, BUSINESS: false },
      PERSONAL: { DRIVER: true, PERSONAL: true, BUSINESS: false },
      BUSINESS: { DRIVER: true, PERSONAL: true, BUSINESS: true },
    },
  };
}
