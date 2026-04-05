import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

export class LandingPageSettingsResponseDto {
  @ApiProperty()
  fundraisingEnabled!: boolean;

  @ApiProperty()
  dealerLeadEnabled!: boolean;

  @ApiProperty()
  investorLeadEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  investorDeckTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorDeckUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorDeckFilename!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorDeckUploadedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dealerLeadCtaTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dealerLeadCtaDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorLeadCtaTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  investorLeadCtaDescription!: string | null;
}

export class UpdateLandingPageSettingsBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fundraisingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dealerLeadEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  investorLeadEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  investorDeckTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: "investorDeckUrl must be a valid URL" })
  investorDeckUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  investorDeckFilename?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dealerLeadCtaTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dealerLeadCtaDescription?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  investorLeadCtaTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  investorLeadCtaDescription?: string | null;
}