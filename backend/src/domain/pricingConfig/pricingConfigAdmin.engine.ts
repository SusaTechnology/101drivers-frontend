import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumPricingConfigPricingMode,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PricingCategoryRuleInputDto,
  PricingTierInputDto,
  SavePricingConfigBody,
} from "../../pricingConfig/dto/pricingConfigAdmin.dto";

@Injectable()
export class PricingConfigAdminEngine {
  constructor(private readonly prisma: PrismaService) {}

  async saveConfig(input: {
    body: SavePricingConfigBody;
    actorUserId?: string | null;
  }): Promise<string> {
    const body = input.body;
    this.validateSavePayload(body);

    return this.prisma.$transaction(async (tx) => {
      const existing = body.id
        ? await tx.pricingConfig.findUnique({
            where: { id: body.id },
            include: {
              tiers: true,
              categoryRules: true,
            },
          })
        : null;

      if (body.id && !existing) {
        throw new NotFoundException("PricingConfig not found");
      }

      const beforeJson = existing ?? Prisma.JsonNull;
      let pricingConfigId = existing?.id ?? null;

      if (!existing) {
        const created = await tx.pricingConfig.create({
          data: {
            name: this.trimOptional(body.name),
            description: this.trimOptional(body.description),
            active: body.active ?? true,
            pricingMode: body.pricingMode,
            baseFee: this.toNumber(body.baseFee),
            perMileRate: this.toNullableNumber(body.perMileRate),
            insuranceFee: this.toNumber(body.insuranceFee),
            transactionFeePct: this.toNullableNumber(body.transactionFeePct),
            transactionFeeFixed: this.toNullableNumber(body.transactionFeeFixed),
            feePassThrough: body.feePassThrough === true,
            driverSharePct: this.toNumber(body.driverSharePct),
          },
          select: { id: true },
        });

        pricingConfigId = created.id;
      } else {
        await tx.pricingConfig.update({
          where: { id: existing.id },
          data: {
            name: this.trimOptional(body.name),
            description: this.trimOptional(body.description),
            active: body.active ?? true,
            pricingMode: body.pricingMode,
            baseFee: this.toNumber(body.baseFee),
            perMileRate: this.toNullableNumber(body.perMileRate),
            insuranceFee: this.toNumber(body.insuranceFee),
            transactionFeePct: this.toNullableNumber(body.transactionFeePct),
            transactionFeeFixed: this.toNullableNumber(body.transactionFeeFixed),
            feePassThrough: body.feePassThrough === true,
            driverSharePct: this.toNumber(body.driverSharePct),
          },
        });
      }

      if (!pricingConfigId) {
        throw new BadRequestException("Unable to resolve pricing config id");
      }

      await tx.pricingTier.deleteMany({
        where: { pricingConfigId },
      });

      await tx.pricingCategoryRule.deleteMany({
        where: { pricingConfigId },
      });

      const tiers = body.tiers ?? [];
      if (tiers.length > 0) {
        await tx.pricingTier.createMany({
          data: tiers.map((tier) => ({
            pricingConfigId,
            minMiles: this.toNumber(tier.minMiles),
            maxMiles: this.toNullableNumber(tier.maxMiles),
            flatPrice: this.toNumber(tier.flatPrice),
          })),
        });
      }

      const categoryRules = body.categoryRules ?? [];
      if (categoryRules.length > 0) {
        await tx.pricingCategoryRule.createMany({
          data: categoryRules.map((rule) => ({
            pricingConfigId,
            category: rule.category,
            minMiles: this.toNumber(rule.minMiles),
            maxMiles: this.toNullableNumber(rule.maxMiles),
            baseFee: this.toNullableNumber(rule.baseFee),
            perMileRate: this.toNullableNumber(rule.perMileRate),
            flatPrice: this.toNullableNumber(rule.flatPrice),
          })),
        });
      }

      if (body.activateAsDefault === true) {
        await tx.pricingConfig.updateMany({
          where: {
            id: { not: pricingConfigId },
          },
          data: {
            active: false,
          },
        });

        await tx.pricingConfig.update({
          where: { id: pricingConfigId },
          data: { active: true },
        });
      }

      const afterConfig = await tx.pricingConfig.findUnique({
        where: { id: pricingConfigId },
        include: {
          tiers: {
            orderBy: { minMiles: "asc" },
          },
          categoryRules: {
            orderBy: { category: "asc" },
          },
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.PRICING_UPDATE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          reason: existing
            ? "PricingConfig updated via admin-save"
            : "PricingConfig created via admin-save",
          beforeJson,
          afterJson: afterConfig ?? Prisma.JsonNull,
        },
      });

      return pricingConfigId;
    });
  }

