// src/pricingConfig/pricingConfig.service.ts

import { Injectable } from "@nestjs/common";
import {
  Customer as PrismaCustomer,
  PricingCategoryRule as PrismaPricingCategoryRule,
  PricingConfig as PrismaPricingConfig,
  PricingTier as PrismaPricingTier,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { PricingConfigServiceBase } from "./base/pricingConfig.service.base";
import { PricingConfigDomain } from "../domain/pricingConfig/pricingConfig.domain";
import { PricingConfigPolicyService } from "../domain/pricingConfig/pricingConfigPolicy.service";
import { PricingConfigAdminEngine } from "../domain/pricingConfig/pricingConfigAdmin.engine";
import { PricingEngineService } from "../delivery-logistics/pricing-engine.service";
import { SavePricingConfigBody } from "./dto/pricingConfigAdmin.dto";
import { PublicPricingConfigDto } from "./dto/pricingConfigPublic.dto";


@Injectable()
export class PricingConfigService extends PricingConfigServiceBase {
constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: PricingConfigDomain,
  private readonly policy: PricingConfigPolicyService,
  private readonly pricingConfigAdminEngine: PricingConfigAdminEngine,
  private readonly pricingEngineService: PricingEngineService
) {
  super(prisma);
}


  async count(args: Omit<Prisma.PricingConfigCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.pricingConfig.count(args);
  }

  async pricingConfigs(args: Prisma.PricingConfigFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async pricingConfig(args: Prisma.PricingConfigFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createPricingConfig(args: Prisma.PricingConfigCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.pricingConfig.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updatePricingConfig(args: Prisma.PricingConfigUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.pricingConfig.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deletePricingConfig(args: Prisma.PricingConfigDeleteArgs): Promise<PrismaPricingConfig> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.pricingConfig.delete(args);
  }

  async findCategoryRules(
    parentId: string,
    args: Prisma.PricingCategoryRuleFindManyArgs
  ): Promise<PrismaPricingCategoryRule[]> {
    return this.prisma.pricingConfig
      .findUniqueOrThrow({ where: { id: parentId } })
      .categoryRules(args);
  }

  async findCustomers(
    parentId: string,
    args: Prisma.CustomerFindManyArgs
  ): Promise<PrismaCustomer[]> {
    return this.prisma.pricingConfig
      .findUniqueOrThrow({ where: { id: parentId } })
      .customers(args);
  }

  async findTiers(
    parentId: string,
    args: Prisma.PricingTierFindManyArgs
  ): Promise<PrismaPricingTier[]> {
    return this.prisma.pricingConfig
      .findUniqueOrThrow({ where: { id: parentId } })
      .tiers(args);
  }

  private normalizeCreateData(
    data: Prisma.PricingConfigCreateArgs["data"]
  ): Prisma.PricingConfigCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.name = this.trimOptionalString(normalized.name);
    normalized.description = this.trimOptionalString(normalized.description);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.PricingConfigUpdateArgs["data"]
  ): Prisma.PricingConfigUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "name");
    this.normalizeUpdateStringField(normalized, "description");

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
    if (!(field in target)) {
      return;
    }

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

async adminSavePricingConfig(input: {
  body: SavePricingConfigBody;
  actorUserId?: string | null;
}): Promise<any> {
  const pricingConfigId = await this.pricingConfigAdminEngine.saveConfig({
    body: input.body,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: pricingConfigId });
}

async setDefaultPricingConfig(input: {
  id: string;
  actorUserId?: string | null;
}): Promise<any> {
  await this.pricingConfigAdminEngine.setDefault({
    id: input.id,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: input.id });
}

/**
 * Preview a quote against a saved PricingConfig — see
 * PricingEngineService.previewQuote for the contract.
 *
 * Delegates directly to the pricing engine; no DB writes, no audit
 * log entry (it's a pure read for admin UI preview purposes).
 */
async previewQuote(input: {
  pricingConfigId: string;
  distanceMiles: number;
  serviceType: any;
  categoryOverride?: any;
}): Promise<any> {
  return this.pricingEngineService.previewQuote({
    pricingConfigId: input.pricingConfigId,
    distanceMiles: input.distanceMiles,
    serviceType: input.serviceType,
    categoryOverride: input.categoryOverride ?? null,
  });
}

/**
 * Public-facing default pricing config.
 *
 * Returns a SANITIZED view of the currently active default
 * PricingConfig — only the fields the home page / public surfaces need
 * to advertise the rate and compute a quote preview. No internal
 * fields (driverSharePct, id, name, description, audit columns) are
 * exposed.
 *
 * Lookup precedence (mirrors the PricingEngineService resolver):
 *   1. active + isDefault
 *   2. fallback: most-recently-created active config
 *   3. null  →  frontend falls back to its hard-coded advertised rate
 *
 * This endpoint is intentionally unauthenticated (see
 * PricingConfigPublicController) — the rate is public information
 * already shown on the marketing site.
 */
async getPublicDefaultPricingConfig(): Promise<PublicPricingConfigDto | null> {
  // 1. Try active + isDefault
  let config = await this.prisma.pricingConfig.findFirst({
    where: { active: true, isDefault: true },
    include: {
      categoryRules: {
        orderBy: { minMiles: "asc" },
      },
    },
  });

  // 2. Fallback: most recently created active config
  if (!config) {
    config = await this.prisma.pricingConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      include: {
        categoryRules: {
          orderBy: { minMiles: "asc" },
        },
      },
    });
  }

  // 3. No config at all → null (frontend will fall back to hard-coded values)
  if (!config) {
    return null;
  }

  return this.sanitizeForPublic(config);
}

/**
 * Project a full PricingConfig row (with categoryRules included) into
 * the public DTO shape. Strips internal fields and normalizes nulls.
 */
private sanitizeForPublic(
  config: PrismaPricingConfig & {
    categoryRules: PrismaPricingCategoryRule[];
  }
): PublicPricingConfigDto {
  // Legacy FLAT_TIER configs are treated as PER_MILE for public display
  // (matches resolveEffectiveMode in the shared frontend pricing util).
  const publicMode: "PER_MILE" | "CATEGORY_ABC" =
    config.pricingMode === "CATEGORY_ABC" ? "CATEGORY_ABC" : "PER_MILE";

  return {
    pricingMode: publicMode,
    baseFee: Number(config.baseFee),
    flatMiles:
      publicMode === "PER_MILE" && config.flatMiles != null
        ? Number(config.flatMiles)
        : null,
    perMileRate:
      publicMode === "PER_MILE" && config.perMileRate != null
        ? Number(config.perMileRate)
        : null,
    insuranceFee: Number(config.insuranceFee),
    transactionFeePct:
      config.transactionFeePct != null ? Number(config.transactionFeePct) : null,
    transactionFeeFixed:
      config.transactionFeeFixed != null
        ? Number(config.transactionFeeFixed)
        : null,
    feePassThrough: Boolean(config.feePassThrough),
    tierBands:
      publicMode === "CATEGORY_ABC"
        ? config.categoryRules.map((r) => ({
            category: String(r.category),
            minMiles: Number(r.minMiles),
            maxMiles: r.maxMiles == null ? null : Number(r.maxMiles),
            perMileRate: r.perMileRate == null ? null : Number(r.perMileRate),
          }))
        : [],
    updatedAt: config.updatedAt,
  };
}
}