import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

/**
 * Body for PATCH /drivers/onboarding-data — the signed-in driver's edit
 * page for information ALREADY submitted at onboarding completion.
 *
 * Differences from CompleteDriverOnboardingDto:
 *   • ssn is OPTIONAL — the stored (hashed/encrypted) SSN is kept when the
 *     driver does not re-enter it, so the masked "on file" display is the
 *     normal path. When provided it must be 9 digits and is re-hashed and
 *     re-encrypted like a first submission.
 *   • dateOfBirth is OPTIONAL (MM/DD/YYYY, same format signup collects) —
 *     re-validated against the same 25+ rule when changed.
 *   • Everything else mirrors the completion contract: license number and
 *     state, both license photos, selfie, and the residential address are
 *     required so the record never ends up half-erased; ZIP stays optional
 *     (stored value kept when omitted) and the CA ZIP backstop still
 *     applies server-side.
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

  @ApiProperty({
    description:
      "Social Security Number (9 digits). OPTIONAL — omit to keep the SSN already on file (masked in the GET response); when provided it replaces the stored one.",
    example: "123456789",
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{9}$/, {
    message: "SSN must be exactly 9 digits",
  })
  ssn?: string;

  @ApiProperty({
    description: "Residential address line 1 (street address)",
    example: "123 Main Street",
  })
  @IsNotEmpty({ message: "Street address is required" })
  @IsString()
  @MaxLength(500)
  residentialAddressLine1!: string;

  @ApiProperty({
    description: "Residential address line 2 (apt, suite, etc.)",
    example: "Apt 4B",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  residentialAddressLine2?: string;

  @ApiProperty({
    description: "Residential city",
    example: "Los Angeles",
  })
  @IsNotEmpty({ message: "City is required" })
  @IsString()
  @MaxLength(200)
  residentialCity!: string;

  @ApiProperty({
    description: "Residential state (2-letter code)",
    example: "CA",
  })
  @IsNotEmpty({ message: "State is required" })
  @Matches(/^[A-Z]{2}$/, {
    message: "State must be a valid 2-letter code",
  })
  residentialState!: string;

  @ApiProperty({
    description:
      "Residential ZIP code (5 digits). Optional: when omitted, the already-stored value is kept untouched.",
    example: "90001",
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: "ZIP code must be 5 digits (optionally with 4-digit extension)",
  })
  residentialZip?: string;

  @ApiProperty({
    description: "Selfie photo URL for identity verification",
    example: "https://example.com/uploads/selfie-abc123.jpg",
  })
  @IsNotEmpty({ message: "Selfie photo is required" })
  @IsString()
  selfiePhotoUrl!: string;

  @ApiProperty({
    description:
      "Date of birth as MM/DD/YYYY. Optional — when omitted the stored date of birth is kept untouched; when changed it is re-validated against the driver age rule.",
    example: "05/14/1990",
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: "Date of birth must be in MM/DD/YYYY format",
  })
  dateOfBirth?: string;
}
