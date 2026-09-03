import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class SignupCustomerDto {
  @ApiProperty({
    example: "dealer.contact@101drivers.techbee.et",
    description: "Verified contact person email used for login",
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: "Password123!",
    required: false,
    description:
      "Password. Required on step 1 (send OTP). Optional on step 2 (verify OTP) " +
      "— if omitted, the backend reads the stored password hash from the User " +
      "row created in step 1.",
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({
    example: "Mike Dealer",
    required: false,
    description:
      "User full name. Required on step 1. Optional on step 2 (read from stored User).",
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: "+1 415 555 0123", required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: "Mike Dealer",
    required: false,
    description:
      "Contact person name. Required on step 1. Optional on step 2 (read from stored User).",
  })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({ example: "+1 415 555 0123", required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ example: "Bay Auto Sales", required: false })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({
    example: "ChIJ...",
    required: false,
    description: "Google Places/business directory place id",
  })
  @IsOptional()
  @IsString()
  businessPlaceId?: string;

  @ApiProperty({ example: "1 Market St, San Francisco, CA", required: false })
  @IsOptional()
  @IsString()
  businessAddress?: string;

  @ApiProperty({ example: "+1 650 555 0199", required: false })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  @ApiProperty({ example: "https://bayautosales.com", required: false })
  @IsOptional()
  @IsString()
  businessWebsite?: string;

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
    description:
      "Referral code used during signup. Applied to create a Referral link " +
      "(Customer→Customer or Driver→Customer). Non-blocking: invalid/expired " +
      "codes are silently ignored. Stored case-insensitively (uppercased on apply).",
    example: "ABCD2345",
  })
  @IsOptional()
  @IsString()
  referralCode?: string | null;
}