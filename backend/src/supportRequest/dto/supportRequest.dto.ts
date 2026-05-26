import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import {
  EnumSupportActorRole,
  EnumSupportCategory,
  EnumSupportPriority,
  EnumSupportStatus,
} from "@prisma/client";

export class CreateSupportRequestBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  deliveryId?: string | null;

  @swagger.ApiProperty({
    enum: EnumSupportActorRole,
  })
  @IsEnum(EnumSupportActorRole)
  actorRole!: EnumSupportActorRole;

  @swagger.ApiProperty({
    enum: EnumSupportCategory,
  })
  @IsEnum(EnumSupportCategory)
  category!: EnumSupportCategory;

  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportPriority,
    default: EnumSupportPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(EnumSupportPriority)
  priority?: EnumSupportPriority;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  subject?: string | null;

  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class ReplySupportRequestBody {
  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class AddInternalSupportNoteBody {
  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class AssignSupportRequestBody {
  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  assignedToUserId!: string;
}

export class ChangeSupportRequestStatusBody {
  @swagger.ApiProperty({
    enum: EnumSupportStatus,
  })
  @IsEnum(EnumSupportStatus)
  status!: EnumSupportStatus;
}

export class MySupportRequestListQueryDto {
  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportStatus,
  })
  @IsOptional()
  @IsEnum(EnumSupportStatus)
  status?: EnumSupportStatus;

  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportCategory,
  })
  @IsOptional()
  @IsEnum(EnumSupportCategory)
  category?: EnumSupportCategory;

  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportPriority,
  })
  @IsOptional()
  @IsEnum(EnumSupportPriority)
  priority?: EnumSupportPriority;

  @swagger.ApiProperty({
    required: false,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  take?: number;

  @swagger.ApiProperty({
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  skip?: number;
}

export class AdminSupportRequestListQueryDto {
  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportStatus,
  })
  @IsOptional()
  @IsEnum(EnumSupportStatus)
  status?: EnumSupportStatus;

  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportCategory,
  })
  @IsOptional()
  @IsEnum(EnumSupportCategory)
  category?: EnumSupportCategory;

  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportPriority,
  })
  @IsOptional()
  @IsEnum(EnumSupportPriority)
  priority?: EnumSupportPriority;

  @swagger.ApiProperty({
    required: false,
    enum: EnumSupportActorRole,
  })
  @IsOptional()
  @IsEnum(EnumSupportActorRole)
  actorRole?: EnumSupportActorRole;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  deliveryId?: string;

  @swagger.ApiProperty({
    required: false,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  take?: number;

  @swagger.ApiProperty({
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  skip?: number;
}

export class SupportRequestListResponseDto {
  @swagger.ApiProperty({ type: [Object] })
  items!: any[];

  @swagger.ApiProperty()
  count!: number;
}