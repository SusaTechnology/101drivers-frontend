// src/scheduleChangeRequest/dto/scheduleChangeWorkflow.dto.ts

import * as swagger from "@nestjs/swagger";
import { EnumScheduleChangeRequestRequestedByRole } from "@prisma/client";

export class RequestScheduleChangeBody {
  @swagger.ApiProperty()
  deliveryId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  requestedByUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumScheduleChangeRequestRequestedByRole,
  })
  requestedByRole?: EnumScheduleChangeRequestRequestedByRole | null;

  @swagger.ApiProperty({
    required: false,
    type: String,
    format: "date-time",
    nullable: true,
  })
  proposedPickupWindowStart?: Date | null;

  @swagger.ApiProperty({
    required: false,
    type: String,
    format: "date-time",
    nullable: true,
  })
  proposedPickupWindowEnd?: Date | null;

  @swagger.ApiProperty({
    required: false,
    type: String,
    format: "date-time",
    nullable: true,
  })
  proposedDropoffWindowStart?: Date | null;

  @swagger.ApiProperty({
    required: false,
    type: String,
    format: "date-time",
    nullable: true,
  })
  proposedDropoffWindowEnd?: Date | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  reason?: string | null;
}

export class ApproveScheduleChangeBody {
  @swagger.ApiProperty()
  decidedByUserId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  decisionNote?: string | null;
}

export class DeclineScheduleChangeBody {
  @swagger.ApiProperty()
  decidedByUserId!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  decisionNote?: string | null;
}

export class CancelScheduleChangeBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  actorUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
    enum: EnumScheduleChangeRequestRequestedByRole,
  })
  actorRole?: EnumScheduleChangeRequestRequestedByRole | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  note?: string | null;
}