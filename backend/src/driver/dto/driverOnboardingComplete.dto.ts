import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CompleteDriverOnboardingDto {
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
    description: "Social Security Number (9 digits, stored securely)",
    example: "123456789",
  })
  @IsNotEmpty({ message: "Social Security Number is required" })
  @Matches(/^\d{9}$/, {
    message: "SSN must be exactly 9 digits",
  })
  ssn!: string;

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
    description: "Residential ZIP code (5 digits)",
    example: "90001",
  })
  @IsNotEmpty({ message: "ZIP code is required" })
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: "ZIP code must be 5 digits (optionally with 4-digit extension)",
  })
  residentialZip!: string;

  @ApiProperty({
    description: "Selfie photo URL for identity verification",
    example: "https://example.com/uploads/selfie-abc123.jpg",
  })
  @IsNotEmpty({ message: "Selfie photo is required" })
  @IsString()
  selfiePhotoUrl!: string;
}
