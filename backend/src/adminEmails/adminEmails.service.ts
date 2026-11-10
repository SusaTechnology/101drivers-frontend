import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EnumNotificationEventChannel, EnumNotificationEventStatus } from "@prisma/client";
import {
  AdminEmailsListQueryDto,
  AdminEmailsListResponseDto,
  EnumAdminEmailsAudience,
} from "./dto/adminEmails.dto";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class AdminEmailsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only view over the NotificationEvent ledger — the same source the
   * email:audit script reads. EMAIL channel only (SMS is out of scope for
   * the "Emails Sent" page).
   */
  async list(query: AdminEmailsListQueryDto): Promise<AdminEmailsListResponseDto> {
    const now = new Date();

    let since: Date;
    let until: Date = now;
    if (query.since) {
      const parsed = new Date(query.since);
      since = isNaN(parsed.getTime()) ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : parsed;
    } else {
      const days = Number.isFinite(query.days) && (query.days as number) > 0
        ? Math.min(Math.floor(query.days as number), 365)
        : 7;
      since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    if (query.until) {
      const parsed = new Date(query.until);
      if (!isNaN(parsed.getTime())) until = parsed;
    }

    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(Number(query.pageSize) || DEFAULT_PAGE_SIZE))
    );

    const where = {
      channel: EnumNotificationEventChannel.EMAIL,
      createdAt: { gte: since, lte: until },
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
}
