import * as swagger from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsOptional, IsString } from "class-validator";

export class MyNotificationEventListQueryDto {
  @swagger.ApiProperty({ required: false, default: false })
  @IsOptional()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @swagger.ApiProperty({ required: false, default: false })
  @IsOptional()
  @Type(() => Boolean)
  includeArchived?: boolean;

  @swagger.ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  take?: number;

  @swagger.ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  skip?: number;
}

export class MarkNotificationReadBody {
  @swagger.ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

export class OpenNotificationBody {
  @swagger.ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  markRead?: boolean;
}

export class ArchiveNotificationBody {
  @swagger.ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ClickNotificationBody {
  @swagger.ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  targetUrl?: string | null;
}

export class NotificationEventListResponseDto {
  @swagger.ApiProperty({ type: [Object] })
  items!: any[];

  @swagger.ApiProperty()
  count!: number;

  @swagger.ApiProperty()
  unreadCount!: number;
}