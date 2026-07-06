import * as swagger from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UploadDriverProfilePhotoBody {
  @swagger.ApiProperty()
  @IsString()
  @IsNotEmpty()
  driverId!: string;
}

export class UploadDriverProfilePhotoResponseDto {
  @swagger.ApiProperty()
  ok!: boolean;

  @swagger.ApiProperty()
  url!: string;

  @swagger.ApiProperty()
  filename!: string;

  @swagger.ApiProperty()
  mimeType!: string;

  @swagger.ApiProperty()
  size!: number;
}