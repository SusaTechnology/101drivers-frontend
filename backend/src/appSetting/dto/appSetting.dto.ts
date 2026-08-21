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
}