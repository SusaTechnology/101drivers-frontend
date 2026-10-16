import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EnumSupportActorRole,
  EnumSupportActorType,
  EnumSupportPriority,
  EnumSupportStatus,
  Prisma,
  SupportRequest as PrismaSupportRequest,
  SupportRequestNote as PrismaSupportRequestNote,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { SupportRequestServiceBase } from "./base/supportRequest.service.base";
import { SupportRequestDomain } from "../domain/supportRequest/supportRequest.domain";
import { SupportRequestPolicyService } from "../domain/supportRequest/supportRequestPolicy.service";
import { SupportRequestOrchestratorService } from "src/support-logistics/support-request-orchestrator.service";

@Injectable()
export class SupportRequestService extends SupportRequestServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: SupportRequestDomain,
    private readonly policy: SupportRequestPolicyService,
    private readonly orchestrator: SupportRequestOrchestratorService
  ) {
    super(prisma);
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }
    return value.trim();
  }

  // ── Conversation privacy ──
  // A support request is a PRIVATE 1:1 conversation between the user who
  // raised it and Operations. Everything below enforces: ADMIN sees all,
  // everyone else only their own ticket — and never the internal notes.
  private isAdmin(roles?: string[] | null): boolean {
    return Array.isArray(roles) && roles.includes("ADMIN");
  }

  private assertAdmin(roles?: string[] | null): void {
    if (!this.isAdmin(roles)) {
      throw new ForbiddenException("Admin role required");
    }
  }

  /**
   * Enforce that the actor may open the given support request.
   * Admins pass; the ticket owner passes; everyone else gets a NotFound —
   * identical response to a missing row so ids cannot be probed.
   */
  private assertCanAccessRequest(
    item: { userId: string | null },
    actorUserId?: string | null,
    actorRoles?: string[] | null
  ): void {
    if (this.isAdmin(actorRoles)) return;
    if (actorUserId && item.userId === actorUserId) return;
    throw new NotFoundException("SupportRequest not found");
  }

  /**
   * Public guard for the generic REST routes (GET /supportRequests/:id and
   * /:id/notes). Loads the ticket and applies the same owner-or-admin rule
   * as the /detail endpoint — identical NotFound for missing vs forbidden so
   * ticket ids cannot be probed by other dealers/drivers.
   */
  async assertCanAccessRequestById(
    supportRequestId: string,
    actorUserId?: string | null,
    actorRoles?: string[] | null
  ): Promise<void> {
    const item = await this.prisma.supportRequest.findUnique({
      where: { id: supportRequestId },
      select: { userId: true },
    });

    if (!item) {
      throw new NotFoundException("SupportRequest not found");
    }

    this.assertCanAccessRequest(item, actorUserId, actorRoles);
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async count(
    args: Omit<Prisma.SupportRequestCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.supportRequest.count(args);
  }

  async supportRequests(
    args: Prisma.SupportRequestFindManyArgs,
    actorRoles?: string[] | null
  ): Promise<any[]> {
    // The plain list endpoint returns EVERY user's tickets — it is the ops
    // queue's raw shape and must never be readable by dealers/drivers.
    // (The dealer/driver apps use the user-scoped GET /supportRequests/my.)
    this.assertAdmin(actorRoles);
    return this.domain.findMany(args);
  }

  async supportRequest(
    args: Prisma.SupportRequestFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createSupportRequest(
    args: Prisma.SupportRequestCreateArgs
  ): Promise<PrismaSupportRequest> {
    await this.policy.beforeCreate(this.prisma, args.data);

    const created = await this.prisma.supportRequest.create(args);

    return this.prisma.supportRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
  }

  async updateSupportRequest(
    args: Prisma.SupportRequestUpdateArgs
  ): Promise<PrismaSupportRequest> {
    const current = await this.prisma.supportRequest.findUniqueOrThrow({
      where: args.where,
      select: {
        id: true,
        status: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    await this.policy.beforeUpdate(this.prisma, current.id, args.data);

    const nextStatus = this.resolveNextStatus(args.data, current.status);

    const patchedData: Prisma.SupportRequestUpdateArgs["data"] = {
      ...args.data,
    };

    if (
      nextStatus === EnumSupportStatus.RESOLVED &&
      current.resolvedAt == null
    ) {
      (patchedData as any).resolvedAt = new Date();
    }

    if (
      nextStatus === EnumSupportStatus.CLOSED &&
      current.closedAt == null
    ) {
      (patchedData as any).closedAt = new Date();
    }

    const updated = await this.prisma.supportRequest.update({
      ...args,
      data: patchedData,
    });

    return this.prisma.supportRequest.findUniqueOrThrow({
      where: { id: updated.id },
    });
  }

  async deleteSupportRequest(
    args: Prisma.SupportRequestDeleteArgs
  ): Promise<PrismaSupportRequest> {
    const id = (args.where as any)?.id;
    await this.policy.beforeDelete(this.prisma, id);

    return this.prisma.supportRequest.delete(args);
  }

  private resolveNextStatus(
    data: Prisma.SupportRequestUpdateArgs["data"],
    fallback: EnumSupportStatus
  ): EnumSupportStatus {
    const row = data as any;
    if (row.status === undefined) {
      return fallback;
    }
    if (row.status && typeof row.status === "object" && "set" in row.status) {
      return row.status.set;
    }
    return row.status;
  }

  async createContactRequest(input: {
    actorUserId?: string | null;
    actorRole: EnumSupportActorRole;
    deliveryId?: string | null;
    category: any;
    priority?: EnumSupportPriority;
    subject?: string | null;
    message: string;
  }): Promise<any> {
    const created = await this.orchestrator.createContactRequest({
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole,
      actorType: EnumSupportActorType.USER,
      deliveryId: input.deliveryId ?? null,
      category: input.category,
      priority: input.priority ?? EnumSupportPriority.NORMAL,
      subject: this.trimOptionalString(input.subject) ?? null,
      message: this.trimRequiredString(input.message),
    });

    return this.domain.findUnique({ id: created.id });
  }

  async getMySupportRequests(input: {
    actorUserId: string;
    status?: any | null;
    category?: any | null;
    priority?: any | null;
    take?: number;
    skip?: number;
  }): Promise<{ items: any[]; count: number }> {
    const where: Prisma.SupportRequestWhereInput = {
      userId: input.actorUserId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
    };

    const [items, count] = await Promise.all([
      this.domain.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: input.take ?? 50,
        skip: input.skip ?? 0,
      }),
      this.prisma.supportRequest.count({ where }),
    ]);

    return { items, count };
  }

  async getAdminSupportRequests(input: {
    actorRoles?: string[] | null;
    status?: any | null;
    category?: any | null;
    priority?: any | null;
    actorRole?: any | null;
    assignedToUserId?: string | null;
    deliveryId?: string | null;
    take?: number;
    skip?: number;
  }): Promise<{ items: any[]; count: number }> {
    // The ops queue lists EVERY user's tickets — strictly admin-only.
    this.assertAdmin(input.actorRoles);

    const where: Prisma.SupportRequestWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.actorRole ? { actorRole: input.actorRole } : {}),
      ...(input.assignedToUserId
        ? { assignedToUserId: input.assignedToUserId }
        : {}),
      ...(input.deliveryId ? { deliveryId: input.deliveryId } : {}),
    };

    const [items, count] = await Promise.all([
      this.domain.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: input.take ?? 50,
        skip: input.skip ?? 0,
      }),
      this.prisma.supportRequest.count({ where }),
    ]);

    // ── Staff unread decoration (navbar badge + list red dots) ──
    // A ticket is unread for staff while the latest non-ADMIN note (the
    // original request message is itself a note) is newer than adminReadAt.
    const decorated = items.map((item) => this.decorateAdminUnread(item));

    return { items: decorated, count };
  }

  /**
   * Shared unread computation for the admin surfaces.
   *
   * A support request carries ONE recipient-side read receipt:
   * `adminReadAt` (null = no admin ever opened it). Unread activity =
   * the newest note authored by a non-ADMIN (customer/driver/dealer reply
   * or the original message) is newer than `adminReadAt`.
   *
   * Returns { unreadForAdmin, unreadMessages } — the red dot / "N new"
   * chip on the support list rows.
   */
  private decorateAdminUnread(item: any): any {
    const notes: Array<{ createdAt: Date | string; authorRole: string }> =
      Array.isArray(item?.notes) ? item.notes : [];

    const nonAdminNotes = notes.filter(
      (n) => n?.authorRole !== EnumSupportActorRole.ADMIN
    );
    const lastNonAdminAt = nonAdminNotes.length
      ? new Date(
          nonAdminNotes.reduce(
            (latest, n) => {
              const t = new Date(n.createdAt).getTime();
              return t > latest.getTime() ? new Date(t) : latest;
            },
            new Date(0)
          )
        )
      : null;

    const adminReadAt = item?.adminReadAt ? new Date(item.adminReadAt) : null;
    const unreadForAdmin =
      lastNonAdminAt !== null &&
      (adminReadAt === null || lastNonAdminAt > adminReadAt);

    return {
      ...item,
      unreadForAdmin,
      unreadMessages: unreadForAdmin
        ? nonAdminNotes.filter(
            (n) =>
              !adminReadAt ||
              new Date(n.createdAt) > adminReadAt
          ).length
        : 0,
    };
  }

  /**
   * Count of tickets with unread staff activity — drives the admin navbar
   * "Support" badge. Scans the active queue (OPEN + IN_PROGRESS; any reply
   * auto-flips a RESOLVED ticket back to IN_PROGRESS, so this is complete)
   * and applies the same unread rule as the list decoration above.
   * Server-side counter, not client accumulation — badges agree across
   * devices after a refresh.
   */
  async getAdminUnreadSupportCount(
    actorRoles?: string[] | null
  ): Promise<{ unreadCount: number }> {
    this.assertAdmin(actorRoles);

    const activeRows = await this.prisma.supportRequest.findMany({
      where: {
        status: { in: [EnumSupportStatus.OPEN, EnumSupportStatus.IN_PROGRESS] },
      },
      select: {
        id: true,
        adminReadAt: true,
        notes: {
          where: { authorRole: { not: EnumSupportActorRole.ADMIN } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const unreadCount = activeRows.filter((row) => {
      const lastNonAdminAt = row.notes[0]?.createdAt
        ? new Date(row.notes[0].createdAt)
        : null;
      if (!lastNonAdminAt) return false;
      const adminReadAt = row.adminReadAt ? new Date(row.adminReadAt) : null;
      return adminReadAt === null || lastNonAdminAt > adminReadAt;
    }).length;

    return { unreadCount };
  }

  /**
   * Staff read receipt — called by the admin detail page when an admin
   * opens the conversation. Admin-only; delegates to the orchestrator
   * (which also emits the contentless staff-ops ping so OTHER admins'
   * badges refresh live).
   */
  async markAdminRead(input: {
    supportRequestId: string;
    actorRoles?: string[] | null;
  }): Promise<{ id: string; adminReadAt: Date }> {
    this.assertAdmin(input.actorRoles);
    return this.orchestrator.markAdminRead({
      supportRequestId: input.supportRequestId,
    });
  }

  async getSupportRequestDetail(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    actorRoles?: string[];
  }): Promise<any> {
    const item = await this.domain.findUnique({ id: input.supportRequestId });

    if (!item) {
      throw new NotFoundException("SupportRequest not found");
    }

    // Only the ticket owner and admins may read a conversation.
    this.assertCanAccessRequest(item, input.actorUserId, input.actorRoles);

    // Internal notes are staff-only — strip them from every non-admin
    // response (the old frontend filtered client-side, but the payload
    // itself leaked the content over the wire).
    if (!this.isAdmin(input.actorRoles) && Array.isArray(item.notes)) {
      item.notes = item.notes.filter((n: any) => !n.isInternal);
    }

    return item;
  }

  async replyToSupportRequest(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    actorRoles?: string[];
    message: string;
  }): Promise<PrismaSupportRequestNote> {
    const item = await this.prisma.supportRequest.findUnique({
      where: { id: input.supportRequestId },
      select: {
        id: true,
        userId: true,
        actorRole: true,
      },
    });

    if (!item) {
      throw new NotFoundException("SupportRequest not found");
    }

    // Replying writes into a private conversation — owner or admin only.
    this.assertCanAccessRequest(item, input.actorUserId, input.actorRoles);

    // ── Determine the replier's role from their actual user roles ──
    // Previously this used `item.actorRole` (the original request creator's
    // role), which meant when an admin replied to a dealer's support
    // request, the reply was stored as `authorRole: "DEALER"` instead of
    // `authorRole: "ADMIN"`. This caused the frontend to show admin
    // replies as if they came from the dealer.
    //
    // We derive the replier's role from the `actorRoles` array passed
    // from the controller (which comes from `req.user.roles`). This is
    // the actual authenticated user's role, not the request creator's.
    const roles = input.actorRoles ?? [];
    let authorRole: EnumSupportActorRole;
    if (roles.includes('ADMIN')) {
      authorRole = EnumSupportActorRole.ADMIN;
    } else if (roles.includes('DRIVER')) {
      authorRole = EnumSupportActorRole.DRIVER;
    } else if (roles.includes('PRIVATE_CUSTOMER')) {
      authorRole = EnumSupportActorRole.PRIVATE_CUSTOMER;
    } else if (roles.includes('BUSINESS_CUSTOMER')) {
      authorRole = EnumSupportActorRole.DEALER;
    } else {
      // Fallback: use the original request's actorRole (conservative)
      authorRole = item.actorRole;
    }

    const created = await this.orchestrator.replyToSupportRequest({
      supportRequestId: input.supportRequestId,
      actorUserId: input.actorUserId ?? null,
      authorRole,
      message: this.trimRequiredString(input.message),
      isInternal: false,
    });

    return created;
  }

  async addInternalSupportNote(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    actorRoles?: string[];
    message: string;
  }): Promise<PrismaSupportRequestNote> {
    this.assertAdmin(input.actorRoles);

    const existing = await this.prisma.supportRequest.findUnique({
      where: { id: input.supportRequestId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("SupportRequest not found");
    }

    return this.orchestrator.replyToSupportRequest({
      supportRequestId: input.supportRequestId,
      actorUserId: input.actorUserId ?? null,
      authorRole: EnumSupportActorRole.ADMIN,
      message: this.trimRequiredString(input.message),
      isInternal: true,
    });
  }

  async assignSupportRequest(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    actorRoles?: string[];
    assignedToUserId: string;
  }): Promise<any> {
    this.assertAdmin(input.actorRoles);

    const updated = await this.orchestrator.assignSupportRequest({
      supportRequestId: input.supportRequestId,
      actorUserId: input.actorUserId ?? null,
      assignedToUserId: input.assignedToUserId,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async changeSupportRequestStatus(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    actorRoles?: string[];
    status: EnumSupportStatus;
  }): Promise<any> {
    this.assertAdmin(input.actorRoles);

    const updated = await this.orchestrator.changeSupportRequestStatus({
      supportRequestId: input.supportRequestId,
      actorUserId: input.actorUserId ?? null,
      status: input.status,
    });

    return this.domain.findUnique({ id: updated.id });
  }
}