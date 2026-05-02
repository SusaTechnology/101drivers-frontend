// src/domain/pricingTier/pricingTierPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumPricingConfigPricingMode,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class PricingTierPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.PricingTierCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const pricingConfigId = this.resolvePricingConfigId(row);
    if (!pricingConfigId) {
      throw new AppException(
        "pricingConfig is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    this.ensureNonNegativeNumber(
      row.minMiles,
      "minMiles must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      row.flatPrice,
      "flatPrice must be a non-negative number"
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

    const pricingConfig = await this.ensurePricingConfigExists(client, pricingConfigId);

    if (pricingConfig.pricingMode !== EnumPricingConfigPricingMode.FLAT_TIER) {
      throw new AppException(
        "PricingTier is only allowed for FLAT_TIER pricing configs",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    await this.ensureNoTierOverlap(
      client,
      pricingConfigId,
      Number(row.minMiles),
      row.maxMiles !== undefined && row.maxMiles !== null ? Number(row.maxMiles) : null
    );
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.PricingTierUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "PricingTier id is required for update");

    const existing = await client.pricingTier.findUnique({
      where: { id: id! },
      select: {
        id: true,
        pricingConfigId: true,
        minMiles: true,
        maxMiles: true,
        flatPrice: true,
      },
    });

    this.ensureFound(existing, `PricingTier '${id}' not found`);

    if ("pricingConfig" in (data as any) || "pricingConfigId" in (data as any)) {
      throw new AppException(
        "pricingConfig relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      minMiles: this.resolveUpdatedValue(data.minMiles, existing!.minMiles),
      maxMiles: this.resolveUpdatedValue(data.maxMiles, existing!.maxMiles),
      flatPrice: this.resolveUpdatedValue(data.flatPrice, existing!.flatPrice),
    };

    this.ensureNonNegativeNumber(
      merged.minMiles,
      "minMiles must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      merged.flatPrice,
      "flatPrice must be a non-negative number"
    );

    if (merged.maxMiles !== undefined && merged.maxMiles !== null) {
      this.ensureNonNegativeNumber(
        merged.maxMiles,
        "maxMiles must be a non-negative number"
      );

      if (Number(merged.maxMiles) <= Number(merged.minMiles)) {
        throw new AppException(
          "maxMiles must be greater than minMiles",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    const pricingConfig = await this.ensurePricingConfigExists(
      client,
      existing!.pricingConfigId
    );

    if (pricingConfig.pricingMode !== EnumPricingConfigPricingMode.FLAT_TIER) {
      throw new AppException(
        "PricingTier is only allowed for FLAT_TIER pricing configs",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    await this.ensureNoTierOverlap(
      client,
      existing!.pricingConfigId,
      Number(merged.minMiles),
      merged.maxMiles !== undefined && merged.maxMiles !== null
        ? Number(merged.maxMiles)
        : null,
      id!
    );
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "PricingTier id is required for delete");

    const existing = await client.pricingTier.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `PricingTier '${id}' not found`);
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

  private async ensureNoTierOverlap(
    client: PrismaClient,
    pricingConfigId: string,
    minMiles: number,
    maxMiles: number | null,
    excludeId?: string
  ): Promise<void> {
    const rows = await client.pricingTier.findMany({
      where: {
        pricingConfigId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        minMiles: true,
        maxMiles: true,
      },
    });

    const nextMin = minMiles;
    const nextMax = maxMiles ?? Number.POSITIVE_INFINITY;

    for (const row of rows) {
      const rowMin = Number(row.minMiles);
      const rowMax =
        row.maxMiles === null || row.maxMiles === undefined
          ? Number.POSITIVE_INFINITY
          : Number(row.maxMiles);

      const overlaps = nextMin < rowMax && rowMin < nextMax;

      if (overlaps) {
        throw new AppException(
          "PricingTier ranges must not overlap within the same pricingConfig",
          ErrorCodes.CONFLICT,
          HttpStatus.CONFLICT
        );
      }
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