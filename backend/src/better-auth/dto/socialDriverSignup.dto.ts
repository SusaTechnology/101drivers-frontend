import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

/**
 * Body for POST /api/auth/ba/social-driver-signup — the driver APPLICATION a
 * social-registered user submits AFTER Better Auth established their identity.
 * Better Auth owns identity (email/name come from the session, never from the
 * client); this endpoint creates the business Driver row under the SAME gates
 * as the legacy email signup (California ZIP, age 25+).
 */
export class SocialDriverSignupDto {
  @ApiProperty({ example: "Chris Driver" })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({
    description: "Date of birth in MM/DD/YYYY format. Driver must be 25 or older.",
    example: "01/15/1990",
  })
  @IsNotEmpty({ message: "Date of birth is required" })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: "Date of birth must be in MM/DD/YYYY format",
  })
  dateOfBirth!: string;

  @ApiProperty({
    description: "Home ZIP code — California only (90001–96199).",
    example: "90001",
  })
  @IsNotEmpty({ message: "Home ZIP code is required" })
  @Matches(/^\d{5}$/, { message: "A valid 5-digit ZIP code is required" })
  homeArea!: string;

  @ApiProperty({ example: "+1 408 555 0144", required: false })
  @IsOptional()
  @IsString()
  phone?: string;

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
    description: "Referral code snapshot (applied non-blocking, like legacy signup).",
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
