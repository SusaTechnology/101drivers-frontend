// src/evidenceExport/evidenceExport.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  EvidenceExport as PrismaEvidenceExport,
  Prisma,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { EvidenceExportServiceBase } from "./base/evidenceExport.service.base";
import { EvidenceExportDomain } from "../domain/evidenceExport/evidenceExport.domain";
import { EvidenceExportPolicyService } from "../domain/evidenceExport/evidenceExportPolicy.service";

@Injectable()
export class EvidenceExportService extends EvidenceExportServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: EvidenceExportDomain,
    private readonly policy: EvidenceExportPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.EvidenceExportCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.evidenceExport.count(args);
  }

  async evidenceExports(args: Prisma.EvidenceExportFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async evidenceExport(args: Prisma.EvidenceExportFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createEvidenceExport(args: Prisma.EvidenceExportCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.evidenceExport.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateEvidenceExport(args: Prisma.EvidenceExportUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.evidenceExport.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteEvidenceExport(
    args: Prisma.EvidenceExportDeleteArgs
  ): Promise<PrismaEvidenceExport> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.evidenceExport.delete(args);
  }

  async getCreatedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.evidenceExport
      .findUnique({ where: { id: parentId } })
      .createdBy();
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.evidenceExport
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  private normalizeCreateData(
    data: Prisma.EvidenceExportCreateArgs["data"]
  ): Prisma.EvidenceExportCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.url = this.trimOptionalString(normalized.url);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.EvidenceExportUpdateArgs["data"]
  ): Prisma.EvidenceExportUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "url");

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