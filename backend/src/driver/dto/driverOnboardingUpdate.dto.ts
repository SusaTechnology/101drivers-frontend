import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

/**
 * Body for PATCH /drivers/onboarding-data — the signed-in driver's
 * license-update page for information ALREADY submitted at onboarding
 * completion.
 *
 * Deliberately NARROW (owner decision): a pending-approval driver may only
 * correct their DRIVER'S LICENSE details — number, issuing state, and the
 * front/back photos. Identity data that must not drift mid-review (SSN,
 * date of birth), the residential address, and the verification selfie are
 * NOT editable here; anything else goes through support. The endpoint also
 * only accepts this from PENDING_APPROVAL, so nothing changes once the
 * background-check stage begins after approval.
 */
export class UpdateDriverOnboardingDto {
  @ApiProperty({
    description: "Driver's license number",
    example: "D123456789",
  })
  @IsNotEmpty({ message: "License number is required" })
  @IsString()
  @MaxLength(50)
  licenseNumber!: string;

  @ApiProperty({
    description: "State that issued the license (2-letter code)",
    example: "CA",
  })
  @IsNotEmpty({ message: "License state is required" })
  @Matches(/^[A-Z]{2}$/, {
    message: "License state must be a valid 2-letter code",
  })
  licenseState!: string;

  @ApiProperty({
    description: "Front of driver's license photo URL",
    example: "https://example.com/uploads/license-front-abc123.jpg",
  })
  @IsNotEmpty({ message: "License front photo is required" })
  @IsString()
  licenseFrontUrl!: string;

  @ApiProperty({
    description: "Back of driver's license photo URL",
    example: "https://example.com/uploads/license-back-abc123.jpg",
  })
  @IsNotEmpty({ message: "License back photo is required" })
  @IsString()
  licenseBackUrl!: string;
}
