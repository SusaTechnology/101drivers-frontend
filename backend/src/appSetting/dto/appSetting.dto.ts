import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class LandingPageSettingsResponseDto {
  @ApiProperty()
  fundraisingEnabled!: boolean;

  @ApiProperty()
  dealerLeadEnabled!: boolean;

  @ApiProperty()
  investorLeadEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  investorDeckTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorDeckUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorDeckFilename!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorDeckUploadedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dealerLeadCtaTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dealerLeadCtaDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorLeadCtaTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorLeadCtaDescription!: string | null;
}

export class UpdateLandingPageSettingsBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fundraisingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dealerLeadEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  investorLeadEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  investorDeckTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: "investorDeckUrl must be a valid URL" })
  investorDeckUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  investorDeckFilename?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dealerLeadCtaTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dealerLeadCtaDescription?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  investorLeadCtaTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  investorLeadCtaDescription?: string | null;
}

export class DeliverySettingsResponseDto {
  @ApiProperty()
  maximumRadiusMiles!: number;

  @ApiProperty()
  transitBufferMinutes!: number;
}

export class UpdateDeliverySettingsBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maximumRadiusMiles?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  transitBufferMinutes?: number;
}

// ============================================================
// REFERRAL PROGRAM SETTINGS (admin-configurable, tiered model)
// ============================================================
// The driver referral program is admin-configurable. The referrer
// earns `referrerRewardAmount` for every `referralThreshold` of
// SUCCESSFUL referrals (tiered payout). The referred driver earns
// a one-shot `referredRewardAmount` when their own referral becomes
// successful (per-referral, not tiered).
//
// Defaults match the current advertised policy:
//   isActive=true, rewardTrigger=ON_DELIVERIES_COMPLETED,
//   requiredDeliveries=30, timeLimitMode=CALENDAR_RANGE (1 year),
//   referrerRewardAmount=150, referralThreshold=20,
//   referredGetsReward=true, referredRewardAmount=150
//
// These values are READ at applyReferral time and SNAPSHOT onto
// each new Referral row, so admin changes don't retroactively
// change pending referrals. The threshold + referrerRewardAmount
// are read LIVE at trigger time (because tiers are about counting,
// and the admin should be able to adjust incentives mid-program).
// ============================================================

/**
 * When does a referral "become successful"?
 * - ON_APPROVED: when admin moves the referred driver from
 *   PENDING_APPROVAL → APPROVED.
 * - ON_DELIVERIES_COMPLETED: when the referred driver completes
 *   `requiredDeliveries` deliveries.
 */
export enum ReferralRewardTrigger {
  ON_APPROVED = "ON_APPROVED",
  ON_DELIVERIES_COMPLETED = "ON_DELIVERIES_COMPLETED",
}

/**
 * Time window mode for the program.
 * - CALENDAR_RANGE: referrals must become successful within
 *   [windowStartDate, windowEndDate]. Referrals created outside
 *   this range are rejected at applyReferral time.
 * - FOREVER: no deadline; whenever the trigger eventually fires,
 *   payout happens.
 */
export enum ReferralTimeLimitMode {
  CALENDAR_RANGE = "CALENDAR_RANGE",
  FOREVER = "FOREVER",
}

/**
 * Payout model for the referral program.
 *
 * - TIERED (legacy): the referrer earns `referrerRewardAmount` for
 *   every `referralThreshold` SUCCESSFUL referrals. The referred
 *   driver earns a one-shot `referredRewardAmount` when their own
 *   referral becomes successful. Driver→Driver referrals only.
 *
 * - PER_DELIVERY (new): the referrer earns `perDeliveryReferrerAmountCents`
 *   for every paid delivery completed by the referred party. The
 *   referred party earns `perDeliveryReferredBonusCents` on the
 *   `perDeliveryBonusTriggerCount`-th paid delivery (e.g. $50 on the
 *   5th paid delivery). Works for Driver→Driver, Customer→Customer,
 *   Customer→Driver, Driver→Customer referrals.
 *
 * The payout model is snapshotted onto each Referral row at
 * applyReferral time, so admin changes don't retroactively change
 * pending referrals. The threshold + amounts are read LIVE at
 * trigger time so the admin can adjust incentives mid-program.
 */
export enum ReferralPayoutModelDto {
  TIERED = "TIERED",
  PER_DELIVERY = "PER_DELIVERY",
}

/**
 * The role of the referrer in a referral relationship. Determines
 * which side of the relationship earns what.
 *
 * - DRIVER: a driver referring another driver. Both the referrer
 *   and the referred driver earn driver-side rewards (paid via
 *   DriverPayout rows, settled through Stripe Connect).
 *
 * - CUSTOMER: a customer (dealer or private) referring another
 *   customer. The referrer earns a credit applied to their next
 *   invoice (ReferralCredit row, status=PENDING → APPLIED when
 *   the next Stripe invoice is created). The referred customer
 *   also earns a credit on their first paid delivery.
 */
export enum ReferralTypeDto {
  DRIVER = "DRIVER",
  CUSTOMER = "CUSTOMER",
}

export class ReferralProgramSettingsResponseDto {
  @ApiProperty({ description: "Master on/off switch for the referral program" })
  isActive!: boolean;

  @ApiProperty({
    description: "When does a referral become successful (trigger payout)",
    enum: ReferralRewardTrigger,
  })
  rewardTrigger!: ReferralRewardTrigger;

  @ApiProperty({
    description: "Required completed deliveries (only used when rewardTrigger = ON_DELIVERIES_COMPLETED)",
  })
  requiredDeliveries!: number;

