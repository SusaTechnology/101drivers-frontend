import * as swagger from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const toBoolean = ({ value }: { value: any }) =>
  value === true || value === "true";

const toNumberOrUndefined = ({ value }: { value: any }) =>
  value === "" || value === undefined || value === null ? undefined : Number(value);

export class OperatingHourAdminListQueryDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  active?: boolean;

  @swagger.ApiPropertyOptional({ description: "1=Mon ... 7=Sun" })
  @IsOptional()
  @Transform(toNumberOrUndefined)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;
}

export class OperatingHourAdminUpsertBodyDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string | null;

  @swagger.ApiProperty({ description: "1=Mon ... 7=Sun" })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

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

export class OperatingHourActionDto {
  @swagger.ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}