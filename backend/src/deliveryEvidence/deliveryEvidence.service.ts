// src/deliveryEvidence/deliveryEvidence.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryEvidence as PrismaDeliveryEvidence,
  DeliveryRequest as PrismaDeliveryRequest,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DeliveryEvidenceServiceBase } from "./base/deliveryEvidence.service.base";
import { DeliveryEvidenceDomain } from "../domain/deliveryEvidence/deliveryEvidence.domain";
import { DeliveryEvidencePolicyService } from "../domain/deliveryEvidence/deliveryEvidencePolicy.service";

@Injectable()
export class DeliveryEvidenceService extends DeliveryEvidenceServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DeliveryEvidenceDomain,
    private readonly policy: DeliveryEvidencePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DeliveryEvidenceCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.deliveryEvidence.count(args);
  }

  async deliveryEvidences(args: Prisma.DeliveryEvidenceFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async deliveryEvidence(args: Prisma.DeliveryEvidenceFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDeliveryEvidence(args: Prisma.DeliveryEvidenceCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.deliveryEvidence.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDeliveryEvidence(args: Prisma.DeliveryEvidenceUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.deliveryEvidence.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDeliveryEvidence(
    args: Prisma.DeliveryEvidenceDeleteArgs
  ): Promise<PrismaDeliveryEvidence> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.deliveryEvidence.delete(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.deliveryEvidence
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  private normalizeCreateData(
    data: Prisma.DeliveryEvidenceCreateArgs["data"]
  ): Prisma.DeliveryEvidenceCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.imageUrl = this.trimOptionalString(normalized.imageUrl);
    normalized.value = this.trimOptionalString(normalized.value);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DeliveryEvidenceUpdateArgs["data"]
  ): Prisma.DeliveryEvidenceUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "imageUrl");
    this.normalizeUpdateStringField(normalized, "value");

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