import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class UploadAppSettingFileBody {
  @ApiProperty({
    enum: ["investor-deck", "landing-page"],
  })
  @IsString()
  @IsIn(["investor-deck", "landing-page"])
  scope!: string;

  @ApiProperty({
    enum: ["PDF", "IMAGE"],
  })
  @IsString()
  @IsIn(["PDF", "IMAGE"])
  kind!: "PDF" | "IMAGE";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filenameHint?: string;
}

export class UploadAppSettingFileResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;
}