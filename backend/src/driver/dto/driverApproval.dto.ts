import * as swagger from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ApproveDriverBody {
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

export class SuspendDriverBody {
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

export class UnsuspendDriverBody {
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
export class RejectDriverBody {
  @ApiProperty({ required: false, type: String, nullable: true })
  @IsOptional()
  @IsString()
  actorUserId?: string | null;

  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsOptional()
  reason?: string | null;
}