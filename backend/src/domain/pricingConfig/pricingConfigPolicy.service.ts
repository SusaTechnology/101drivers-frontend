// src/domain/pricingConfig/pricingConfigPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumPricingCategoryRuleCategory,
  EnumPricingConfigPricingMode,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class PricingConfigPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.PricingConfigCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.validateConfigCore(row);
    this.validateModeSpecificConfig(row);

    await this.ensureNameUniqueIfProvided(client, this.resolveCreateString(row.name));
    this.validateNestedCreates(row);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.PricingConfigUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "PricingConfig id is required for update");

    const existing = await client.pricingConfig.findUnique({
      where: { id: id! },
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        pricingMode: true,
        baseFee: true,
        perMileRate: true,
        insuranceFee: true,
        transactionFeePct: true,
        transactionFeeFixed: true,
        feePassThrough: true,
        driverSharePct: true,
      },
    });

    this.ensureFound(existing, `PricingConfig '${id}' not found`);

    const merged = {
      name: this.resolveUpdatedValue(data.name, existing!.name),
      description: this.resolveUpdatedValue(data.description, existing!.description),
      active: this.resolveUpdatedValue(data.active, existing!.active),
      pricingMode: this.resolveUpdatedValue(data.pricingMode, existing!.pricingMode),
      baseFee: this.resolveUpdatedValue(data.baseFee, existing!.baseFee),
      perMileRate: this.resolveUpdatedValue(data.perMileRate, existing!.perMileRate),
      insuranceFee: this.resolveUpdatedValue(data.insuranceFee, existing!.insuranceFee),
      transactionFeePct: this.resolveUpdatedValue(
        data.transactionFeePct,
        existing!.transactionFeePct
      ),
      transactionFeeFixed: this.resolveUpdatedValue(
        data.transactionFeeFixed,
        existing!.transactionFeeFixed
      ),
      feePassThrough: this.resolveUpdatedValue(
        data.feePassThrough,
        existing!.feePassThrough
      ),
      driverSharePct: this.resolveUpdatedValue(
        data.driverSharePct,
        existing!.driverSharePct
      ),
    };

    this.validateConfigCore(merged);
    this.validateModeSpecificConfig(merged);

    const nextName = this.resolveScalarUpdateString(data.name);
    if (nextName && nextName !== existing!.name) {
      await this.ensureNameUniqueIfProvided(client, nextName, id!);
    }

    this.validateNestedUpdates(data);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "PricingConfig id is required for delete");

    const existing = await client.pricingConfig.findUnique({
      where: { id: id! },
      select: {
        id: true,
        _count: {
          select: {
            categoryRules: true,
            customers: true,
            tiers: true,
          },
        },
      },
    });

    this.ensureFound(existing, `PricingConfig '${id}' not found`);

    if (
      existing!._count.categoryRules > 0 ||
      existing!._count.customers > 0 ||
      existing!._count.tiers > 0
    ) {
      throw new AppException(
        "PricingConfig cannot be deleted because related records exist",
        ErrorCodes.STILL_IN_USE,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateConfigCore(row: any): void {
    this.ensurePricingMode(row.pricingMode);

    this.ensureNonNegativeNumber(row.baseFee, "baseFee must be a non-negative number");
    this.ensureNonNegativeNumber(
      row.insuranceFee,
      "insuranceFee must be a non-negative number"
    );
    this.ensurePercent(
      row.driverSharePct,
      "driverSharePct must be between 0 and 100"
    );

    if (row.transactionFeePct !== undefined && row.transactionFeePct !== null) {
      this.ensureNonNegativeNumber(
        row.transactionFeePct,
        "transactionFeePct must be a non-negative number"
      );
    }

    if (row.transactionFeeFixed !== undefined && row.transactionFeeFixed !== null) {
      this.ensureNonNegativeNumber(
        row.transactionFeeFixed,
        "transactionFeeFixed must be a non-negative number"
      );
    }
  }

  private validateModeSpecificConfig(row: any): void {
    if (row.pricingMode === EnumPricingConfigPricingMode.PER_MILE) {
      this.ensureNonNegativeNumber(
        row.perMileRate,
        "perMileRate is required for PER_MILE pricing mode"
      );
    }

    if (
      row.pricingMode === EnumPricingConfigPricingMode.FLAT_TIER &&
      row.perMileRate !== undefined &&
      row.perMileRate !== null
    ) {
      throw new AppException(
        "perMileRate is not allowed for FLAT_TIER pricing mode",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateNestedCreates(row: any): void {
    if (row.tiers?.create) {
      this.validateTierCreateArray(row.tiers.create);
    }

    if (row.categoryRules?.create) {
      this.validateCategoryRuleCreateArray(row.categoryRules.create);
    }
  }

  private validateNestedUpdates(data: Prisma.PricingConfigUpdateArgs["data"]): void {
    const row = data as any;

    if (row.tiers?.create) {
      this.validateTierCreateArray(row.tiers.create);
    }

    if (row.categoryRules?.create) {
      this.validateCategoryRuleCreateArray(row.categoryRules.create);
    }
  }

  private validateTierCreateArray(input: any): void {
    const rows = Array.isArray(input) ? input : [input];

    const normalized = rows.map((row) => ({
      minMiles: row.minMiles,
      maxMiles: row.maxMiles,
      flatPrice: row.flatPrice,
    }));

    for (const row of normalized) {
      this.ensureNonNegativeNumber(
        row.minMiles,
        "tier minMiles must be a non-negative number"
      );

      if (row.maxMiles !== undefined && row.maxMiles !== null) {
        this.ensureNonNegativeNumber(
          row.maxMiles,
          "tier maxMiles must be a non-negative number"
        );

        if (Number(row.maxMiles) <= Number(row.minMiles)) {
          throw new AppException(
            "tier maxMiles must be greater than minMiles",
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      this.ensureNonNegativeNumber(
        row.flatPrice,
        "tier flatPrice must be a non-negative number"
      );
    }

    const sorted = [...normalized].sort((a, b) => Number(a.minMiles) - Number(b.minMiles));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (prev.maxMiles !== undefined && prev.maxMiles !== null) {
        if (Number(curr.minMiles) < Number(prev.maxMiles)) {
          throw new AppException(
            "tier ranges must not overlap",
            ErrorCodes.CONFLICT
          );
        }
      }
    }
  }

  private validateCategoryRuleCreateArray(input: any): void {
    const rows = Array.isArray(input) ? input : [input];
    const seen = new Set<string>();

    for (const row of rows) {
      this.ensureCategory(row.category);

      if (seen.has(row.category)) {
        throw new AppException(
          "duplicate categoryRules category is not allowed",
          ErrorCodes.DUPLICATE_ENTRY,
          HttpStatus.CONFLICT
        );
      }
      seen.add(row.category);

      this.ensureNonNegativeNumber(
        row.minMiles,
        "categoryRule minMiles must be a non-negative number"
      );

      if (row.maxMiles !== undefined && row.maxMiles !== null) {
        this.ensureNonNegativeNumber(
          row.maxMiles,
          "categoryRule maxMiles must be a non-negative number"
        );

        if (Number(row.maxMiles) <= Number(row.minMiles)) {
          throw new AppException(
            "categoryRule maxMiles must be greater than minMiles",
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      const hasBaseFee = row.baseFee !== undefined && row.baseFee !== null;
      const hasPerMileRate = row.perMileRate !== undefined && row.perMileRate !== null;
      const hasFlatPrice = row.flatPrice !== undefined && row.flatPrice !== null;

      if (!hasBaseFee && !hasPerMileRate && !hasFlatPrice) {
        throw new AppException(
          "categoryRule must define at least one pricing value",
          ErrorCodes.VALIDATION_ERROR
        );
      }

      if (hasBaseFee) {
        this.ensureNonNegativeNumber(
          row.baseFee,
          "categoryRule baseFee must be a non-negative number"
        );
      }

      if (hasPerMileRate) {
        this.ensureNonNegativeNumber(
          row.perMileRate,
          "categoryRule perMileRate must be a non-negative number"
        );
      }

      if (hasFlatPrice) {
        this.ensureNonNegativeNumber(
          row.flatPrice,
          "categoryRule flatPrice must be a non-negative number"
        );
      }
    }
  }

  private async ensureNameUniqueIfProvided(
    client: PrismaClient,
    name?: string,
    excludeId?: string
  ): Promise<void> {
    if (!name) {
      return;
    }

    const existing = await client.pricingConfig.findFirst({
      where: {
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "PricingConfig name already exists",
        ErrorCodes.DUPLICATE_NAME,
        HttpStatus.CONFLICT
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

  private ensurePricingMode(value: unknown): void {
    if (
      value !== EnumPricingConfigPricingMode.PER_MILE &&
      value !== EnumPricingConfigPricingMode.FLAT_TIER &&
      value !== EnumPricingConfigPricingMode.CATEGORY_ABC
    ) {
      throw new AppException(
        "pricingMode is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureCategory(value: unknown): void {
    if (
      value !== EnumPricingCategoryRuleCategory.A &&
      value !== EnumPricingCategoryRuleCategory.B &&
      value !== EnumPricingCategoryRuleCategory.C
    ) {
      throw new AppException(
        "category is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureNonNegativeNumber(value: unknown, message: string): void {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

    if (!Number.isFinite(num) || num < 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensurePercent(value: unknown, message: string): void {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

    if (!Number.isFinite(num) || num < 0 || num > 100) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
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

  private resolveCreateString(value: any): string | undefined {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private resolveScalarUpdateString(value: any): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof value === "object" && "set" in value) {
      if (typeof value.set === "string") {
        const trimmed = value.set.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      return undefined;
    }

    return undefined;
  }
}