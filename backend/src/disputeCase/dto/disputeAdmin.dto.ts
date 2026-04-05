import * as swagger from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { EnumDisputeCaseStatus } from "@prisma/client";

export class OpenDisputeBody {
  @swagger.ApiProperty()
  @IsString()
  deliveryId!: string;

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

export class AddDisputeNoteBody {
  @swagger.ApiProperty()
  @IsString()
  note!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
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

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class ResolveDisputeBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  resolutionNote?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
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

  @swagger.ApiProperty({
    required: false,
    nullable: true,
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

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}
