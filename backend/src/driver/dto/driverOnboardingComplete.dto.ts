import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsDateString,
  MaxLength,
} from "class-validator";

export class CompleteDriverOnboardingDto {
  @ApiProperty({
    description:
      "Full legal name exactly as it appears on the driver's license",
    example: "John Michael Smith",
  })
  @IsNotEmpty({ message: "Full legal name is required" })
  @IsString()
  @MaxLength(200)
  legalFullName!: string;

  @ApiProperty({
    description: "Date of birth in MM/DD/YYYY format",
    example: "01/15/1990",
  })
  @IsNotEmpty({ message: "Date of birth is required" })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: "Date of birth must be in MM/DD/YYYY format",
  })
  dateOfBirth!: string;

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
}