  @ApiProperty({
    description: "Time window mode",
    enum: ReferralTimeLimitMode,
  })
  timeLimitMode!: ReferralTimeLimitMode;

  @ApiPropertyOptional({ nullable: true, description: "ISO date — program window start (used when CALENDAR_RANGE)" })
  windowStartDate!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "ISO date — program window end (used when CALENDAR_RANGE)" })
  windowEndDate!: string | null;

  @ApiProperty({ description: "Reward amount in USD paid to the REFERRER per tier (every referralThreshold successful referrals)" })
  referrerRewardAmount!: number;

  @ApiProperty({ description: "Number of successful referrals required per tier (e.g. 20 = $150 per 20)" })
  referralThreshold!: number;

  @ApiProperty({ description: "Does the referred driver also get a one-shot reward?" })
  referredGetsReward!: boolean;

  @ApiPropertyOptional({ nullable: true, description: "One-shot reward amount in USD paid to the REFERRED driver when their referral becomes successful (null when referredGetsReward=false)" })
  referredRewardAmount!: number | null;

  // ── PER_DELIVERY model fields (Phase 2) ───────────────────────────
  @ApiProperty({
    description: "Payout model: TIERED (per N successful referrals) or PER_DELIVERY (per paid delivery)",
    enum: ReferralPayoutModelDto,
  })
  payoutModel!: ReferralPayoutModelDto;

  @ApiProperty({
    description:
      "When payoutModel=PER_DELIVERY, the referrer earns this amount (in cents) for every paid delivery " +
      "completed by the referred party. Default 500 ($5).",
    example: 500,
  })
  perDeliveryReferrerAmountCents!: number;

  @ApiProperty({
    description:
      "When payoutModel=PER_DELIVERY, the referred party earns this amount (in cents) as a one-shot bonus " +
      "on the perDeliveryBonusTriggerCount-th paid delivery. Default 5000 ($50).",
    example: 5000,
  })
  perDeliveryReferredBonusCents!: number;

  @ApiProperty({
    description:
      "When payoutModel=PER_DELIVERY, the referred party's bonus fires on this paid-delivery count. " +
      "Default 5 (the 5th paid delivery).",
    example: 5,
  })
  perDeliveryBonusTriggerCount!: number;

  @ApiProperty({
    description:
      "Whether customer referrals are enabled. When false, applyCustomerReferral rejects all " +
      "codes. Independent of the master isActive flag (which gates ALL referrals).",
  })
  customerReferralsEnabled!: boolean;

  @ApiProperty({
    description:
      "Whether driver referrals are enabled. When false, applyReferral (driver→driver) rejects all " +
      "codes. Independent of the master isActive flag (which gates ALL referrals).",
  })
  driverReferralsEnabled!: boolean;
}

export class UpdateReferralProgramSettingsBody {
  @ApiPropertyOptional({ description: "Master on/off switch" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Trigger type", enum: ReferralRewardTrigger })
  @IsOptional()
  @IsEnum(ReferralRewardTrigger)
  rewardTrigger?: ReferralRewardTrigger;

  @ApiPropertyOptional({ description: "Required deliveries (>= 1, used when trigger = ON_DELIVERIES_COMPLETED)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  requiredDeliveries?: number;

  @ApiPropertyOptional({ description: "Time window mode", enum: ReferralTimeLimitMode })
  @IsOptional()
  @IsEnum(ReferralTimeLimitMode)
  timeLimitMode?: ReferralTimeLimitMode;

  @ApiPropertyOptional({ nullable: true, description: "ISO date — program window start (required when CALENDAR_RANGE)" })
  @IsOptional()
  @IsDateString()
  windowStartDate?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "ISO date — program window end (required when CALENDAR_RANGE)" })
  @IsOptional()
  @IsDateString()
  windowEndDate?: string | null;

  @ApiPropertyOptional({ description: "Referrer reward per tier in USD (>= 0)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  referrerRewardAmount?: number;

  @ApiPropertyOptional({ description: "Successful referrals per tier (>= 1)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  referralThreshold?: number;

  @ApiPropertyOptional({ description: "Does the referred driver also get paid?" })
  @IsOptional()
  @IsBoolean()
  referredGetsReward?: boolean;

  @ApiPropertyOptional({ nullable: true, description: "Referred reward in USD (>= 0, null when referredGetsReward=false)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  referredRewardAmount?: number | null;

  // ── PER_DELIVERY model fields (Phase 2) ───────────────────────────
  @ApiPropertyOptional({ description: "Payout model (TIERED vs PER_DELIVERY)", enum: ReferralPayoutModelDto })
  @IsOptional()
  @IsEnum(ReferralPayoutModelDto)
  payoutModel?: ReferralPayoutModelDto;

  @ApiPropertyOptional({
    description: "PER_DELIVERY referrer amount in cents (>= 0). Default 500 ($5).",
    example: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  perDeliveryReferrerAmountCents?: number;

  @ApiPropertyOptional({
    description: "PER_DELIVERY referred bonus in cents (>= 0). Default 5000 ($50).",
    example: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  perDeliveryReferredBonusCents?: number;

  @ApiPropertyOptional({
    description: "PER_DELIVERY bonus trigger count (>= 1). The referred party's bonus fires on this paid-delivery count. Default 5.",
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  perDeliveryBonusTriggerCount?: number;

  @ApiPropertyOptional({ description: "Enable customer (dealer/private) referrals independently of driver referrals." })
  @IsOptional()
  @IsBoolean()
  customerReferralsEnabled?: boolean;

  @ApiPropertyOptional({ description: "Enable driver→driver referrals independently of customer referrals." })
  @IsOptional()
  @IsBoolean()
  driverReferralsEnabled?: boolean;
}