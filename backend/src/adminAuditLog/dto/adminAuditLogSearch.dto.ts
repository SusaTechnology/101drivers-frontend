// src/adminAuditLog/dto/adminAuditLogSearch.dto.ts
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class AdminAuditLogSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  where?: {
    action?: string;
    actionIn?: string[];

    actorType?: string;
    actorTypeIn?: string[];

    actorUserId?: string;
    customerId?: string;
    driverId?: string;
    deliveryId?: string;
    userId?: string;

    reason?: string;
    reasonContains?: string;

    createdFrom?: string;
    createdTo?: string;

    updatedFrom?: string;
    updatedTo?: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  orderBy?: Record<string, "asc" | "desc">;

  @ApiPropertyOptional()
  @IsOptional()
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  take?: number;
}