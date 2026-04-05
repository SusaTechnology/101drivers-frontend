import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";
import {
  EnumCustomerCustomerType,
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
} from "@prisma/client";

export enum EnumAdminDashboardDatePreset {
  TODAY = "TODAY",
  LAST_7_DAYS = "LAST_7_DAYS",
  LAST_30_DAYS = "LAST_30_DAYS",
  THIS_MONTH = "THIS_MONTH",
  CUSTOM = "CUSTOM",
}

export enum EnumAdminDashboardActionType {
  NAVIGATE = "NAVIGATE",
}

export enum EnumAdminDashboardAttentionType {
  DELIVERY_COMPLIANCE_MISSING = "DELIVERY_COMPLIANCE_MISSING",
  DEALER_APPROVAL_PENDING = "DEALER_APPROVAL_PENDING",
  DRIVER_APPROVAL_PENDING = "DRIVER_APPROVAL_PENDING",
  LISTED_WITHOUT_ASSIGNMENT = "LISTED_WITHOUT_ASSIGNMENT",
  OPS_CONFIRMATION_REQUIRED = "OPS_CONFIRMATION_REQUIRED",
  PAYOUT_ELIGIBLE = "PAYOUT_ELIGIBLE",
  OPEN_DISPUTE = "OPEN_DISPUTE",
  ACTIVE_WITHOUT_TRACKING = "ACTIVE_WITHOUT_TRACKING",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  STALE_TRACKING = "STALE_TRACKING",
}

export enum EnumAdminDashboardAlertSeverity {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
}

export class AdminDashboardOverviewQuery {
  @ApiPropertyOptional({ enum: EnumAdminDashboardDatePreset })
  @IsOptional()
  @IsEnum(EnumAdminDashboardDatePreset)
  datePreset?: EnumAdminDashboardDatePreset;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ enum: EnumDeliveryRequestStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(EnumDeliveryRequestStatus, { each: true })
  statuses?: EnumDeliveryRequestStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: EnumCustomerCustomerType })
  @IsOptional()
  @IsEnum(EnumCustomerCustomerType)
  customerType?: EnumCustomerCustomerType;

  @ApiPropertyOptional({ enum: EnumDeliveryRequestCreatedByRole })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestCreatedByRole)
  createdByRole?: EnumDeliveryRequestCreatedByRole;

  @ApiPropertyOptional({ enum: EnumDeliveryRequestServiceType })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestServiceType)
  serviceType?: EnumDeliveryRequestServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresOpsConfirmation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  urgentOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  disputedOnly?: boolean;
}

export class AdminDashboardActionDto {
  @ApiProperty({ enum: EnumAdminDashboardActionType })
  type!: EnumAdminDashboardActionType;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  target!: string;

  @ApiPropertyOptional({ type: Object })
  filters?: Record<string, unknown> | null;
}

export class AdminDashboardOverviewResponseDto {
  @ApiProperty({ type: Object })
  filtersApplied!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  summaryCards!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  summary!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  pipeline!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  finance!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  financialSnapshot!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  operations!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  alerts!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  activeDeliveries!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  liveTrackingOverview!: Record<string, unknown>;

  @ApiProperty({ type: Array })
  needsAttention!: unknown[];

  @ApiProperty({ type: Object })
  driverOperations!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  dealerActivity!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  pricingSnapshot!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  schedulingPolicy!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  actorSummary!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  deliveryBreakdowns!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  reportsPreview!: Record<string, unknown>;

  @ApiProperty({ type: Array })
  quickActions!: AdminDashboardActionDto[];

  @ApiProperty({ type: Object })
  recent!: Record<string, unknown>;
}