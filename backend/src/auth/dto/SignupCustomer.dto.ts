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
    description:
      "Password is sent on the second call together with verificationToken",
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({
    example: "Mike Dealer",
    description: "User full name; usually same as contact person name",
  })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: "+1 415 555 0123", required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: "Mike Dealer" })
  @IsString()
  contactName!: string;

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
}