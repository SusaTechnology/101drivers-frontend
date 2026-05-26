// src/domain/investorLead/investorLeadPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class InvestorLeadPolicyService {
  async beforeCreate(
    _client: PrismaClient,
    data: Prisma.InvestorLeadCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureRequiredString(row.name, "name is required");
    this.ensureValidEmail(row.email, "email is invalid");
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.InvestorLeadUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "InvestorLead id is required for update");

    const existing = await client.investorLead.findUnique({
      where: { id: id! },
      select: {
        id: true,
        name: true,
        email: true,
        message: true,
      },
    });

    this.ensureFound(existing, `InvestorLead '${id}' not found`);

    const merged = {
      name: this.resolveUpdatedValue(data.name, existing!.name),
      email: this.resolveUpdatedValue(data.email, existing!.email),
    };

    this.ensureRequiredString(merged.name, "name is required");
    this.ensureValidEmail(merged.email, "email is invalid");
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "InvestorLead id is required for delete");

    const existing = await client.investorLead.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `InvestorLead '${id}' not found`);
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensureValidEmail(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }

    const email = value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
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