// src/domain/pricingCategoryRule/pricingCategoryRulePolicy.service.ts

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
export class PricingCategoryRulePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.PricingCategoryRuleCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const pricingConfigId = this.resolvePricingConfigId(row);
    if (!pricingConfigId) {
      throw new AppException(
        "pricingConfig is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    this.validateRuleCore(row);

    const pricingConfig = await this.ensurePricingConfigExists(client, pricingConfigId);

    if (pricingConfig.pricingMode !== EnumPricingConfigPricingMode.CATEGORY_ABC) {
      throw new AppException(
        "PricingCategoryRule is only allowed for CATEGORY_ABC pricing configs",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    await this.ensureUniqueCategoryForConfig(client, pricingConfigId, row.category);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.PricingCategoryRuleUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "PricingCategoryRule id is required for update");

    const existing = await client.pricingCategoryRule.findUnique({
      where: { id: id! },
      select: {
        id: true,
        pricingConfigId: true,
        category: true,
        minMiles: true,
        maxMiles: true,
        baseFee: true,
        perMileRate: true,
        flatPrice: true,
      },
    });

    this.ensureFound(existing, `PricingCategoryRule '${id}' not found`);

    if ("pricingConfig" in (data as any) || "pricingConfigId" in (data as any)) {
      throw new AppException(
        "pricingConfig relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      category: this.resolveUpdatedValue(data.category, existing!.category),
      minMiles: this.resolveUpdatedValue(data.minMiles, existing!.minMiles),
      maxMiles: this.resolveUpdatedValue(data.maxMiles, existing!.maxMiles),
      baseFee: this.resolveUpdatedValue(data.baseFee, existing!.baseFee),
      perMileRate: this.resolveUpdatedValue(data.perMileRate, existing!.perMileRate),
      flatPrice: this.resolveUpdatedValue(data.flatPrice, existing!.flatPrice),
    };

    this.validateRuleCore(merged);

    const pricingConfig = await this.ensurePricingConfigExists(
      client,
      existing!.pricingConfigId
    );

    if (pricingConfig.pricingMode !== EnumPricingConfigPricingMode.CATEGORY_ABC) {
      throw new AppException(
        "PricingCategoryRule is only allowed for CATEGORY_ABC pricing configs",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (merged.category !== existing!.category) {
      await this.ensureUniqueCategoryForConfig(
        client,
        existing!.pricingConfigId,
        merged.category,
        id!
      );
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "PricingCategoryRule id is required for delete");

    const existing = await client.pricingCategoryRule.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `PricingCategoryRule '${id}' not found`);
  }

  private validateRuleCore(row: any): void {
    this.ensureCategory(row.category);
    this.ensureNonNegativeNumber(
      row.minMiles,
      "minMiles must be a non-negative number"
    );

    if (row.maxMiles !== undefined && row.maxMiles !== null) {
      this.ensureNonNegativeNumber(
        row.maxMiles,
        "maxMiles must be a non-negative number"
      );

      if (Number(row.maxMiles) <= Number(row.minMiles)) {
        throw new AppException(
          "maxMiles must be greater than minMiles",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    const hasBaseFee = row.baseFee !== undefined && row.baseFee !== null;
    const hasPerMileRate = row.perMileRate !== undefined && row.perMileRate !== null;
    const hasFlatPrice = row.flatPrice !== undefined && row.flatPrice !== null;

    if (!hasBaseFee && !hasPerMileRate && !hasFlatPrice) {
      throw new AppException(
        "At least one pricing value is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (hasBaseFee) {
      this.ensureNonNegativeNumber(
        row.baseFee,
        "baseFee must be a non-negative number"
      );
    }

    if (hasPerMileRate) {
      this.ensureNonNegativeNumber(
        row.perMileRate,
        "perMileRate must be a non-negative number"
      );
    }

    if (hasFlatPrice) {
      this.ensureNonNegativeNumber(
        row.flatPrice,
        "flatPrice must be a non-negative number"
      );
    }
  }

  private async ensurePricingConfigExists(
    client: PrismaClient,
    pricingConfigId: string
  ): Promise<{ id: string; pricingMode: EnumPricingConfigPricingMode }> {
    const row = await client.pricingConfig.findUnique({
      where: { id: pricingConfigId },
      select: {
        id: true,
        pricingMode: true,
      },
    });

    if (!row) {
      throw new AppException(
        `PricingConfig '${pricingConfigId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private async ensureUniqueCategoryForConfig(
    client: PrismaClient,
    pricingConfigId: string,
    category: EnumPricingCategoryRuleCategory,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.pricingCategoryRule.findFirst({
      where: {
        pricingConfigId,
        category,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "category already exists for this pricingConfig",
        ErrorCodes.DUPLICATE_ENTRY,
        HttpStatus.CONFLICT
      );
    }
  }

  private resolvePricingConfigId(row: any): string | undefined {
    if (
      typeof row?.pricingConfigId === "string" &&
      row.pricingConfigId.trim().length > 0
    ) {
      return row.pricingConfigId.trim();
    }

    if (row?.pricingConfig?.connect?.id) {
      return row.pricingConfig.connect.id;
    }

    return undefined;
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