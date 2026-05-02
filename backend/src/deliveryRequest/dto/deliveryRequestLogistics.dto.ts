// src/deliveryRequest/dto/deliveryRequestLogistics.dto.ts

import * as swagger from "@nestjs/swagger";
import {
  EnumCustomerCustomerType,
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestCustomerChose,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";



export class IndividualQuotePreviewBody {
  @ApiProperty()
  pickupAddress!: string;

  @ApiProperty()
  dropoffAddress!: string;

  @ApiProperty({ enum: EnumDeliveryRequestServiceType })
  serviceType!: EnumDeliveryRequestServiceType;

  @swagger.ApiPropertyOptional()
  customerId?: string;
}

export class CreateIndividualDeliveryFromQuoteBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description: "Existing private customer id",
  })
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  customerEmail?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  customerName?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description: "Operational phone for individual flow",
  })
  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "Raw token from the email link; sent only on the second create-from-quote call",
  })
  @IsOptional()
  @IsString()
  otp?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "Password chosen by the customer; sent only on the second create-from-quote call",
  })
  @IsOptional()
  @IsString()
  password?: string | null;

  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  quoteId!: string;

  @swagger.ApiProperty({
    enum: EnumDeliveryRequestServiceType,
  })
  @IsEnum(EnumDeliveryRequestServiceType)
  serviceType!: EnumDeliveryRequestServiceType;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  savedVehicleId?: string | null;

  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  saveVehicleForFuture?: boolean;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowStart?: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowEnd?: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowStart?: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowEnd?: Date | null;

  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  licensePlate!: string;

  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  vehicleColor!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleMake?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleModel?: string | null;

  @swagger.ApiProperty({
    description: "Exactly 4 numeric digits",
  })
  @IsString()
  @IsNotEmpty()
  vinVerificationCode!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipientName?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipientPhone?: string | null;

  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  afterHours?: boolean;

  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
}

export class QuotePreviewBody {
  @swagger.ApiProperty()
  pickupAddress!: string;

  @swagger.ApiProperty()
  dropoffAddress!: string;

  @swagger.ApiProperty({
    enum: EnumDeliveryRequestServiceType,
  })
  serviceType!: EnumDeliveryRequestServiceType;
  @swagger.ApiProperty({
  required: false,
  nullable: true,
})
@IsOptional()
@IsString()
customerId?: string | null;

}

export class CreateDeliveryFromQuoteBody {
  @swagger.ApiProperty()
  customerId!: string;

  @swagger.ApiProperty()
  quoteId!: string;

  @swagger.ApiProperty({
    enum: EnumDeliveryRequestServiceType,
  })
  serviceType!: EnumDeliveryRequestServiceType;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  createdByUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryRequestCreatedByRole,
  })
  createdByRole?: EnumDeliveryRequestCreatedByRole | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryRequestCustomerChose,
  })
  customerChose?: EnumDeliveryRequestCustomerChose | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  pickupWindowStart!: Date;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  pickupWindowEnd!: Date;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  dropoffWindowStart!: Date;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  dropoffWindowEnd!: Date;

  @swagger.ApiProperty()
  licensePlate!: string;

  @swagger.ApiProperty()
  vehicleColor!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  vehicleMake?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  vehicleModel?: string | null;

  @swagger.ApiProperty({
    description: "Exactly 4 numeric digits",
  })
  vinVerificationCode!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  recipientName?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  recipientEmail?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  recipientPhone?: string | null;

  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  isUrgent?: boolean;

  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  afterHours?: boolean;
}

export class BookDeliveryBody {
  @ApiProperty({
    type: String,
  })
  driverId!: string;

  @ApiProperty({
    required: false,
    type: String,
    nullable: true,
  })
  bookedByUserId?: string | null;

  @ApiProperty({
    required: false,
    type: String,
    nullable: true,
  })
  reason?: string | null;
}

export class TransitionDeliveryStatusBody {
  @swagger.ApiProperty({
    enum: EnumDeliveryRequestStatus,
  })
  toStatus!: EnumDeliveryRequestStatus;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  actorUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryStatusHistoryActorRole,
  })
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;

  @swagger.ApiProperty({
    required: false,
    enum: EnumDeliveryStatusHistoryActorType,
    default: EnumDeliveryStatusHistoryActorType.USER,
  })
  actorType?: EnumDeliveryStatusHistoryActorType;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  note?: string | null;
}