  private validateSavePayload(body: SavePricingConfigBody): void {
    if (body.driverSharePct < 0 || body.driverSharePct > 100) {
      throw new BadRequestException("driverSharePct must be between 0 and 100");
    }

    if (
      body.pricingMode === EnumPricingConfigPricingMode.PER_MILE &&
      (body.perMileRate == null || Number(body.perMileRate) <= 0)
    ) {
      throw new BadRequestException(
        "perMileRate is required when pricingMode is PER_MILE"
      );
    }

    if (
      body.pricingMode === EnumPricingConfigPricingMode.FLAT_TIER &&
      (!body.tiers || body.tiers.length === 0)
    ) {
      throw new BadRequestException(
        "tiers are required when pricingMode is FLAT_TIER"
      );
    }

    if (
      body.pricingMode === EnumPricingConfigPricingMode.CATEGORY_ABC &&
      (!body.categoryRules || body.categoryRules.length === 0)
    ) {
      throw new BadRequestException(
        "categoryRules are required when pricingMode is CATEGORY_ABC"
      );
    }

    this.validateTiers(body.tiers ?? []);
    this.validateCategoryRules(body.categoryRules ?? [], body.pricingMode);
  }

  private validateTiers(tiers: PricingTierInputDto[]): void {
    const ordered = [...tiers].sort((a, b) => a.minMiles - b.minMiles);

    for (let i = 0; i < ordered.length; i++) {
      const tier = ordered[i];

      if (tier.maxMiles != null && tier.maxMiles < tier.minMiles) {
        throw new BadRequestException(
          `Tier maxMiles must be greater than or equal to minMiles at index ${i}`
        );
      }

      if (i > 0) {
        const prev = ordered[i - 1];
        if (prev.maxMiles != null && tier.minMiles < prev.maxMiles) {
          throw new BadRequestException(
            "Pricing tiers overlap; provide non-overlapping tier ranges"
          );
        }
      }
    }
  }

  private validateCategoryRules(
    rules: PricingCategoryRuleInputDto[],
    mode: EnumPricingConfigPricingMode
  ): void {
    const seen = new Set<string>();

    for (const rule of rules) {
      const key = `${rule.category}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate category rule provided for category ${rule.category}`
        );
      }
      seen.add(key);

      if (rule.maxMiles != null && rule.maxMiles < rule.minMiles) {
        throw new BadRequestException(
          `Category rule maxMiles must be greater than or equal to minMiles for ${rule.category}`
        );
      }

      if (mode === EnumPricingConfigPricingMode.CATEGORY_ABC) {
        const hasAnyValue =
          rule.baseFee != null ||
          rule.perMileRate != null ||
          rule.flatPrice != null;

        if (!hasAnyValue) {
          throw new BadRequestException(
            `At least one pricing value is required for category ${rule.category}`
          );
        }
      }
    }
  }

  private trimOptional(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value !== "string") return String(value);
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toNumber(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new BadRequestException("Invalid numeric value");
    }
    return Number(n.toFixed(2));
  }

  private toNullableNumber(value: unknown): number | null {
    if (value == null || value === "") return null;
    return this.toNumber(value);
  }
}
