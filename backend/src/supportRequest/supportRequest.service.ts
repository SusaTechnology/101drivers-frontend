import { Injectable, NotFoundException } from "@nestjs/common";
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

  async supportRequests(args: Prisma.SupportRequestFindManyArgs): Promise<any[]> {
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
    status?: any | null;
    category?: any | null;
    priority?: any | null;
    actorRole?: any | null;
    assignedToUserId?: string | null;
    deliveryId?: string | null;
    take?: number;
    skip?: number;
  }): Promise<{ items: any[]; count: number }> {
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

    return { items, count };
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

    const created = await this.orchestrator.replyToSupportRequest({
      supportRequestId: input.supportRequestId,
      actorUserId: input.actorUserId ?? null,
      authorRole: item.actorRole,
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
    const updated = await this.orchestrator.changeSupportRequestStatus({
      supportRequestId: input.supportRequestId,
      actorUserId: input.actorUserId ?? null,
      status: input.status,
    });

    return this.domain.findUnique({ id: updated.id });
  }
}