export class StartTripBody {
  @swagger.ApiProperty({
    required: true,
  })
  driverId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  actorUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryStatusHistoryActorRole,
  })
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
}

export class CompleteTripBody {
  @swagger.ApiProperty({
    required: true,
  })
  driverId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  actorUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryStatusHistoryActorRole,
  })
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
}

export class AddTrackingPointBody {
  @swagger.ApiProperty()
  lat!: number;

  @swagger.ApiProperty()
  lng!: number;

  @swagger.ApiProperty({
    required: false,
    type: String,
    format: "date-time",
  })
  recordedAt?: Date;
}



export class RemovePickupPhotoBody {
  @swagger.ApiProperty({
    required: true,
  })
  driverId!: string;
}

export class DeliveryCompliancePhotoInput {
  @swagger.ApiProperty({
    required: true,
  })
  slotIndex!: number;

  @swagger.ApiProperty({
    required: true,
  })
  imageUrl!: string;
}



export class SubmitPickupComplianceBody {
  @swagger.ApiProperty({
    required: true,
  })
  driverId!: string;

  @swagger.ApiProperty({
    required: true,
  })
  vinVerificationCode!: string;

  @swagger.ApiProperty({
    required: true,
  })
  odometerStart!: number;

  @swagger.ApiProperty({
    required: true,
    type: [DeliveryCompliancePhotoInput],
  })
  photos!: DeliveryCompliancePhotoInput[];
}

export class SubmitDropoffComplianceBody {
  @swagger.ApiProperty({
    required: true,
  })
  driverId!: string;

  @swagger.ApiProperty({
    required: true,
  })
  odometerEnd!: number;

  @swagger.ApiProperty({
    required: true,
    type: [DeliveryCompliancePhotoInput],
  })
  photos!: DeliveryCompliancePhotoInput[];
}
export class CancelDeliveryBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  actorUserId?: string | null;

  @swagger.ApiProperty({
    required: true,
    enum: EnumDeliveryStatusHistoryActorRole,
  })
  actorRole!: EnumDeliveryStatusHistoryActorRole;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  note?: string | null;
}

export class SchedulePreviewBody {
  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  quoteId!: string;

  @swagger.ApiProperty({
    enum: EnumDeliveryRequestServiceType,
  })
  @IsEnum(EnumDeliveryRequestServiceType)
  serviceType!: EnumDeliveryRequestServiceType;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description: "Existing customer id for authenticated flows",
  })
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumCustomerCustomerType,
    description: "Customer type for public/pre-login flows",
  })
  @IsOptional()
  @IsEnum(EnumCustomerCustomerType)
  customerType?: EnumCustomerCustomerType | null;

  @swagger.ApiProperty({
    enum: EnumDeliveryRequestCustomerChose,
    description: "Which side the customer selected directly",
  })
  @IsEnum(EnumDeliveryRequestCustomerChose)
  customerChose!: EnumDeliveryRequestCustomerChose;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowStart?: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowEnd?: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowStart?: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowEnd?: Date | null;

  @swagger.ApiProperty({
    required: false,
    default: false,
    description:
      "Optional UI hint only; backend still decides actual after-hours status",
  })
  @IsOptional()
  @IsBoolean()
  afterHoursRequested?: boolean;

  @swagger.ApiProperty({
    type: String,
    format: "date",
    required: false,
    nullable: true,
    description:
      "User-selected date (YYYY-MM-DD). When provided, slots are generated for this date instead of today/tomorrow.",
  })
  @IsOptional()
  @IsDateString()
  preferredDate?: string | null;
}


export class SchedulePreviewSlotBody {
  @swagger.ApiProperty()
  label!: string;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  start!: Date;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  end!: Date;
}

export class SchedulePreviewPolicyBody {
  @swagger.ApiProperty()
  id!: string;

  @swagger.ApiProperty({
    nullable: true,
  })
  serviceType!: string | null;

  @swagger.ApiProperty()
  customerType!: string;

  @swagger.ApiProperty()
  defaultMode!: string;

  @swagger.ApiProperty({
    nullable: true,
  })
  sameDayCutoffTime!: string | null;

  @swagger.ApiProperty({
    nullable: true,
  })
  maxSameDayMiles!: number | null;

  @swagger.ApiProperty()
  bufferMinutes!: number;

  @swagger.ApiProperty()
  afterHoursEnabled!: boolean;

