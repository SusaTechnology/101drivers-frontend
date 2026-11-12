import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
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
// Export hard cap — newest first, so a filterless all-time export can never
// exhaust memory. The 7-day default window keeps normal exports far below it.
const MAX_EXPORT_ROWS = 20000;
// Excel hard-caps a cell at 32767 chars; stay safely under it.
const MAX_XLSX_CELL_CHARS = 32000;

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
   * Shared filter builder for list() and exportEmails(): EMAIL channel, the
   * campaign-or-window scope (a selected campaign REPLACES the time window —
   * a campaign ran on one day), plus status / template / recipient /
   * audience filters. One builder guarantees the export always matches what
   * the table shows.
   */
  private buildListWhere(query: AdminEmailsListQueryDto) {
    const { since, until } = this.resolveWindow(query);
    const campaign = query.campaign?.trim() ?? "";
    const hasCampaign = campaign !== "";

    return {
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
  }

  /**
   * Read-only view over the NotificationEvent ledger — the same source the
   * email:audit script reads. EMAIL channel only (SMS is out of scope for
   * the "Emails Sent" page).
   */
  async list(query: AdminEmailsListQueryDto): Promise<AdminEmailsListResponseDto> {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(Number(query.pageSize) || DEFAULT_PAGE_SIZE))
    );

    const where = this.buildListWhere(query);

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
          // Provenance for admin-sent emails (meeting requests): who
          // triggered it and the From scope — surfaced in the detail dialog.
          payload: true,
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

  /**
   * Full export (CSV / Excel) of EVERY email matching the filters — same
   * scope as the table, no pagination. Excel output is a real .xlsx (ExcelJS)
   * with formatted date cells; CSV carries a UTF-8 BOM so Excel opens it
   * correctly. Capped at MAX_EXPORT_ROWS newest-first.
   */
  async exportEmails(
    query: AdminEmailsListQueryDto,
    format: "csv" | "xlsx"
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const where = this.buildListWhere(query);
    const rows = await this.prisma.notificationEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
      select: {
        createdAt: true,
        sentAt: true,
        failedAt: true,
        status: true,
        templateCode: true,
        subject: true,
        toEmail: true,
        driverId: true,
        payload: true,
        errorMessage: true,
        body: true,
      },
    });

    const campaignIdOf = (payload: unknown): string => {
      const p = payload as Record<string, unknown> | null;
      return typeof p?.campaignId === "string" ? p.campaignId : "";
    };
    const iso = (d: Date | null): string => (d ? d.toISOString() : "");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Email log");
      sheet.columns = [
        { header: "Created", key: "createdAt", width: 20 },
        { header: "Sent", key: "sentAt", width: 20 },
        { header: "Failed", key: "failedAt", width: 20 },
        { header: "Status", key: "status", width: 10 },
        { header: "Template", key: "templateCode", width: 22 },
        { header: "Recipient", key: "toEmail", width: 34 },
        { header: "Subject", key: "subject", width: 40 },
        { header: "Campaign", key: "campaignId", width: 30 },
        { header: "Driver ID", key: "driverId", width: 24 },
        { header: "Error", key: "errorMessage", width: 32 },
        { header: "Body", key: "body", width: 60 },
      ];
      for (const r of rows) {
        const row = sheet.addRow({
          createdAt: r.createdAt,
          sentAt: r.sentAt ?? "",
          failedAt: r.failedAt ?? "",
          status: r.status,
          templateCode: r.templateCode ?? "",
          toEmail: r.toEmail ?? "",
          subject: r.subject ?? "",
          campaignId: campaignIdOf(r.payload),
          driverId: r.driverId ?? "",
          errorMessage: r.errorMessage ?? "",
          body: r.body ? r.body.slice(0, MAX_XLSX_CELL_CHARS) : "",
        });
        for (const col of ["createdAt", "sentAt", "failedAt"]) {
          const cell = row.getCell(col);
          if (cell.value instanceof Date) {
            cell.numFmt = "yyyy-mm-dd hh:mm:ss";
          }
        }
      }
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      };
      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `email-log-${stamp}.xlsx`,
      };
    }

    // CSV with a UTF-8 BOM so Excel detects the encoding; CRLF rows.
    const header = [
      "Created",
      "Sent",
      "Failed",
      "Status",
      "Template",
      "Recipient",
      "Subject",
      "Campaign",
      "Driver ID",
      "Error",
      "Body",
    ];
    const escape = (v: string): string =>
      /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [header.map(escape).join(",")];
    for (const r of rows) {
      lines.push(
        [
          iso(r.createdAt),
          iso(r.sentAt),
          iso(r.failedAt),
          r.status,
          r.templateCode ?? "",
          r.toEmail ?? "",
          r.subject ?? "",
          campaignIdOf(r.payload),
          r.driverId ?? "",
          r.errorMessage ?? "",
          r.body ?? "",
        ]
          .map((v) => escape(String(v)))
          .join(",")
      );
    }
    return {
      buffer: Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: `email-log-${stamp}.csv`,
    };
  }
}
