import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Customer as PrismaCustomer,
  DeliveryRequest as PrismaDeliveryRequest,
  Driver as PrismaDriver,
  NotificationEvent as PrismaNotificationEvent,
  Prisma,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { NotificationEventServiceBase } from "./base/notificationEvent.service.base";
import { NotificationEventDomain } from "../domain/notificationEvent/notificationEvent.domain";
import { NotificationEventPolicyService } from "../domain/notificationEvent/notificationEventPolicy.service";

@Injectable()
export class NotificationEventService extends NotificationEventServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: NotificationEventDomain,
    private readonly policy: NotificationEventPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.NotificationEventCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.notificationEvent.count(args);
  }

  async notificationEvents(args: Prisma.NotificationEventFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async notificationEvent(args: Prisma.NotificationEventFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createNotificationEvent(args: Prisma.NotificationEventCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.notificationEvent.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateNotificationEvent(args: Prisma.NotificationEventUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.notificationEvent.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteNotificationEvent(
    args: Prisma.NotificationEventDeleteArgs
  ): Promise<PrismaNotificationEvent> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.notificationEvent.delete(args);
  }

  async getActor(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.notificationEvent
      .findUnique({ where: { id: parentId } })
      .actor();
  }

  async getCustomer(parentId: string): Promise<PrismaCustomer | null> {
    return this.prisma.notificationEvent
      .findUnique({ where: { id: parentId } })
      .customer();
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.notificationEvent
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.notificationEvent
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  async getMyNotificationEvents(input: {
    actorUserId: string;
    unreadOnly?: boolean;
    includeArchived?: boolean;
    take?: number;
    skip?: number;
  }): Promise<{ items: any[]; count: number; unreadCount: number }> {
    const where: Prisma.NotificationEventWhereInput = {
      actorUserId: input.actorUserId,
      ...(input.unreadOnly ? { isRead: false } : {}),
      ...(input.includeArchived ? {} : { archivedAt: null }),
    };

    const [items, count, unreadCount] = await Promise.all([
      this.domain.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.take ?? 50,
        skip: input.skip ?? 0,
      }),
      this.prisma.notificationEvent.count({ where }),
      this.prisma.notificationEvent.count({
        where: {
          actorUserId: input.actorUserId,
          isRead: false,
          archivedAt: null,
        },
      }),
    ]);

    return { items, count, unreadCount };
  }

  async openNotificationEvent(input: {
    notificationEventId: string;
    actorUserId: string;
    markRead?: boolean;
  }): Promise<any> {
    const row = await this.prisma.notificationEvent.findUnique({
      where: { id: input.notificationEventId },
      select: {
        id: true,
        actorUserId: true,
        openedAt: true,
        readAt: true,
        isRead: true,
      },
    });

    if (!row) {
      throw new NotFoundException("NotificationEvent not found");
    }

    this.ensureActorOwnsNotification(row.actorUserId, input.actorUserId);

    const now = new Date();

    const updated = await this.updateNotificationEvent({
      where: { id: input.notificationEventId },
      data: {
        openedAt: row.openedAt ?? now,
        ...(input.markRead !== false
          ? {
              isRead: true,
              readAt: row.readAt ?? now,
            }
          : {}),
      },
    });

    return updated;
  }

  async markNotificationEventRead(input: {
    notificationEventId: string;
    actorUserId: string;
    read?: boolean;
  }): Promise<any> {
    const row = await this.prisma.notificationEvent.findUnique({
      where: { id: input.notificationEventId },
      select: {
        id: true,
        actorUserId: true,
      },
    });

    if (!row) {
      throw new NotFoundException("NotificationEvent not found");
    }

    this.ensureActorOwnsNotification(row.actorUserId, input.actorUserId);

    const read = input.read !== false;
    const now = new Date();

    return this.updateNotificationEvent({
      where: { id: input.notificationEventId },
      data: {
        isRead: read,
        readAt: read ? now : null,
      },
    });
  }

  async markAllNotificationEventsRead(input: {
    actorUserId: string;
  }): Promise<{ updatedCount: number }> {
    const now = new Date();

    const result = await this.prisma.notificationEvent.updateMany({
      where: {
        actorUserId: input.actorUserId,
        isRead: false,
        archivedAt: null,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    return { updatedCount: result.count };
  }

  async archiveNotificationEvent(input: {
    notificationEventId: string;
    actorUserId: string;
    archived?: boolean;
  }): Promise<any> {
    const row = await this.prisma.notificationEvent.findUnique({
      where: { id: input.notificationEventId },
      select: {
        id: true,
        actorUserId: true,
      },
    });

    if (!row) {
      throw new NotFoundException("NotificationEvent not found");
    }

    this.ensureActorOwnsNotification(row.actorUserId, input.actorUserId);

    const archived = input.archived !== false;

    return this.updateNotificationEvent({
      where: { id: input.notificationEventId },
      data: {
        archivedAt: archived ? new Date() : null,
      },
    });
  }

  async clickNotificationEvent(input: {
    notificationEventId: string;
    actorUserId: string;
  }): Promise<any> {
    const row = await this.prisma.notificationEvent.findUnique({
      where: { id: input.notificationEventId },
      select: {
        id: true,
        actorUserId: true,
        clickedAt: true,
      },
    });

    if (!row) {
      throw new NotFoundException("NotificationEvent not found");
    }

    this.ensureActorOwnsNotification(row.actorUserId, input.actorUserId);

    return this.updateNotificationEvent({
      where: { id: input.notificationEventId },
      data: {
        clickedAt: row.clickedAt ?? new Date(),
      },
    });
  }

  private ensureActorOwnsNotification(
    ownerActorUserId: string | null,
    actorUserId: string
  ): void {
    if (!ownerActorUserId || ownerActorUserId !== actorUserId) {
      throw new ForbiddenException("You are not allowed to access this notification");
    }
  }

  private normalizeCreateData(
    data: Prisma.NotificationEventCreateArgs["data"]
  ): Prisma.NotificationEventCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.subject = this.trimOptionalString(normalized.subject);
    normalized.body = this.trimOptionalString(normalized.body);
    normalized.templateCode = this.trimOptionalString(normalized.templateCode);
    normalized.toEmail = this.trimOptionalString(normalized.toEmail);
    normalized.toPhone = this.trimOptionalString(normalized.toPhone);
    normalized.errorMessage = this.trimOptionalString(normalized.errorMessage);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.NotificationEventUpdateArgs["data"]
  ): Prisma.NotificationEventUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "subject");
    this.normalizeUpdateStringField(normalized, "body");
    this.normalizeUpdateStringField(normalized, "templateCode");
    this.normalizeUpdateStringField(normalized, "toEmail");
    this.normalizeUpdateStringField(normalized, "toPhone");
    this.normalizeUpdateStringField(normalized, "errorMessage");

    return normalized;
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: this.trimOptionalString(raw.set),
      };
      return;
    }

    target[field] = this.trimOptionalString(raw);
  }
}