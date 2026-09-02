import * as swagger from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { EnumDisputeCaseStatus } from "@prisma/client";

export class OpenDisputeBody {
  @swagger.ApiProperty()
  @IsString()
  deliveryId!: string;

  @swagger.ApiProperty()
  @IsString()
  reason!: string;

  /**
   * @deprecated — actorUserId is sourced from the JWT via @UserData()
   * in the controller. This field is kept only for backward-compat
   * with older API clients and is intentionally IGNORED on the server.
   * Including it in the request body has no effect.
   */
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    deprecated: true,
    description:
      "DEPRECATED. Sourced from JWT on the server. Ignored if present.",
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class AddDisputeNoteBody {
  @swagger.ApiProperty()
  @IsString()
  note!: string;

  /** @deprecated — sourced from JWT. See OpenDisputeBody.actorUserId. */
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class UpdateDisputeStatusBody {
  @swagger.ApiProperty({
    enum: EnumDisputeCaseStatus,
  })
  @IsEnum(EnumDisputeCaseStatus)
  status!: EnumDisputeCaseStatus;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;

  /** @deprecated — sourced from JWT. See OpenDisputeBody.actorUserId. */
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

/**
 * Resolve a dispute — when approveRefund is true, the engine issues a
 * Stripe refund (full or partial) for the delivery's payment and
 * records the refund ID on the dispute.
 */
export class ResolveDisputeBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description: "Optional note explaining the resolution.",
  })
  @IsOptional()
  @IsString()
  resolutionNote?: string | null;

  @swagger.ApiProperty({
    description:
      "Whether to issue a refund. true = approve refund (customer wins). " +
      "false = resolve without refund (driver wins). The admin-reject " +
      "endpoint is the preferred way to reject a dispute — use this only " +
      "when the admin wants to mark RESOLVED without a refund but the " +
      "dispute isn't being rejected outright.",
  })
  @IsBoolean()
  approveRefund!: boolean;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description:
      "Optional partial refund amount in USD (dollars, not cents). " +
      "Omit for a full refund. Only used when approveRefund=true.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  refundAmount?: number | null;

  /** @deprecated — sourced from JWT. See OpenDisputeBody.actorUserId. */
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

/**
 * Reject a dispute — the admin decides the dispute has no merit.
 * Sets status to REJECTED (distinct from RESOLVED which means
 * "resolved in customer's favor with refund"). rejectionReason
 * is required so the customer can be told why.
 */
export class RejectDisputeBody {
  @swagger.ApiProperty({
    description:
      "Required reason the dispute is being rejected. Will be included " +
      "in the customer notification email.",
  })
  @IsString()
  rejectionReason!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    description: "Optional additional internal note (not shared with customer).",
  })
  @IsOptional()
  @IsString()
  note?: string | null;

  /** @deprecated — sourced from JWT. See OpenDisputeBody.actorUserId. */
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class CloseDisputeBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  closingNote?: string | null;

  /** @deprecated — sourced from JWT. See OpenDisputeBody.actorUserId. */
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class ToggleLegalHoldBody {
  @swagger.ApiProperty()
  @IsBoolean()
  legalHold!: boolean;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;

  /** @deprecated — sourced from JWT. See OpenDisputeBody.actorUserId. */
  @swagger.ApiProperty({
    required: false,
    nullable: true,
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}
