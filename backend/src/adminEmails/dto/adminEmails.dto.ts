import { ApiPropertyOptional } from "@nestjs/swagger";
import { EnumNotificationEventChannel, EnumNotificationEventStatus } from "@prisma/client";

export enum EnumAdminEmailsAudience {
  ALL = "all",
  DRIVERS = "drivers",
}

export class AdminEmailsListQueryDto {
  @ApiPropertyOptional({ description: "Window in days back from now (default 7, ignored when since/until given)" })
  days?: number;

  @ApiPropertyOptional({ description: "ISO date — window start (overrides days)" })
  since?: string;

  @ApiPropertyOptional({ description: "ISO date — window end (defaults to now)" })
  until?: string;

  @ApiPropertyOptional({ enum: EnumNotificationEventStatus, description: "SENT / FAILED / QUEUED — omit for all" })
  status?: EnumNotificationEventStatus;

  @ApiPropertyOptional({ description: "templateCode contains (case-insensitive)" })
  templateCode?: string;

  @ApiPropertyOptional({ description: "recipient email contains (case-insensitive)" })
  q?: string;

  @ApiPropertyOptional({ enum: EnumAdminEmailsAudience, description: "drivers = driver emails only (default all)" })
  audience?: EnumAdminEmailsAudience;

  @ApiPropertyOptional({ description: "campaignId stored in the event payload — filter to one bulk campaign" })
  campaign?: string;

  @ApiPropertyOptional({ description: "1-based page" })
  page?: number;

  @ApiPropertyOptional({ description: "page size, clamped to 1..100 (default 25)" })
  pageSize?: number;
}

export class AdminEmailRowDto {
  id!: string;
  status!: EnumNotificationEventStatus;
  templateCode!: string | null;
  subject!: string | null;
  toEmail!: string | null;
  driverId!: string | null;
  createdAt!: Date;
  sentAt!: Date | null;
  failedAt!: Date | null;
  errorMessage!: string | null;
  body!: string | null;
}

export class AdminEmailsListResponseDto {
  items!: AdminEmailRowDto[];
  total!: number;
  page!: number;
  pageSize!: number;
  channel!: EnumNotificationEventChannel;
}

export class AdminEmailsTemplateStatDto {
  templateCode!: string;
  sent!: number;
  failed!: number;
  queued!: number;
  total!: number;
}

export class AdminEmailsCampaignStatDto {
  campaign!: string;
  sent!: number;
  total!: number;
  lastAt!: Date;
}

export class AdminEmailsStatsResponseDto {
  since!: Date;
  until!: Date;
  totals!: { sent: number; failed: number; queued: number; all: number };
  byTemplate!: AdminEmailsTemplateStatDto[];
  campaigns!: AdminEmailsCampaignStatDto[];
}
