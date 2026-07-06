// src/domain/dealerLead/dealerLeadPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DealerLeadPolicyService {
  async beforeCreate(
    _client: PrismaClient,
    data: Prisma.DealerLeadCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureRequiredString(row.businessName, "businessName is required");
    this.ensureValidEmail(row.email, "email is invalid");
    this.ensureOptionalPhone(row.phone);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DealerLeadUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DealerLead id is required for update");

    const existing = await client.dealerLead.findUnique({
      where: { id: id! },
      select: {
        id: true,
        businessName: true,
        email: true,
        phone: true,
        message: true,
      },
    });

    this.ensureFound(existing, `DealerLead '${id}' not found`);

    const merged = {
      businessName: this.resolveUpdatedValue(data.businessName, existing!.businessName),
      email: this.resolveUpdatedValue(data.email, existing!.email),
      phone: this.resolveUpdatedValue(data.phone, existing!.phone),
    };

    this.ensureRequiredString(merged.businessName, "businessName is required");
    this.ensureValidEmail(merged.email, "email is invalid");
    this.ensureOptionalPhone(merged.phone);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DealerLead id is required for delete");

    const existing = await client.dealerLead.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DealerLead '${id}' not found`);
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

  private ensureOptionalPhone(value: unknown): void {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        "phone is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const phone = value.trim();
    if (phone.length === 0) {
      return;
    }

    if (phone.length < 5) {
      throw new AppException(
        "phone is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
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