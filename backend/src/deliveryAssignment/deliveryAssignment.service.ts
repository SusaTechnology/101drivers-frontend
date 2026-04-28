// src/deliveryAssignment/deliveryAssignment.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryAssignment as PrismaDeliveryAssignment,
  DeliveryRequest as PrismaDeliveryRequest,
  Driver as PrismaDriver,
  Prisma,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DeliveryAssignmentServiceBase } from "./base/deliveryAssignment.service.base";
import { DeliveryAssignmentDomain } from "../domain/deliveryAssignment/deliveryAssignment.domain";
import { DeliveryAssignmentPolicyService } from "../domain/deliveryAssignment/deliveryAssignmentPolicy.service";

@Injectable()
export class DeliveryAssignmentService extends DeliveryAssignmentServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DeliveryAssignmentDomain,
    private readonly policy: DeliveryAssignmentPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DeliveryAssignmentCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.deliveryAssignment.count(args);
  }

  async deliveryAssignments(args: Prisma.DeliveryAssignmentFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async deliveryAssignment(args: Prisma.DeliveryAssignmentFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDeliveryAssignment(args: Prisma.DeliveryAssignmentCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.deliveryAssignment.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDeliveryAssignment(args: Prisma.DeliveryAssignmentUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.deliveryAssignment.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDeliveryAssignment(
    args: Prisma.DeliveryAssignmentDeleteArgs
  ): Promise<PrismaDeliveryAssignment> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.deliveryAssignment.delete(args);
  }

  async getAssignedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.deliveryAssignment
      .findUnique({ where: { id: parentId } })
      .assignedBy();
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.deliveryAssignment
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.deliveryAssignment
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  private normalizeCreateData(
    data: Prisma.DeliveryAssignmentCreateArgs["data"]
  ): Prisma.DeliveryAssignmentCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.reason = this.trimOptionalString(normalized.reason);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DeliveryAssignmentUpdateArgs["data"]
  ): Prisma.DeliveryAssignmentUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "reason");

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