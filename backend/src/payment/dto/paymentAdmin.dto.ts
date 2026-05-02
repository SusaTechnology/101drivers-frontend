import * as swagger from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

const toBoolean = ({ value }: { value: any }) =>
  value === true || value === "true";

export class PaymentAdminListQueryDto {
  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  status?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  paymentType?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  provider?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  deliveryId?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true, format: "date-time" })
  @IsOptional()
  @IsString()
  from?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true, format: "date-time" })
  @IsOptional()
  @IsString()
  to?: string | null;

  @swagger.ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(toBoolean)
  invoicedOnly?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(toBoolean)
  unpaidOnly?: boolean;

  @swagger.ApiProperty({ required: false, default: 1 })
  @IsOptional()
  page?: number;

  @swagger.ApiProperty({ required: false, default: 20 })
  @IsOptional()
  pageSize?: number;
}

export class PaymentMarkPaidBody {
  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class PaymentMarkPayoutPaidBody {
  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  providerTransferId?: string | null;

  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}
export class PaymentMarkInvoicedBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  invoiceId?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;
}