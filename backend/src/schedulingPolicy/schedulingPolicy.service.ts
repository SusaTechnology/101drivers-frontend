import { Injectable } from "@nestjs/common";
import {
  EnumCustomerCustomerType,
  EnumDeliveryRequestCustomerChose,
  EnumDeliveryRequestServiceType,
  EnumSchedulingPolicyCustomerType,
  EnumSchedulingPolicyDefaultMode,
  EnumSchedulingPolicyServiceType,
  Prisma,
  SchedulingPolicy as PrismaSchedulingPolicy,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { SchedulingPolicyServiceBase } from "./base/schedulingPolicy.service.base";
import { SchedulingPolicyDomain } from "../domain/schedulingPolicy/schedulingPolicy.domain";
import { SchedulingPolicyPolicyService } from "../domain/schedulingPolicy/schedulingPolicyPolicy.service";
import { SchedulingPolicyEngine } from "../domain/schedulingPolicy/schedulingPolicy.engine";

@Injectable()
export class SchedulingPolicyService extends SchedulingPolicyServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: SchedulingPolicyDomain,
    private readonly policy: SchedulingPolicyPolicyService,
    private readonly engine: SchedulingPolicyEngine
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.SchedulingPolicyCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.schedulingPolicy.count(args);
  }

  async schedulingPolicies(
    args: Prisma.SchedulingPolicyFindManyArgs
  ): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async schedulingPolicy(
    args: Prisma.SchedulingPolicyFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createSchedulingPolicy(
    args: Prisma.SchedulingPolicyCreateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.schedulingPolicy.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateSchedulingPolicy(
    args: Prisma.SchedulingPolicyUpdateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.schedulingPolicy.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteSchedulingPolicy(
    args: Prisma.SchedulingPolicyDeleteArgs
  ): Promise<PrismaSchedulingPolicy> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.schedulingPolicy.delete(args);
  }

  private normalizeCreateData(
    data: Prisma.SchedulingPolicyCreateArgs["data"]
  ): Prisma.SchedulingPolicyCreateArgs["data"] {
    const normalized: any = { ...data };
    normalized.sameDayCutoffTime = this.trimOptionalString(
      normalized.sameDayCutoffTime
    );
    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.SchedulingPolicyUpdateArgs["data"]
  ): Prisma.SchedulingPolicyUpdateArgs["data"] {
    const normalized: any = { ...data };
    this.normalizeUpdateStringField(normalized, "sameDayCutoffTime");
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
    if (!(field in target)) return;

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

  // -----------------------------
  // Admin custom endpoints support
  // -----------------------------

  async getAdminSchedulingPolicies(query: {
    active?: boolean;
    customerType?: EnumSchedulingPolicyCustomerType;
    serviceType?: EnumSchedulingPolicyServiceType | null;
  }) {
    const where: Prisma.SchedulingPolicyWhereInput = {
      ...(typeof query.active === "boolean" ? { active: query.active } : {}),
      ...(query.customerType ? { customerType: query.customerType } : {}),
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    };

    return this.domain.findMany({
      where,
      orderBy: [{ customerType: "asc" }, { serviceType: "asc" }, { createdAt: "desc" }],
    });
  }

  async getActiveSchedulingPolicies() {
    return this.domain.findMany({
      where: { active: true },
      orderBy: [{ customerType: "asc" }, { serviceType: "asc" }, { createdAt: "desc" }],
    });
  }

  async getSchedulingPolicySummary() {
    const total = await this.prisma.schedulingPolicy.count();
    const active = await this.prisma.schedulingPolicy.count({
      where: { active: true },
    });

    const byCustomerType = await this.prisma.schedulingPolicy.groupBy({
      by: ["customerType"],
      _count: { _all: true },
    });

    const byServiceType = await this.prisma.schedulingPolicy.groupBy({
      by: ["serviceType"],
      _count: { _all: true },
    });

    return {
      totalPolicies: total,
      activePolicies: active,
      inactivePolicies: total - active,
      byCustomerType: byCustomerType.map((row) => ({
        customerType: row.customerType,
        count: row._count._all,
      })),
      byServiceType: byServiceType.map((row) => ({
        serviceType: row.serviceType,
        count: row._count._all,
      })),
    };
  }

  async upsertAdminSchedulingPolicy(input: {
    id?: string | null;
    customerType?: EnumSchedulingPolicyCustomerType;
    serviceType?: EnumSchedulingPolicyServiceType | null;
    defaultMode: EnumSchedulingPolicyDefaultMode;
    sameDayCutoffTime?: string | null;
    maxSameDayMiles?: number | null;
    bufferMinutes: number;
    afterHoursEnabled: boolean;
    requiresOpsConfirmation: boolean;
    active?: boolean;
  }) {
    const createData: Prisma.SchedulingPolicyCreateInput = {
      customerType: input.customerType!,
      defaultMode: input.defaultMode,
      bufferMinutes: input.bufferMinutes,
      afterHoursEnabled: input.afterHoursEnabled,
      requiresOpsConfirmation: input.requiresOpsConfirmation,
      active: input.active ?? true,
      sameDayCutoffTime: this.trimOptionalString(input.sameDayCutoffTime),
      ...(input.serviceType ? { serviceType: input.serviceType } : {}),
      ...(input.maxSameDayMiles !== undefined
        ? { maxSameDayMiles: input.maxSameDayMiles }
        : {}),
    };

    if (input.id) {
      const updateData: Prisma.SchedulingPolicyUpdateInput = {
        customerType: createData.customerType,
        defaultMode: createData.defaultMode,
        bufferMinutes: createData.bufferMinutes,
        afterHoursEnabled: createData.afterHoursEnabled,
        requiresOpsConfirmation: createData.requiresOpsConfirmation,
        active: createData.active,
        sameDayCutoffTime: createData.sameDayCutoffTime,
        serviceType: input.serviceType ?? null,
        maxSameDayMiles:
          input.maxSameDayMiles !== undefined ? input.maxSameDayMiles : undefined,
      };

      await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

      const updated = await this.prisma.schedulingPolicy.update({
        where: { id: input.id },
        data: updateData,
      });

      return this.domain.findUnique({ id: updated.id });
    }

    await this.policy.beforeCreate(this.prisma as any, createData);

    const created = await this.prisma.schedulingPolicy.create({
      data: createData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async activateSchedulingPolicy(input: {
    id: string;
    actorUserId?: string | null;
  }) {
    const updateData: Prisma.SchedulingPolicyUpdateInput = {
      active: true,
    };

    await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

    const policy = await this.prisma.schedulingPolicy.update({
      where: { id: input.id },
      data: updateData,
    });

    return this.domain.findUnique({ id: policy.id });
  }

  async deactivateSchedulingPolicy(input: {
    id: string;
    actorUserId?: string | null;
  }) {
    const updateData: Prisma.SchedulingPolicyUpdateInput = {
      active: false,
    };

    await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

    const policy = await this.prisma.schedulingPolicy.update({
      where: { id: input.id },
      data: updateData,
    });

    return this.domain.findUnique({ id: policy.id });
  }

  // -----------------------------
  // Engine-backed methods
  // -----------------------------

  async getEffectiveSchedulingPolicy(input: {
    customerId?: string | null;
    customerType?: EnumCustomerCustomerType;
    serviceType?: EnumDeliveryRequestServiceType | null;
  }) {
    let customerType = input.customerType;

    if (!customerType && input.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, customerType: true },
      });

      customerType = customer?.customerType;
    }

    if (!customerType) {
      throw new Error("customerType or customerId is required");
    }

    return this.engine.resolveEffectivePolicy({
      customerType,
      serviceType: input.serviceType ?? null,
    });
  }

  async previewScheduling(input: {
    customerId?: string | null;
    customerType?: EnumCustomerCustomerType;
    serviceType?: EnumDeliveryRequestServiceType | null;
    requestCreatedAt?: Date;
    distanceMiles?: number | null;
    etaMinutes?: number | null;
    customerChose: EnumDeliveryRequestCustomerChose;
    pickupWindowStart?: Date | null;
    pickupWindowEnd?: Date | null;
    dropoffWindowStart?: Date | null;
    dropoffWindowEnd?: Date | null;
    afterHoursRequested?: boolean;
  }) {
    let customerType = input.customerType;

    if (!customerType && input.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, customerType: true },
      });

      customerType = customer?.customerType;
    }

    if (!customerType) {
      throw new Error("customerType or customerId is required");
    }

    return this.engine.previewSchedule({
      customerType,
      serviceType: input.serviceType ?? null,
      requestCreatedAt: input.requestCreatedAt,
      distanceMiles: input.distanceMiles ?? null,
      etaMinutes: input.etaMinutes ?? null,
      customerChose: input.customerChose,
      pickupWindowStart: input.pickupWindowStart ?? null,
      pickupWindowEnd: input.pickupWindowEnd ?? null,
      dropoffWindowStart: input.dropoffWindowStart ?? null,
      dropoffWindowEnd: input.dropoffWindowEnd ?? null,
      afterHoursRequested: input.afterHoursRequested ?? false,
    });
  }
}