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
  IsNumber,
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

  @swagger.ApiProperty({
    required: false,
    type: Boolean,
    description:
      "Customer attestation that the vehicle is under 12 years old, under 120k miles, and under $75k value. Required for new deliveries created on or after the feature ship date; legacy drafts may omit it.",
  })
  @IsOptional()
  @IsBoolean()
  vehicleStandardsConfirmed?: boolean;
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

  @swagger.ApiProperty({
    required: false,
    type: Boolean,
    description:
      "Customer attestation that the vehicle is under 12 years old, under 120k miles, and under $75k value. Required for new deliveries created on or after the feature ship date; legacy drafts may omit it.",
  })
  vehicleStandardsConfirmed?: boolean;
}

/**
 * Body for `POST /deliveryRequests/:id/promote` — promote an existing DRAFT
 * delivery to a real LISTED delivery in-place (UPDATE rather than
 * create-new-and-delete-draft).
 *
 * `customerId` and `serviceType` are omitted because they come from the
 * existing DRAFT row itself. `quoteId` is OPTIONAL: if the DRAFT was saved
 * without a quote (allowed by the save-as-draft flow), the dealer must
 * calculate one before promoting — the frontend passes it here so the
 * backend can attach it to the row during the same UPDATE that flips
 * status DRAFT→LISTED. If the DRAFT already has a quoteId, `input.quoteId`
 * takes precedence (handles the case where the dealer re-calculated the
 * quote after the draft was last saved).
 */
export class PromoteDraftBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "Optional quoteId. Required when the DRAFT has no quoteId attached (e.g. drafts saved before a quote was calculated). Ignored if the DRAFT already has a quoteId AND this field matches it. Takes precedence over the DRAFT's stored quoteId when both are set and differ (e.g. dealer re-calculated the quote).",
  })
  @IsOptional()
  @IsString()
  quoteId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  createdByUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryRequestCreatedByRole,
  })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestCreatedByRole)
  createdByRole?: EnumDeliveryRequestCreatedByRole | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryRequestCustomerChose,
  })
  @IsOptional()
  @IsEnum(EnumDeliveryRequestCustomerChose)
  customerChose?: EnumDeliveryRequestCustomerChose | null;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  @IsDateString()
  pickupWindowStart!: Date;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  @IsDateString()
  pickupWindowEnd!: Date;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  @IsDateString()
  dropoffWindowStart!: Date;

  @swagger.ApiProperty({
    type: String,
    format: "date-time",
  })
  @IsDateString()
  dropoffWindowEnd!: Date;

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
  isUrgent?: boolean;

  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  afterHours?: boolean;

  @swagger.ApiProperty({
    required: false,
    type: Boolean,
    description:
      "Customer attestation that the vehicle is under 12 years old, under 120k miles, and under $75k value. Required for new deliveries created on or after the feature ship date; legacy drafts may omit it.",
  })
  @IsOptional()
  @IsBoolean()
  vehicleStandardsConfirmed?: boolean;
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

  @ApiProperty({
    required: false,
    type: Number,
    nullable: true,
  })
  driverLat?: number | null;

  @ApiProperty({
    required: false,
    type: Number,
    nullable: true,
  })
  driverLng?: number | null;
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

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "URL of the dashboard/touchscreen photo showing fuel gauge or battery charge level. Captured by the driver app and persisted as a DASHBOARD_PHOTO evidence row so dealers and admins can view it.",
  })
  dashboardPhotoUrl?: string | null;
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

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "URL of the dashboard/touchscreen photo taken at drop-off showing fuel gauge or battery charge level. Persisted as a DASHBOARD_PHOTO evidence row (phase=DROPOFF) so dealers and admins can view it.",
  })
  dashboardPhotoUrl?: string | null;
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

  @swagger.ApiProperty({
    type: String,
    format: "date",
    required: false,
    nullable: true,
    description: "Actual date of returned slots in business timezone (YYYY-MM-DD). May differ from preferredDate when today's slots have all passed.",
  })
  actualSlotDate!: string | null;
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

  @swagger.ApiProperty({
    required: false,
    default: false,
    description:
      "Whether to apply the $48 close penalty fee to the customer and pay it to the driver. " +
      "Admin should call GET /api/deliveryRequests/:id/close-penalty-preview first to see " +
      "whether a driver has committed (status is BOOKED or ACTIVE). Default: false (admin " +
      "must explicitly opt in — penalty is NOT auto-applied on admin cancel).",
  })
  @IsOptional()
  @IsBoolean()
  applyPenalty?: boolean;
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

  @swagger.ApiProperty({
    required: false,
    default: false,
    description:
      "Whether to apply the $48 close penalty fee to the customer and pay it to the driver. " +
      "Admin should call GET /api/deliveryRequests/:id/close-penalty-preview first to see " +
      "whether a driver has committed (status is BOOKED or ACTIVE). Default: false (admin " +
      "must explicitly opt in — penalty is NOT auto-applied on admin force-cancel).",
  })
  @IsOptional()
  @IsBoolean()
  applyPenalty?: boolean;
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

  // quoteId is OPTIONAL — dealers can save a draft before calculating a quote.
  // When omitted, address fields (pickupAddress, dropoffAddress, etc.) must be
  // provided directly in the payload.
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  quoteId?: string | null;

  // ── Address fields (used when quoteId is NOT provided) ──
  // When quoteId IS provided, these are ignored and the quote's address
  // fields are used instead (existing behavior).
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  pickupAddress?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  pickupLat?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  pickupLng?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  pickupPlaceId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  pickupState?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  dropoffAddress?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  dropoffLat?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  dropoffLng?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  dropoffPlaceId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  dropoffState?: string | null;

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

  @ApiProperty({
    required: false,
    type: Boolean,
    description:
      "Customer attestation that the vehicle is under 12 years old, under 120k miles, and under $75k value. Optional for drafts (the attestation is captured when the draft is promoted to a real delivery).",
  })
  @IsOptional()
  @IsBoolean()
  vehicleStandardsConfirmed?: boolean;
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

  @ApiProperty({
    required: false,
    type: Boolean,
    description:
      "Customer attestation that the vehicle is under 12 years old, under 120k miles, and under $75k value. Optional for drafts.",
  })
  @IsOptional()
  @IsBoolean()
  vehicleStandardsConfirmed?: boolean;
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

