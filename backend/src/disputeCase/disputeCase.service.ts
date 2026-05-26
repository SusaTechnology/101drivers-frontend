// src/disputeCase/disputeCase.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  DisputeCase as PrismaDisputeCase,
  DisputeNote as PrismaDisputeNote,
  Prisma,
} from "@prisma/client";
import { EnumDisputeCaseStatus } from "@prisma/client";
import { DisputeAdminEngine } from "../domain/disputeCase/disputeAdmin.engine";

import { PrismaService } from "../prisma/prisma.service";
import { DisputeCaseServiceBase } from "./base/disputeCase.service.base";
import { DisputeCaseDomain } from "../domain/disputeCase/disputeCase.domain";
import { DisputeCasePolicyService } from "../domain/disputeCase/disputeCasePolicy.service";

@Injectable()
export class DisputeCaseService extends DisputeCaseServiceBase {
constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: DisputeCaseDomain,
  private readonly policy: DisputeCasePolicyService,
  private readonly disputeAdminEngine: DisputeAdminEngine
) {
  super(prisma);
}


  async count(
    args: Omit<Prisma.DisputeCaseCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.disputeCase.count(args);
  }

  async disputeCases(args: Prisma.DisputeCaseFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async disputeCase(args: Prisma.DisputeCaseFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDisputeCase(args: Prisma.DisputeCaseCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.disputeCase.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDisputeCase(args: Prisma.DisputeCaseUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.disputeCase.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDisputeCase(
    args: Prisma.DisputeCaseDeleteArgs
  ): Promise<PrismaDisputeCase> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.disputeCase.delete(args);
  }

  async findNotes(
    parentId: string,
    args: Prisma.DisputeNoteFindManyArgs
  ): Promise<PrismaDisputeNote[]> {
    return this.prisma.disputeCase
      .findUniqueOrThrow({ where: { id: parentId } })
      .notes(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.disputeCase
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  private normalizeCreateData(
    data: Prisma.DisputeCaseCreateArgs["data"]
  ): Prisma.DisputeCaseCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.reason = this.trimRequiredString(normalized.reason);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DisputeCaseUpdateArgs["data"]
  ): Prisma.DisputeCaseUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "reason");

    return normalized;
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }
    return value.trim();
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
        set: this.trimRequiredString(raw.set),
      };
      return;
    }

    target[field] = this.trimRequiredString(raw);
  }
async adminOpenDispute(input: {
  deliveryId: string;
  reason: string;
  actorUserId?: string | null;
}): Promise<any> {
  const disputeId = await this.disputeAdminEngine.openDispute({
    deliveryId: input.deliveryId,
    reason: input.reason,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: disputeId });
}

async adminAddNote(input: {
  disputeId: string;
  note: string;
  actorUserId?: string | null;
}): Promise<any> {
  await this.disputeAdminEngine.addDisputeNote({
    disputeId: input.disputeId,
    note: input.note,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: input.disputeId });
}

async adminUpdateStatus(input: {
  disputeId: string;
  status: EnumDisputeCaseStatus;
  note?: string | null;
  actorUserId?: string | null;
}): Promise<any> {
  await this.disputeAdminEngine.updateDisputeStatus({
    disputeId: input.disputeId,
    status: input.status,
    note: input.note ?? null,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: input.disputeId });
}

async adminResolveDispute(input: {
  disputeId: string;
  resolutionNote?: string | null;
  actorUserId?: string | null;
}): Promise<any> {
  await this.disputeAdminEngine.resolveDispute({
    disputeId: input.disputeId,
    resolutionNote: input.resolutionNote ?? null,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: input.disputeId });
}

async adminCloseDispute(input: {
  disputeId: string;
  closingNote?: string | null;
  actorUserId?: string | null;
}): Promise<any> {
  await this.disputeAdminEngine.closeDispute({
    disputeId: input.disputeId,
    closingNote: input.closingNote ?? null,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: input.disputeId });
}

async adminToggleLegalHold(input: {
  disputeId: string;
  legalHold: boolean;
  note?: string | null;
  actorUserId?: string | null;
}): Promise<any> {
  await this.disputeAdminEngine.toggleLegalHold({
    disputeId: input.disputeId,
    legalHold: input.legalHold,
    note: input.note ?? null,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: input.disputeId });
}

async adminListDisputes(input?: {
  status?: EnumDisputeCaseStatus;
}): Promise<any[]> {
  return this.domain.findMany({
    where: {
      ...(input?.status ? { status: input.status } : {}),
    },
    orderBy: { openedAt: "desc" },
  });
}

}