import * as swagger from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

const toBoolean = ({ value }: { value: any }) =>
  value === true || value === "true";

export class TimeSlotTemplateAdminListQueryDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  active?: boolean;

  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}

export class TimeSlotTemplateAdminUpsertBodyDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string | null;

  @swagger.ApiProperty()
  @IsString()
  label!: string;

  @swagger.ApiProperty()
  @IsString()
  startTime!: string;

  @swagger.ApiProperty()
  @IsString()
  endTime!: string;

  @swagger.ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}

export class TimeSlotTemplateActionDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}