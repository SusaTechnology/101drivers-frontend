import * as swagger from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  EnumPricingCategoryRuleCategory,
  EnumPricingConfigPricingMode,
  EnumCustomerPricingModeOverride,
  EnumQuoteMileageCategory,
  EnumQuoteServiceType,
} from "@prisma/client";

export class PricingTierInputDto {
  @swagger.ApiProperty()
  @IsNumber()
  @Min(0)
  minMiles!: number;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxMiles?: number | null;

  @swagger.ApiProperty()
  @IsNumber()
  @Min(0)
  flatPrice!: number;
}

export class PricingCategoryRuleInputDto {
  @swagger.ApiProperty({
    enum: EnumPricingCategoryRuleCategory,
  })
  @IsEnum(EnumPricingCategoryRuleCategory)
  category!: EnumPricingCategoryRuleCategory;

  @swagger.ApiProperty()
  @IsNumber()
  @Min(0)
  minMiles!: number;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxMiles?: number | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFee?: number | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perMileRate?: number | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatPrice?: number | null;
}

export class SavePricingConfigBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description: "If provided, update existing PricingConfig. Otherwise create.",
  })
  @IsOptional()
  @IsString()
  id?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  name?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @swagger.ApiProperty({
    enum: EnumPricingConfigPricingMode,
  })
  @IsEnum(EnumPricingConfigPricingMode)
  pricingMode!: EnumPricingConfigPricingMode;

  @swagger.ApiProperty()
  @IsNumber()
  @Min(0)
  baseFee!: number;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "PER_MILE only. Free miles included in the base fee. NULL or 0 = charge per-mile from mile 0. " +
      "Example: flatMiles=50 means miles 0-50 are covered by baseFee; miles 51+ are billed at perMileRate.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatMiles?: number | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perMileRate?: number | null;

  @swagger.ApiProperty()
  @IsNumber()
  @Min(0)
  insuranceFee!: number;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transactionFeePct?: number | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transactionFeeFixed?: number | null;

  @swagger.ApiProperty()
  @IsBoolean()
  feePassThrough!: boolean;

  @swagger.ApiProperty()
  @IsNumber()
  @Min(0)
  driverSharePct!: number;

  @swagger.ApiProperty({
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  activateAsDefault?: boolean;

  @swagger.ApiProperty({
    type: [PricingTierInputDto],
    required: false,
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingTierInputDto)
  tiers?: PricingTierInputDto[];

  @swagger.ApiProperty({
    type: [PricingCategoryRuleInputDto],
    required: false,
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingCategoryRuleInputDto)
  categoryRules?: PricingCategoryRuleInputDto[];

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class AssignCustomerPricingBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  pricingConfigId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumCustomerPricingModeOverride,
  })
  @IsOptional()
  @IsEnum(EnumCustomerPricingModeOverride)
  pricingModeOverride?: EnumCustomerPricingModeOverride | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  postpaidEnabled?: boolean | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class SetDefaultPricingConfigBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "Admin user ID triggering the change, for the audit log. " +
      "Optional — the controller falls back to null if absent.",
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class PreviewQuoteBody {
  @swagger.ApiProperty({
    description:
      "ID of the saved PricingConfig to preview against. The config must " +
      "already exist (use admin-save first if you're previewing unsaved form state).",
  })
  @IsString()
  pricingConfigId!: string;

  @swagger.ApiProperty({
    description: "Distance in miles. Must be >= 0.",
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  distanceMiles!: number;

  @swagger.ApiProperty({
    enum: EnumQuoteServiceType,
    description:
      "Service type for the preview. Currently used for snapshot/audit " +
      "purposes only — it does not affect the price math (no service-type " +
      "surcharges exist yet). Required so the snapshot matches what a real " +
      "Quote row would store.",
  })
  @IsEnum(EnumQuoteServiceType)
  serviceType!: EnumQuoteServiceType;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumQuoteMileageCategory,
    description:
      "Force a specific mileage category (A/B/C) regardless of distance. " +
      "Only affects CATEGORY_ABC configs. Lets an admin preview " +
      "'what would category C cost at 50 miles?' without changing the " +
      "distance input. Ignored for PER_MILE / FLAT_TIER modes.",
  })
  @IsOptional()
  @IsEnum(EnumQuoteMileageCategory)
  categoryOverride?: EnumQuoteMileageCategory | null;
}
