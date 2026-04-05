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
