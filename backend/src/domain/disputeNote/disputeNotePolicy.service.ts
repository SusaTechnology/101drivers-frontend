// src/domain/disputeNote/disputeNotePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDisputeCaseStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DisputeNotePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DisputeNoteCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const disputeId = this.resolveRelationId(row.dispute, row.disputeId);
    if (!disputeId) {
      throw new AppException(
        "dispute is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const dispute = await this.ensureDisputeExists(client, disputeId);

    this.ensureRequiredString(row.note, "note is required");

    const authorUserId = this.resolveRelationId(row.author, row.authorUserId);
    if (authorUserId) {
      await this.ensureUserExists(client, authorUserId, "author");
    }

    this.validateDisputeAllowsNotes(dispute.status);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DisputeNoteUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DisputeNote id is required for update");

    const existing = await client.disputeNote.findUnique({
      where: { id: id! },
      select: {
        id: true,
        disputeId: true,
        authorUserId: true,
        note: true,
        dispute: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DisputeNote '${id}' not found`);

    if ("dispute" in (data as any) || "disputeId" in (data as any)) {
      throw new AppException(
        "dispute relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("author" in (data as any) || "authorUserId" in (data as any)) {
      throw new AppException(
        "author relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      note: this.resolveUpdatedValue(data.note, existing!.note),
    };

    this.ensureRequiredString(merged.note, "note is required");
    this.validateDisputeAllowsNotes(existing!.dispute.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DisputeNote id is required for delete");

    const existing = await client.disputeNote.findUnique({
      where: { id: id! },
      select: {
        id: true,
        dispute: {
          select: {
            legalHold: true,
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DisputeNote '${id}' not found`);

    if (existing!.dispute.legalHold) {
      throw new AppException(
        "DisputeNote cannot be deleted while the dispute is under legal hold",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }

    if (existing!.dispute.status === EnumDisputeCaseStatus.CLOSED) {
      throw new AppException(
        "DisputeNote cannot be deleted from a closed dispute",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }
  }

  private async ensureDisputeExists(client: PrismaClient, disputeId: string) {
    const row = await client.disputeCase.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!row) {
      throw new AppException(
        `DisputeCase '${disputeId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private async ensureUserExists(
    client: PrismaClient,
    userId: string,
    label: string
  ): Promise<void> {
    const row = await client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `${label} user not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private validateDisputeAllowsNotes(status: EnumDisputeCaseStatus): void {
    if (status === EnumDisputeCaseStatus.CLOSED) {
      throw new AppException(
        "DisputeNote is not allowed when dispute status is CLOSED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private resolveRelationId(relation: any, scalar: any): string | undefined {
    if (typeof scalar === "string" && scalar.trim().length > 0) {
      return scalar.trim();
    }

    if (relation?.connect?.id) {
      return relation.connect.id;
    }

    return undefined;
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensureId(id: string | undefined, message: string): void {
    if (!id) {
      throw new AppException(message, ErrorCodes.INVALID_PARAMS);
    }
  }

  private ensureFound(record: any, message: string): void {
    if (!record) {
      throw new AppException(message, ErrorCodes.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
  }

  private resolveUpdatedValue(nextValue: any, currentValue: any): any {
    if (nextValue === undefined) {
      return currentValue;
    }

    if (nextValue && typeof nextValue === "object" && "set" in nextValue) {
      return nextValue.set;
    }

    return nextValue;
  }
}