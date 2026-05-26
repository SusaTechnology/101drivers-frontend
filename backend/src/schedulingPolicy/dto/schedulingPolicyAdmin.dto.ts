import * as swagger from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const toBoolean = ({ value }: { value: any }) =>
  value === true || value === "true";

export class SchedulingPolicyAdminListQueryDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  active?: boolean;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerType?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceType?: string | null;
}

export class SchedulingPolicyAdminUpsertBodyDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerType?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceType?: string | null;

  @swagger.ApiProperty()
  @IsString()
  defaultMode!: string;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sameDayCutoffTime?: string | null;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : null))
  @IsInt()
  @Min(0)
  maxSameDayMiles?: number | null;

  @swagger.ApiProperty()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(1440)
  bufferMinutes!: number;

  @swagger.ApiProperty()
  @Transform(toBoolean)
  @IsBoolean()
  afterHoursEnabled!: boolean;

  @swagger.ApiProperty()
  @Transform(toBoolean)
  @IsBoolean()
  requiresOpsConfirmation!: boolean;

  @swagger.ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(toBoolean)
  active?: boolean;
}

export class SchedulingPolicyActionDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}