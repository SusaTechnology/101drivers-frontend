import * as swagger from "@nestjs/swagger";
import { EnumDeliveryEvidencePhase } from "@prisma/client";

export class UploadDeliveryEvidenceBody {
  @swagger.ApiProperty({
    required: true,
  })
  deliveryId!: string;

  @swagger.ApiProperty({
    required: false,
    enum: EnumDeliveryEvidencePhase,
    nullable: true,
  })
  phase?: EnumDeliveryEvidencePhase | null;
}

export class UploadDeliveryEvidenceResponseDto {
  @swagger.ApiProperty()
  ok!: boolean;

  @swagger.ApiProperty()
  slotIndex!: number;

  @swagger.ApiProperty()
  url!: string;

  @swagger.ApiProperty()
  filename!: string;

  @swagger.ApiProperty()
  mimeType!: string;

  @swagger.ApiProperty()
  size!: number;
}