export class VerifyPickupPinBody {
  @swagger.ApiProperty({
    required: true,
    description: "The 4-digit PIN to verify",
  })
  @IsString()
  @IsNotEmpty()
  pin!: string;
}

export class VerifyPickupPinResponseBody {
  @swagger.ApiProperty()
  valid!: boolean;
}

// ── VIN Verification (pickup checklist Step 5) ──
// Mirrors VerifyPickupPinBody but for the last-4 VIN digits stored on the
// delivery request as `vinVerificationCode`. Used by the driver pickup
// checklist page to give instant inline feedback before the full
// /pickup-compliance payload is submitted.

export class VerifyVinBody {
  @swagger.ApiProperty({
    required: true,
    description: "The last 4 digits of the VIN to verify",
  })
  @IsString()
  @IsNotEmpty()
  vin!: string;
}

export class VerifyVinResponseBody {
  @swagger.ApiProperty()
  valid!: boolean;
}

/**
 * Body for POST /api/deliveryRequests/:id/edit-pricing
 *
 * Allows a dealer to edit the pricing/addresses of a delivery that is in
 * DRAFT, LISTED, or EXPIRED status. Other statuses are blocked.
 *
 * The caller must first generate a new quote via POST /api/deliveryRequests/quote-preview
 * with the new addresses, then pass that quote's id here.
 *
 * Stripe reconciliation is handled automatically:
 *  - PREPAID + price changed on LISTED/EXPIRED → new PI created, old PI cancelled
 *  - POSTPAID → just updates Payment.amount in DB
 *  - Price unchanged → no Stripe call
 *  - EXPIRED → reactivates the delivery (EXPIRED → QUOTED → LISTED)
 */
export class EditDeliveryPricingBody {
  @swagger.ApiProperty({
    description:
      "ID of the new Quote to attach. Generate one first via POST /api/deliveryRequests/quote-preview with the new addresses.",
  })
  @IsString()
  @IsNotEmpty()
  newQuoteId!: string;

  @swagger.ApiProperty({
    description:
      "Human-readable reason for the edit (required for audit trail). e.g. 'Customer changed pickup address from X to Y after listing.'",
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryStatusHistoryActorRole,
    description:
      "Role of the user initiating the edit. Defaults to BUSINESS_CUSTOMER if omitted.",
  })
  @IsOptional()
  @IsEnum(EnumDeliveryStatusHistoryActorRole)
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;

  @swagger.ApiProperty({
    required: false,
    default: true,
    description:
      "When status is EXPIRED, re-list the delivery after editing (EXPIRED → QUOTED → LISTED). Set to false to edit fields while keeping status EXPIRED.",
  })
  @IsOptional()
  @IsBoolean()
  reactivateIfExpired?: boolean;
}

export class EditDeliveryPricingResponseDto {
  @swagger.ApiProperty()
  deliveryId!: string;

  @swagger.ApiProperty({ enum: EnumDeliveryRequestStatus })
  status!: EnumDeliveryRequestStatus;

  @swagger.ApiProperty({ nullable: true })
  oldQuoteId!: string | null;

  @swagger.ApiProperty()
  newQuoteId!: string;

  @swagger.ApiProperty({ nullable: true })
  oldPrice!: number | null;

  @swagger.ApiProperty()
  newPrice!: number;