  @swagger.ApiProperty()
  requiresOpsConfirmation!: boolean;
}

export class SchedulePreviewSameDayBody {
  @swagger.ApiProperty()
  eligible!: boolean;

  @swagger.ApiProperty()
  status!: string;

  @swagger.ApiProperty({
    type: [String],
  })
  reasons!: string[];

  @swagger.ApiProperty({
    type: [String],
  })
  warnings!: string[];
}

export class SchedulePreviewMatchedSlotsBody {
  @swagger.ApiProperty({
    type: () => SchedulePreviewSlotBody,
    nullable: true,
  })
  pickup!: SchedulePreviewSlotBody | null;

  @swagger.ApiProperty({
    type: () => SchedulePreviewSlotBody,
    nullable: true,
  })
  dropoff!: SchedulePreviewSlotBody | null;
}

export class SchedulePreviewSuggestedSlotsBody {
  @swagger.ApiProperty({
    type: () => [SchedulePreviewSlotBody],
  })
  pickup!: SchedulePreviewSlotBody[];

  @swagger.ApiProperty({
    type: () => [SchedulePreviewSlotBody],
  })
  dropoff!: SchedulePreviewSlotBody[];
}

export class SchedulePreviewResponseBody {
  @swagger.ApiProperty()
  feasible!: boolean;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  message?: string | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
  })
  pickupWindowStart!: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
  })
  pickupWindowEnd!: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
  })
  dropoffWindowStart!: Date | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
  })
  dropoffWindowEnd!: Date | null;

  @swagger.ApiProperty({
    nullable: true,
  })
  etaMinutes!: number | null;

  @swagger.ApiProperty()
  bufferMinutes!: number;

  @swagger.ApiProperty()
  sameDayEligible!: boolean;

  @swagger.ApiProperty()
  requiresOpsConfirmation!: boolean;

  @swagger.ApiProperty()
  afterHours!: boolean;

  @swagger.ApiProperty({
    type: () => SchedulePreviewPolicyBody,
    nullable: true,
  })
  policy!: SchedulePreviewPolicyBody | null;

  @swagger.ApiProperty({
    type: () => SchedulePreviewSameDayBody,
  })
  sameDay!: SchedulePreviewSameDayBody;

  @swagger.ApiProperty({
    type: () => SchedulePreviewMatchedSlotsBody,
  })
  matchedSlots!: SchedulePreviewMatchedSlotsBody;

  @swagger.ApiProperty({
    type: () => SchedulePreviewSuggestedSlotsBody,
  })
  suggestedSlots!: SchedulePreviewSuggestedSlotsBody;
}

export class CancelDeliveryAdminBody {
  @swagger.ApiProperty()
  @IsString()
  reason!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class ReassignDeliveryAdminBody {
  @swagger.ApiProperty()
  @IsString()
  newDriverId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  reason?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}


export class AdminInvoicePostpaidBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  invoiceId?: string | null;

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

export class AdminMarkPostpaidPaidBody {
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

export class AdminMarkPayoutPaidBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  providerTransferId?: string | null;

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

export class DeliveryFinancialSummaryResponseBody {
  @swagger.ApiProperty()
  deliveryId!: string;

  @swagger.ApiProperty({
    nullable: true,
  })
  paymentId!: string | null;

  @swagger.ApiProperty({
    nullable: true,
  })
  payoutId!: string | null;

  @swagger.ApiProperty({
    nullable: true,
  })
  paymentType!: string | null;

  @swagger.ApiProperty({
    nullable: true,
  })
  paymentStatus!: string | null;

  @swagger.ApiProperty({
    nullable: true,
  })
  payoutStatus!: string | null;

  @swagger.ApiProperty({
    nullable: true,
  })
  grossAmount!: number | null;

  @swagger.ApiProperty()
  driverSharePct!: number;

  @swagger.ApiProperty()
  insuranceFee!: number;

  @swagger.ApiProperty()
  platformFee!: number;

  @swagger.ApiProperty()
  tipAmount!: number;

  @swagger.ApiProperty()
  netPayoutAmount!: number;

  @swagger.ApiProperty({
    nullable: true,
  })
  invoiceId!: string | null;
}


export class DriverLocationPingBody {
  @ApiProperty()
  lat!: number;

  @ApiProperty()
  lng!: number;

