import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
  EnumDisputeCaseStatus,
  EnumDriverPayoutStatus,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
} from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class BaseReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ enum: ["json", "csv", "xlsx", "pdf"] })
  @IsOptional()
  @IsIn(["json", "csv", "xlsx", "pdf"])
  format: "json" | "csv" | "xlsx" | "pdf" = "json";

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize = 25;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "desc";
}

export class DeliveriesReportQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({ enum: EnumDeliveryRequestStatus })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestStatus)
  status?: EnumDeliveryRequestStatus;

  @ApiPropertyOptional({ enum: EnumDeliveryRequestServiceType })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestServiceType)
  serviceType?: EnumDeliveryRequestServiceType;

  @ApiPropertyOptional({ enum: EnumDeliveryRequestCreatedByRole })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestCreatedByRole)
  createdByRole?: EnumDeliveryRequestCreatedByRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isUrgent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  requiresOpsConfirmation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  disputedOnly?: boolean;
}

export class ComplianceReportQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({ enum: EnumDeliveryRequestStatus })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestStatus)
  status?: EnumDeliveryRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  verifiedOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  missingOnly?: boolean;
}

export class DisputesReportQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({ enum: EnumDisputeCaseStatus })
  @IsOptional()
  @IsEnum(EnumDisputeCaseStatus)
  status?: EnumDisputeCaseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  legalHold?: boolean;
}

export class PaymentsReportQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({ enum: EnumPaymentStatus })
  @IsOptional()
  @IsEnum(EnumPaymentStatus)
  status?: EnumPaymentStatus;

  @ApiPropertyOptional({ enum: EnumPaymentPaymentType })
  @IsOptional()
  @IsEnum(EnumPaymentPaymentType)
  paymentType?: EnumPaymentPaymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  prepaidOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  postpaidOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  failedOnly?: boolean;
}

export class PayoutsReportQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({ enum: EnumDriverPayoutStatus })
  @IsOptional()
  @IsEnum(EnumDriverPayoutStatus)
  status?: EnumDriverPayoutStatus;
}

export class InsuranceMileageReportQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({ enum: ["week", "month"] })
  @IsOptional()
  @IsIn(["week", "month"])
  groupBy: "week" | "month" = "month";

  @ApiPropertyOptional({ enum: EnumDeliveryRequestServiceType })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestServiceType)
  serviceType?: EnumDeliveryRequestServiceType;
}