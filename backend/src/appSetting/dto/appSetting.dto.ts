import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
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
// REFERRAL PROGRAM SETTINGS
// ============================================================
// The driver referral program is admin-configurable. The admin sets:
//   - rewardAmount:     $ paid to referrer + referred driver on completion
//   - tripsRequired:    # of completed deliveries the referred driver must make
//   - daysToComplete:   # of days the referred driver has to complete the trips
//   - maxReferrals:     cap on # of friends a single driver can refer
//
// Defaults match the current advertised policy:
//   rewardAmount=150, tripsRequired=30, daysToComplete=30, maxReferrals=10
//
// These values are read by ReferralService.applyReferral when a new
// referral row is created, so changing them in the admin UI takes
// effect for all NEW referrals immediately. Existing referral rows
// keep whatever tripsRequired / rewardAmount they were created with.
// ============================================================

export class ReferralProgramSettingsResponseDto {
  @ApiProperty({ description: "Reward amount in USD paid to each side on completion" })
  rewardAmount!: number;

  @ApiProperty({ description: "Number of completed deliveries the referred driver must make" })
  tripsRequired!: number;

  @ApiProperty({ description: "Number of days the referred driver has to complete the required trips" })
  daysToComplete!: number;

  @ApiProperty({ description: "Maximum number of friends a single driver can refer" })
  maxReferrals!: number;
}

export class UpdateReferralProgramSettingsBody {
  @ApiPropertyOptional({ description: "Reward amount in USD (must be >= 0)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  rewardAmount?: number;

  @ApiPropertyOptional({ description: "Required completed deliveries (must be >= 1)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  tripsRequired?: number;

  @ApiPropertyOptional({ description: "Days to complete the required trips (must be >= 1)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  daysToComplete?: number;

  @ApiPropertyOptional({ description: "Maximum referrals per driver (must be >= 1)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxReferrals?: number;
}