  @swagger.ApiPropertyOptional()
  recordedAt?: string;
}

export class CreateTrackingLinkBody {
  @swagger.ApiPropertyOptional({ default: 24 })
  expiresInHours?: number;
}

export class TrackingLinkResponseBody {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  trackingUrl!: string;
}
export class AdminDeliveryListQueryDto {
  @swagger.ApiProperty({ required: false, nullable: true })
  status?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true, format: "date-time" })
  from?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true, format: "date-time" })
  to?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  customerId?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  customerType?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  serviceType?: string | null;

  @swagger.ApiProperty({ required: false, default: false })
  urgentOnly?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  disputedOnly?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  requiresOpsConfirmation?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  withoutAssignment?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  complianceMissing?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  activeWithoutTracking?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  staleTracking?: boolean;

  @swagger.ApiProperty({ required: false, default: 1 })
  page?: number;

  @swagger.ApiProperty({ required: false, default: 20 })
  pageSize?: number;
}

export class AdminDeliveryListResponseDto {
  @swagger.ApiProperty({ type: [Object] })
  items!: any[];

  @swagger.ApiProperty()
  count!: number;

  @swagger.ApiProperty()
  page!: number;

  @swagger.ApiProperty()
  pageSize!: number;

  @swagger.ApiProperty({ type: Object })
  filtersApplied!: Record<string, any>;
}

export class AdminDeliveryDetailResponseDto {
  @swagger.ApiProperty({ type: Object })
  data!: any;
}

export class AssignDriverAdminBody {
  @swagger.ApiProperty()
  @IsString()
  driverId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  reason?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class ReassignDeliveryAdminPatchBody {
  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  newDriverId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  reason?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class ForceCancelDeliveryAdminBody {
  @swagger.ApiProperty({
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class OpenDisputeAdminBody {
  @swagger.ApiProperty({
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description: "Optional admin note/body for dispute creation",
  })
  @IsOptional()
  @IsString()
  note?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  legalHold?: boolean;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class LegalHoldAdminBody {
  @swagger.ApiProperty({
    required: true,
    description: "true to place on legal hold, false to remove",
  })
  @IsBoolean()
  legalHold!: boolean;

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
export class ApproveComplianceAdminBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;
}
export class CreateDeliveryDraftFromQuoteBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  quoteId!: string;

  @ApiProperty({
    enum: EnumDeliveryRequestServiceType,
  })
  @IsEnum(EnumDeliveryRequestServiceType)
  serviceType!: EnumDeliveryRequestServiceType;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  createdByUserId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryRequestCreatedByRole,
  })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestCreatedByRole)
  createdByRole?: EnumDeliveryRequestCreatedByRole | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryRequestCustomerChose,
  })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestCustomerChose)
  customerChose?: EnumDeliveryRequestCustomerChose | null;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowStart?: Date | null;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowEnd?: Date | null;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowStart?: Date | null;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowEnd?: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  licensePlate?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleColor?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleMake?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleModel?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vinVerificationCode?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipientName?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipientPhone?: string | null;

  @ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  afterHours?: boolean;

  @ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
}

export class CreateIndividualDeliveryDraftFromQuoteBody {
  @ApiProperty({
    required: false,
    nullable: true,
    description: "Existing private customer id",
  })
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  customerEmail?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  customerName?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  quoteId!: string;

  @ApiProperty({
    enum: EnumDeliveryRequestServiceType,
  })
  @IsEnum(EnumDeliveryRequestServiceType)
  serviceType!: EnumDeliveryRequestServiceType;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  savedVehicleId?: string | null;

  @ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  saveVehicleForFuture?: boolean;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowStart?: Date | null;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  pickupWindowEnd?: Date | null;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowStart?: Date | null;

  @ApiProperty({
    type: String,
    format: "date-time",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  dropoffWindowEnd?: Date | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  licensePlate?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleColor?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleMake?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vehicleModel?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  vinVerificationCode?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipientName?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipientPhone?: string | null;

  @ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  afterHours?: boolean;

  @ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
}


// ── GPS Proximity Check ──

export class CheckPickupProximityBody {
  @swagger.ApiProperty({ required: true })
  @IsNotEmpty()
  @IsNumber()
  driverLat!: number;

  @swagger.ApiProperty({ required: true })
  @IsNotEmpty()
  @IsNumber()
  driverLng!: number;
}

export class CheckPickupProximityResponseBody {
  @swagger.ApiProperty()
  withinRadius!: boolean;

  @swagger.ApiProperty()
  distanceMeters!: number;
}
