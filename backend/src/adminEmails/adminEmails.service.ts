import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EnumNotificationEventChannel, EnumNotificationEventStatus } from "@prisma/client";
import {
  AdminEmailsCampaignStatDto,
  AdminEmailsListQueryDto,
  AdminEmailsListResponseDto,
  AdminEmailsStatsResponseDto,
  AdminEmailsTemplateStatDto,
  EnumAdminEmailsAudience,
} from "./dto/adminEmails.dto";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const CAMPAIGN_LIST_LIMIT = 20;

@Injectable()
export class AdminEmailsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Shared window resolution: explicit since/until ISO dates win, otherwise
   * days-back from now (default 7, clamped to a year so a bad param can
   * never scan the whole table).
   */
  private resolveWindow(query: { since?: string; until?: string; days?: number }): {
    since: Date;
    until: Date;
  } {
    const now = new Date();
    let until = now;
    let since: Date;
    if (query.since) {
      const parsed = new Date(query.since);
      since = isNaN(parsed.getTime())
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : parsed;
    } else {
      const days =
        Number.isFinite(query.days) && (query.days as number) > 0
          ? Math.min(Math.floor(query.days as number), 365)
          : 7;
      since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    if (query.until) {
      const parsed = new Date(query.until);
      if (!isNaN(parsed.getTime())) until = parsed;
    }
    return { since, until };
  }

  /**
   * Read-only view over the NotificationEvent ledger — the same source the
   * email:audit script reads. EMAIL channel only (SMS is out of scope for
   * the "Emails Sent" page).
   */
  async list(query: AdminEmailsListQueryDto): Promise<AdminEmailsListResponseDto> {
    const { since, until } = this.resolveWindow(query);
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(Number(query.pageSize) || DEFAULT_PAGE_SIZE))
    );

    // A campaign is its own time scope (it ran on one day) — when filtering
    // to one campaign, the days/since/until window is ignored entirely, so
    // last month's campaign is browsable without touching the window filter.
    const campaign = query.campaign?.trim() ?? "";
    const hasCampaign = campaign !== "";

    const where = {
      channel: EnumNotificationEventChannel.EMAIL,
      ...(hasCampaign
        ? {
            // Bulk-campaign emails carry their campaignId in the payload JSON
            // (stamped by send-invite-approval-emails.ts / queueAndSend).
            payload: { path: ["campaignId"], equals: campaign },
          }
        : { createdAt: { gte: since, lte: until } }),
      ...(query.status &&
      Object.values(EnumNotificationEventStatus).includes(query.status)
        ? { status: query.status }
        : {}),
      ...(query.templateCode?.trim()
        ? { templateCode: { contains: query.templateCode.trim(), mode: "insensitive" as const } }
        : {}),
      ...(query.q?.trim()
        ? { toEmail: { contains: query.q.trim(), mode: "insensitive" as const } }
        : {}),
      ...(query.audience === EnumAdminEmailsAudience.DRIVERS
        ? { driverId: { not: null } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          templateCode: true,
          subject: true,
          toEmail: true,
          driverId: true,
          createdAt: true,
          sentAt: true,
          failedAt: true,
          errorMessage: true,
          body: true,
        },
      }),
      this.prisma.notificationEvent.count({ where }),
    ]);

    return { items, total, page, pageSize, channel: EnumNotificationEventChannel.EMAIL };
  }

  /**
   * Header stats for the Emails Sent page: per-template SENT/FAILED/QUEUED
   * counts (invite, approvals, meeting request, …) and the recent bulk
   * campaigns with their sent counts, for the campaign filter dropdown.
   * Campaign aggregation is done in SQL because the campaignId lives inside
   * the payload JSON — Prisma groupBy cannot group on a JSON path.
   */
  async stats(query: AdminEmailsListQueryDto): Promise<AdminEmailsStatsResponseDto> {
    const { since, until } = this.resolveWindow(query);

    // Same rule as the list: one campaign selected → the campaign IS the
    // scope (stats reflect that campaign only, no time window).
    const campaign = query.campaign?.trim() ?? "";
    const hasCampaign = campaign !== "";

    const where = {
      channel: EnumNotificationEventChannel.EMAIL,
      ...(hasCampaign
        ? { payload: { path: ["campaignId"], equals: campaign } }
        : { createdAt: { gte: since, lte: until } }),
      ...(query.q?.trim()
        ? { toEmail: { contains: query.q.trim(), mode: "insensitive" as const } }
        : {}),
      ...(query.audience === EnumAdminEmailsAudience.DRIVERS
        ? { driverId: { not: null } }
        : {}),
    };

    const groups = await this.prisma.notificationEvent.groupBy({
      by: ["templateCode", "status"],
      where,
      _count: { _all: true },
    });

    const templateMap = new Map<string, AdminEmailsTemplateStatDto>();
    const totals = { sent: 0, failed: 0, queued: 0, all: 0 };
    for (const g of groups) {
      const code = g.templateCode ?? "(no template)";
      const n = g._count._all;
      totals.all += n;
      if (g.status === EnumNotificationEventStatus.SENT) totals.sent += n;
      if (g.status === EnumNotificationEventStatus.FAILED) totals.failed += n;
      if (g.status === EnumNotificationEventStatus.QUEUED) totals.queued += n;
      const entry =
        templateMap.get(code) ??
        ({ templateCode: code, sent: 0, failed: 0, queued: 0, total: 0 } as AdminEmailsTemplateStatDto);
      entry.total += n;
      if (g.status === EnumNotificationEventStatus.SENT) entry.sent += n;
      if (g.status === EnumNotificationEventStatus.FAILED) entry.failed += n;
      if (g.status === EnumNotificationEventStatus.QUEUED) entry.queued += n;
      templateMap.set(code, entry);
    }

    // The dropdown source is windowless on purpose — a campaign is its own
    // time scope, and the 20 most recent campaigns must be selectable no
    // matter which window the table is showing.
    const campaigns = await this.prisma.$queryRaw<AdminEmailsCampaignStatDto[]>`
      SELECT
        payload->>'campaignId'         AS campaign,
        COUNT(*) FILTER (WHERE status = 'SENT')::int AS sent,
        COUNT(*)::int                  AS total,
        MAX("createdAt")               AS "lastAt"
      FROM "NotificationEvent"
      WHERE "channel" = 'EMAIL'
        AND payload->>'campaignId' IS NOT NULL
      GROUP BY payload->>'campaignId'
      ORDER BY MAX("createdAt") DESC
      LIMIT ${CAMPAIGN_LIST_LIMIT}
    `;

    return {
      since,
      until,
      totals,
      byTemplate: [...templateMap.values()].sort((a, b) => b.total - a.total),
      campaigns,
    };
  }
}