  @swagger.ApiProperty({ nullable: true })
  oldPaymentIntentId!: string | null;

  @swagger.ApiProperty({ nullable: true })
  newPaymentIntentId!: string | null;

  @swagger.ApiProperty()
  priceChanged!: boolean;

  @swagger.ApiProperty({
    enum: ["none", "reauthorized", "skipped_postpaid", "skipped_no_payment"],
  })
  stripeAction!: string;

  @swagger.ApiProperty()
  reactivated!: boolean;
}

/**
 * Body for `POST /api/deliveryRequests/:id/edit-pricing/preview`.
 *
 * This is the read-only companion to /edit-pricing. It computes the price
 * delta, determines whether the actual edit would trigger a Stripe
 * reauthorization, and returns a user-facing headline + body the frontend
 * can render in a confirmation dialog.
 *
 * Importantly, this endpoint NEVER throws PricingEditException for
 * non-editable statuses — it returns `editable: false` + `notEditableReason`
 * instead, so the frontend can render the dialog with a disabled submit
 * button (better UX than a hard error).
 */
export class PreviewEditDeliveryPricingBody {
  @swagger.ApiProperty({
    description:
      "ID of the new Quote to preview. Generate one first via POST /api/deliveryRequests/quote-preview with the new addresses.",
  })
  @IsString()
  @IsNotEmpty()
  newQuoteId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumDeliveryStatusHistoryActorRole,
    description:
      "Role of the user initiating the preview. ADMIN can preview edits on terminal-state deliveries (CANCELLED/DISPUTED/CLOSED/COMPLETED) — other roles will see editable:false for those statuses.",
  })
  @IsOptional()
  @IsEnum(EnumDeliveryStatusHistoryActorRole)
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;

  @swagger.ApiProperty({
    required: false,
    default: true,
    description:
      "When status is EXPIRED, indicates whether the actual edit would re-list the delivery. Mirrors the same flag on EditDeliveryPricingBody.",
  })
  @IsOptional()
  @IsBoolean()
  reactivateIfExpired?: boolean;
}

/**
 * Response for `POST /api/deliveryRequests/:id/edit-pricing/preview`.
 *
 * All fields are populated by DeliveryPricingEditEngine.previewPricingEdit()
 * and are designed to drive a frontend confirmation dialog WITHOUT requiring
 * the frontend to re-implement delta math or message phrasing.
 */
export class PreviewEditDeliveryPricingResponseDto {
  @swagger.ApiProperty()
  deliveryId!: string;

  @swagger.ApiProperty({ enum: EnumDeliveryRequestStatus })
  status!: EnumDeliveryRequestStatus;

  @swagger.ApiProperty({
    description:
      "True if the dealer (or admin) is allowed to edit this delivery in its current status.",
  })
  editable!: boolean;

  @swagger.ApiProperty({
    required: false,
    description:
      "When editable is false, a machine-readable reason ('driver_accepted' | 'terminal_state' | 'unknown') for the frontend to switch on.",
  })
  notEditableReason?: string;

  @swagger.ApiProperty({
    description:
      "True if the caller is an admin previewing an edit on a terminal-state delivery.",
  })
  isAdminOverride!: boolean;

  @swagger.ApiProperty({ nullable: true })
  oldQuoteId!: string | null;

  @swagger.ApiProperty()
  newQuoteId!: string;

  @swagger.ApiProperty({ nullable: true })
  oldPrice!: number | null;

  @swagger.ApiProperty()
  newPrice!: number;

  @swagger.ApiProperty({
    description: "newPrice - oldPrice in dollars. Positive = increase, negative = decrease, 0 = unchanged.",
  })
  priceDelta!: number;

  @swagger.ApiProperty({
    enum: ["increase", "decrease", "unchanged"],
  })
  priceDirection!: string;

  @swagger.ApiProperty({
    enum: ["none", "reauthorized", "skipped_postpaid", "skipped_no_payment"],
    description:
      "What the engine WILL do on the actual edit call. 'reauthorized' = new PI created + old PI cancelled.",
  })
  expectedStripeAction!: string;

  @swagger.ApiProperty({
    description:
      "User-facing headline — e.g. 'Your new price is higher'. Render this as the dialog title.",
  })
  headline!: string;

  @swagger.ApiProperty({
    description:
      "User-facing body explaining the charge/release in plain English with the delta in brackets. Render this as the dialog description.",
  })
  body!: string;

  @swagger.ApiProperty()
  willReactivate!: boolean;

  @swagger.ApiProperty()
  oldPickupAddress!: string;

  @swagger.ApiProperty()
  newPickupAddress!: string;

  @swagger.ApiProperty()
  oldDropoffAddress!: string;

  @swagger.ApiProperty()
  newDropoffAddress!: string;

  @swagger.ApiProperty()
  isPostpaid!: boolean;

  @swagger.ApiProperty()
  hasPayment!: boolean;
}
