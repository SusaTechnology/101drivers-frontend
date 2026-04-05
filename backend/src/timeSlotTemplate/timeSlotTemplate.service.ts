// src/timeSlotTemplate/timeSlotTemplate.service.ts

import { Injectable } from "@nestjs/common";
import {
  Prisma,
  TimeSlotTemplate as PrismaTimeSlotTemplate,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TimeSlotTemplateServiceBase } from "./base/timeSlotTemplate.service.base";
import { TimeSlotTemplateDomain } from "../domain/timeSlotTemplate/timeSlotTemplate.domain";
import { TimeSlotTemplatePolicyService } from "../domain/timeSlotTemplate/timeSlotTemplatePolicy.service";

@Injectable()
export class TimeSlotTemplateService extends TimeSlotTemplateServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: TimeSlotTemplateDomain,
    private readonly policy: TimeSlotTemplatePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.TimeSlotTemplateCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.timeSlotTemplate.count(args);
  }

  async timeSlotTemplates(args: Prisma.TimeSlotTemplateFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async timeSlotTemplate(args: Prisma.TimeSlotTemplateFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createTimeSlotTemplate(args: Prisma.TimeSlotTemplateCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.timeSlotTemplate.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateTimeSlotTemplate(args: Prisma.TimeSlotTemplateUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.timeSlotTemplate.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteTimeSlotTemplate(
    args: Prisma.TimeSlotTemplateDeleteArgs
  ): Promise<PrismaTimeSlotTemplate> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.timeSlotTemplate.delete(args);
  }

  private normalizeCreateData(
    data: Prisma.TimeSlotTemplateCreateArgs["data"]
  ): Prisma.TimeSlotTemplateCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.label = this.trimRequiredString(normalized.label);
    normalized.startTime = this.trimRequiredString(normalized.startTime);
    normalized.endTime = this.trimRequiredString(normalized.endTime);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.TimeSlotTemplateUpdateArgs["data"]
  ): Prisma.TimeSlotTemplateUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "label");
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

async getAdminTimeSlotTemplates(query: {
  active?: boolean;
  label?: string;
}) {
  const where: Prisma.TimeSlotTemplateWhereInput = {
    ...(typeof query.active === "boolean" ? { active: query.active } : {}),
    ...(query.label
      ? {
          label: {
            contains: query.label,
            mode: "insensitive",
          },
        }
      : {}),
  };

  return this.domain.findMany({
    where,
    orderBy: [{ startTime: "asc" }, { label: "asc" }],
  });
}

async getActiveTimeSlotTemplates() {
  return this.domain.findMany({
    where: { active: true },
    orderBy: [{ startTime: "asc" }, { label: "asc" }],
  });
}

async getTimeSlotCatalog() {
  const rows = await this.domain.findMany({
    where: {},
    orderBy: [{ startTime: "asc" }, { label: "asc" }],
  });

  return {
    items: rows,
  };
}

async upsertAdminTimeSlotTemplate(input: {
  id?: string | null;
  label: string;
  startTime: string;
  endTime: string;
  active?: boolean;
}) {
  const data: Prisma.TimeSlotTemplateCreateInput = {
    label: input.label.trim(),
    startTime: input.startTime.trim(),
    endTime: input.endTime.trim(),
    active: input.active ?? true,
  };

  if (input.id) {
    const updateData: Prisma.TimeSlotTemplateUpdateInput = {
      label: data.label,
      startTime: data.startTime,
      endTime: data.endTime,
      active: data.active,
    };

    await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

    const updated = await this.prisma.timeSlotTemplate.update({
      where: { id: input.id },
      data: updateData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  await this.policy.beforeCreate(this.prisma as any, data);

  const created = await this.prisma.timeSlotTemplate.create({
    data,
  });

  return this.domain.findUnique({ id: created.id });
}

async activateTimeSlotTemplate(input: { id: string; actorUserId?: string | null }) {
  const updateData: Prisma.TimeSlotTemplateUpdateInput = { active: true };

  await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

  const updated = await this.prisma.timeSlotTemplate.update({
    where: { id: input.id },
    data: updateData,
  });

  return this.domain.findUnique({ id: updated.id });
}

async deactivateTimeSlotTemplate(input: { id: string; actorUserId?: string | null }) {
  const updateData: Prisma.TimeSlotTemplateUpdateInput = { active: false };

  await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

  const updated = await this.prisma.timeSlotTemplate.update({
    where: { id: input.id },
    data: updateData,
  });

  return this.domain.findUnique({ id: updated.id });
}
}