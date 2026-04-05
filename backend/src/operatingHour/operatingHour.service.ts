// src/operatingHour/operatingHour.service.ts

import { Injectable } from "@nestjs/common";
import { OperatingHour as PrismaOperatingHour, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { OperatingHourServiceBase } from "./base/operatingHour.service.base";
import { OperatingHourDomain } from "../domain/operationgHour/operatingHour.domain";
import { OperatingHourPolicyService } from "../domain/operationgHour/operatingHourPolicy.service";

@Injectable()
export class OperatingHourService extends OperatingHourServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: OperatingHourDomain,
    private readonly policy: OperatingHourPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.OperatingHourCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.operatingHour.count(args);
  }

  async operatingHours(args: Prisma.OperatingHourFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async operatingHour(args: Prisma.OperatingHourFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createOperatingHour(args: Prisma.OperatingHourCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.operatingHour.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateOperatingHour(args: Prisma.OperatingHourUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.operatingHour.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteOperatingHour(
    args: Prisma.OperatingHourDeleteArgs
  ): Promise<PrismaOperatingHour> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.operatingHour.delete(args);
  }

  private normalizeCreateData(
    data: Prisma.OperatingHourCreateArgs["data"]
  ): Prisma.OperatingHourCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.startTime = this.trimRequiredString(normalized.startTime);
    normalized.endTime = this.trimRequiredString(normalized.endTime);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.OperatingHourUpdateArgs["data"]
  ): Prisma.OperatingHourUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "startTime");
    this.normalizeUpdateStringField(normalized, "endTime");

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

async getAdminOperatingHours(query: {
  active?: boolean;
  dayOfWeek?: number;
}) {
  const where: Prisma.OperatingHourWhereInput = {
    ...(typeof query.active === "boolean" ? { active: query.active } : {}),
    ...(typeof query.dayOfWeek === "number" ? { dayOfWeek: query.dayOfWeek } : {}),
  };

  return this.domain.findMany({
    where,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

async getActiveOperatingHours() {
  return this.domain.findMany({
    where: { active: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

async getWeeklyOperatingHours() {
  const rows = await this.domain.findMany({
    where: {},
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const grouped = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i + 1,
    items: rows.filter((row: any) => row.dayOfWeek === i + 1),
  }));

  return {
    days: grouped,
  };
}

async upsertAdminOperatingHour(input: {
  id?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active?: boolean;
}) {
  const data: Prisma.OperatingHourCreateInput = {
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime.trim(),
    endTime: input.endTime.trim(),
    active: input.active ?? true,
  };

  if (input.id) {
    const updateData: Prisma.OperatingHourUpdateInput = {
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      active: data.active,
    };

    await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

    const updated = await this.prisma.operatingHour.update({
      where: { id: input.id },
      data: updateData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  await this.policy.beforeCreate(this.prisma as any, data);

  const created = await this.prisma.operatingHour.create({
    data,
  });

  return this.domain.findUnique({ id: created.id });
}

async activateOperatingHour(input: { id: string; actorUserId?: string | null }) {
  const updateData: Prisma.OperatingHourUpdateInput = { active: true };

  await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

  const updated = await this.prisma.operatingHour.update({
    where: { id: input.id },
    data: updateData,
  });

  return this.domain.findUnique({ id: updated.id });
}

async deactivateOperatingHour(input: { id: string; actorUserId?: string | null }) {
  const updateData: Prisma.OperatingHourUpdateInput = { active: false };

  await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

  const updated = await this.prisma.operatingHour.update({
    where: { id: input.id },
    data: updateData,
  });

  return this.domain.findUnique({ id: updated.id });
}
}