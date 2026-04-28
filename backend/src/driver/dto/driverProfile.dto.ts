import * as swagger from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ArrayUnique,
} from "class-validator";
import { Type } from "class-transformer";

export class DriverProfilePreferenceInput {
  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  city?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radiusMiles?: number | null;
}

export class DriverProfileAlertsInput {
  @swagger.ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @swagger.ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;
}

export class DriverProfileLocationInput {
  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  homeBaseLat?: number | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  homeBaseLng?: number | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  homeBaseCity?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  homeBaseState?: string | null;
}

export class UpdateDriverProfileBody {
  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl()
  profilePhotoUrl?: string | null;

  @swagger.ApiProperty({ required: false, type: () => DriverProfilePreferenceInput })
  @IsOptional()
  preferences?: DriverProfilePreferenceInput;

  @swagger.ApiProperty({ required: false, type: () => DriverProfileAlertsInput })
  @IsOptional()
  alerts?: DriverProfileAlertsInput;

  @swagger.ApiProperty({ required: false, type: () => DriverProfileLocationInput })
  @IsOptional()
  location?: DriverProfileLocationInput;

  @swagger.ApiProperty({
    required: false,
    type: [String],
    description: "Selected active service district ids to replace the driver's current district preferences",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  serviceDistrictIds?: string[];
}