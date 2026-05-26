import * as swagger from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class ApproveCustomerBody {
  @swagger.ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  postpaidEnabled?: boolean;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class RejectCustomerBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  reason?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class SuspendCustomerBody {
  @swagger.ApiProperty()
  @IsString()
  reason!: string;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}

export class UnsuspendCustomerBody {
  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;

  @swagger.ApiProperty({
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;
}
