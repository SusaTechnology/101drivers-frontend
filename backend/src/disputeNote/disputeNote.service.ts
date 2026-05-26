// src/disputeNote/disputeNote.service.ts

import { Injectable } from "@nestjs/common";
import {
  DisputeCase as PrismaDisputeCase,
  DisputeNote as PrismaDisputeNote,
  Prisma,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DisputeNoteServiceBase } from "./base/disputeNote.service.base";
import { DisputeNoteDomain } from "../domain/disputeNote/disputeNote.domain";
import { DisputeNotePolicyService } from "../domain/disputeNote/disputeNotePolicy.service";

@Injectable()
export class DisputeNoteService extends DisputeNoteServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DisputeNoteDomain,
    private readonly policy: DisputeNotePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DisputeNoteCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.disputeNote.count(args);
  }

  async disputeNotes(args: Prisma.DisputeNoteFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async disputeNote(args: Prisma.DisputeNoteFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDisputeNote(args: Prisma.DisputeNoteCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.disputeNote.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDisputeNote(args: Prisma.DisputeNoteUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.disputeNote.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDisputeNote(
    args: Prisma.DisputeNoteDeleteArgs
  ): Promise<PrismaDisputeNote> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.disputeNote.delete(args);
  }

  async getAuthor(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.disputeNote
      .findUnique({ where: { id: parentId } })
      .author();
  }

  async getDispute(parentId: string): Promise<PrismaDisputeCase | null> {
    return this.prisma.disputeNote
      .findUnique({ where: { id: parentId } })
      .dispute();
  }

  private normalizeCreateData(
    data: Prisma.DisputeNoteCreateArgs["data"]
  ): Prisma.DisputeNoteCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.note = this.trimRequiredString(normalized.note);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DisputeNoteUpdateArgs["data"]
  ): Prisma.DisputeNoteUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "note");

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
}