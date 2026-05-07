import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class SignupDriverDto {
  @ApiProperty({ example: "driver1@101drivers.techbee.et" })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: "Password123!",
    description:
      "Password is sent on the second call together with verificationToken",
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: "Chris Driver" })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: "+1 408 555 0144", required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: "https://cdn.example.com/me.jpg" })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @ApiProperty({ required: false, example: "https://cdn.example.com/selfie.jpg" })
  @IsOptional()
  @IsString()
  selfiePhotoUrl?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      "OTP/token sent by email. Omit on first call; provide on second call.",
    example: "123456",
  })
  @IsOptional()
  @IsString()
  verificationToken?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: "Los Angeles",
    description: "Preferred city for job search / matching",
  })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 25,
    description: "Preferred service radius in miles",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  radiusMiles?: number | null;

  @ApiProperty({
    required: false,
    type: [String],
    example: ["district_id_1", "district_id_2"],
    description: "Preferred service districts",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  districtIds?: string[];

  @ApiProperty({
    required: false,
    default: true,
    description: "Master switch for job alerts",
  })
  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;

  @ApiProperty({
    required: false,
    default: true,
    description: "Receive alert emails",
  })
  @IsOptional()
  @IsBoolean()
  emailAlertsEnabled?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    description: "Receive alert SMS",
  })
  @IsOptional()
  @IsBoolean()
  smsAlertsEnabled?: boolean;
}