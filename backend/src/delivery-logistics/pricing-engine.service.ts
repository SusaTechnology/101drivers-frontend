import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumCustomerPricingModeOverride,
  EnumPricingConfigPricingMode,
  EnumQuoteMileageCategory,
  EnumQuotePricingMode,
  EnumQuoteServiceType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type QuoteCalculationInput = {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  pickupPlaceId?: string | null;
  pickupState?: string | null;

  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffPlaceId?: string | null;
  dropoffState?: string | null;

  distanceMiles: number;
  routePolyline?: string | null;
  serviceType: EnumQuoteServiceType;
  customerId?: string | null;
};

export type QuoteCalculationResult = {
  pricingConfigId: string;
  pricingMode: EnumQuotePricingMode;
  mileageCategory: EnumQuoteMileageCategory | null;
  estimatedPrice: number;
  estimatedDriverPayout: number;
  feesBreakdown: Record<string, unknown>;
  pricingSnapshot: Record<string, unknown>;
};

type ResolvedPricingContext = {
  config: {
    id: string;
    active: boolean;
    baseFee: number;
    insuranceFee: number;
    driverSharePct: number;
    feePassThrough: boolean;
    flatMiles: number | null;
    perMileRate: number | null;
    pricingMode: EnumPricingConfigPricingMode;
    transactionFeeFixed: number | null;
    transactionFeePct: number | null;
    tiers: Array<{
      id: string;
      minMiles: number;
      maxMiles: number | null;
      flatPrice: number;
    }>;
    categoryRules: Array<{
      id: string;
      category: EnumQuoteMileageCategory;
      minMiles: number;
      maxMiles: number | null;
      baseFee: number | null;
      flatPrice: number | null;
      perMileRate: number | null;
    }>;
  };
  customerPricingModeOverride: EnumCustomerPricingModeOverride | null;
};

@Injectable()
export class PricingEngineService {
  constructor(private readonly prisma: PrismaService) {} 

  async calculateQuote(
    input: QuoteCalculationInput
  ): Promise<QuoteCalculationResult> {
    if (input.distanceMiles < 0) {
      throw new BadRequestException("Distance miles must be >= 0");
    }

    const pricingContext = await this.resolvePricingContext(
      input.customerId ?? null
    );
    const config = pricingContext.config;

    const effectiveMode = this.resolveEffectiveMode(
      pricingContext.customerPricingModeOverride,
      config.pricingMode
    );

    let baseFare = 0;
    let distanceCharge = 0;
    let mileageCategory: EnumQuoteMileageCategory | null = null;

    if (effectiveMode === EnumQuotePricingMode.PER_MILE) {
      // ──────────────────────────────────────────────────────────────────
      // FLAT model (UI label: "Flat with extra mileage")
      // Schema name kept as PER_MILE for backward-compat with historical
      // quote snapshots. Math: baseFee + max(0, miles - flatMiles) * perMileRate
      // ──────────────────────────────────────────────────────────────────
      if (config.perMileRate == null) {
        throw new BadRequestException("PER_MILE config requires perMileRate");
      }

      const flatMilesAllowance = Number(config.flatMiles ?? 0);
      const billableMiles = Number(
        Math.max(0, input.distanceMiles - flatMilesAllowance).toFixed(4)
      );

      baseFare = Number((config.baseFee ?? 0).toFixed(2));
      distanceCharge = Number(
        (billableMiles * config.perMileRate).toFixed(2)
      );
    } else if (effectiveMode === EnumQuotePricingMode.FLAT_TIER) {
      // ──────────────────────────────────────────────────────────────────
      // DEPRECATED — FLAT_TIER mode.
      // The platform now supports only two pricing models: ABC (CATEGORY_ABC)
      // and Flat (PER_MILE). FLAT_TIER is hidden from the admin UI and its
      // calculation branch is intentionally disabled. The enum value is kept
      // in the Prisma schema only so historical quote snapshots continue to
      // resolve their `pricingMode` field without breaking.
      //
      // If a legacy config somehow still has pricingMode=FLAT_TIER, fall
      // through to the CATEGORY_ABC branch (which gracefully degrades to
      // baseFee-only when no categoryRules are configured).
      // ──────────────────────────────────────────────────────────────────
      mileageCategory = this.resolveMileageCategory(input.distanceMiles);
      baseFare = Number((config.baseFee ?? 0).toFixed(2));
      distanceCharge = 0;
    } else {
      // ──────────────────────────────────────────────────────────────────
      // ABC model (progressive tiered)
      // total = baseFee + Σ (miles_in_band_i × rate_i)
      // where bands are the categoryRules rows sorted by minMiles.
      // Each band contributes max(0, min(miles, maxMiles ?? ∞) - minMiles) × perMileRate.
      // The config-level baseFee is added once on top.
      // ──────────────────────────────────────────────────────────────────
      mileageCategory = this.resolveMileageCategory(input.distanceMiles);

      baseFare = Number((config.baseFee ?? 0).toFixed(2));

      const sortedRules = [...config.categoryRules].sort(
        (a, b) => a.minMiles - b.minMiles
      );

      if (sortedRules.length === 0) {
        throw new BadRequestException(
          "CATEGORY_ABC config requires at least one category rule"
        );
      }

      for (const rule of sortedRules) {
        const lower = Number(rule.minMiles);
        const upper = rule.maxMiles == null ? Infinity : Number(rule.maxMiles);
        const milesInBand = Math.max(
          0,
          Math.min(input.distanceMiles, upper) - lower
        );
        const rate = Number(rule.perMileRate ?? 0);
        distanceCharge = Number(
          (distanceCharge + milesInBand * rate).toFixed(2)
        );
      }
    }

    const insuranceFee = Number((config.insuranceFee ?? 0).toFixed(2));
    const subTotal = Number(
      (baseFare + distanceCharge + insuranceFee).toFixed(2)
    );

    const transactionFeeFixed = Number(
      (config.transactionFeeFixed ?? 0).toFixed(2)
    );
    const transactionFeePctRate = Number((config.transactionFeePct ?? 0).toFixed(2));
    const transactionFeePctAmount = Number(
      (((config.transactionFeePct ?? 0) / 100) * subTotal).toFixed(2)
    );

    const transactionFee = config.feePassThrough
      ? Number((transactionFeeFixed + transactionFeePctAmount).toFixed(2))
      : 0;

    const estimatedPrice = Number((subTotal + transactionFee).toFixed(2));

    // Driver payout estimate = estimatedPrice × driverSharePct% - insuranceFee
    // This is the driver's take-home before tips (tips are added at trip completion).
    const driverSharePct = config.driverSharePct ?? 60;
    const driverShareAmount = Number((estimatedPrice * (driverSharePct / 100)).toFixed(2));
    const estimatedDriverPayout = Number(Math.max(driverShareAmount - insuranceFee, 0).toFixed(2));

    return {
      pricingConfigId: config.id,
      pricingMode: effectiveMode,
      mileageCategory,
      estimatedPrice,
      estimatedDriverPayout,
      feesBreakdown: {
        pricingConfigId: config.id,
        mode: effectiveMode,
        baseFare,
        distanceCharge,
        insuranceFee,
        transactionFeeFixed,
        transactionFeePct: transactionFeePctRate,
        transactionFeePctAmount,
        transactionFee,
        feePassThrough: config.feePassThrough,
        total: estimatedPrice,
        ...(effectiveMode === EnumQuotePricingMode.PER_MILE
          ? {
              flatMilesAllowance: Number((config.flatMiles ?? 0).toFixed(2)),
              billedMiles: Number(
                Math.max(0, input.distanceMiles - (config.flatMiles ?? 0)).toFixed(2)
              ),
            }
          : {}),
      },
      pricingSnapshot: {
        pricingConfigId: config.id,
        serviceType: input.serviceType,
        distanceMiles: Number(input.distanceMiles.toFixed(2)),
        pricingMode: config.pricingMode,
        effectiveMode,
        customerPricingModeOverride:
          pricingContext.customerPricingModeOverride ?? null,
        mileageCategory,
        driverSharePct: config.driverSharePct,
        baseFee: config.baseFee,
        flatMiles: config.flatMiles,
        insuranceFee: config.insuranceFee,
        perMileRate: config.perMileRate,
        transactionFeeFixed: config.transactionFeeFixed,
        transactionFeePct: config.transactionFeePct,
        feePassThrough: config.feePassThrough,
        // For ABC mode: snapshot the band definitions so future re-rating
        // (e.g. dispute resolution) can use the exact rules in effect at
        // quote time, not whatever the admin later changes them to.
        categoryRules:
          effectiveMode === EnumQuotePricingMode.CATEGORY_ABC
            ? config.categoryRules.map((r) => ({
                category: r.category,
                minMiles: r.minMiles,
                maxMiles: r.maxMiles,
                perMileRate: r.perMileRate,
              }))
            : undefined,
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  async createQuote(input: QuoteCalculationInput) {
    const calc = await this.calculateQuote(input);

    return this.prisma.quote.create({
      data: {
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat ?? null,
        pickupLng: input.pickupLng ?? null,
        pickupPlaceId: input.pickupPlaceId ?? null,
        pickupState: input.pickupState ?? null,
        dropoffAddress: input.dropoffAddress,
        dropoffLat: input.dropoffLat ?? null,
        dropoffLng: input.dropoffLng ?? null,
        dropoffPlaceId: input.dropoffPlaceId ?? null,
        dropoffState: input.dropoffState ?? null,
        distanceMiles: Number(input.distanceMiles.toFixed(2)),
        estimatedDriverPayout: calc.estimatedDriverPayout,
        estimatedPrice: calc.estimatedPrice,
        pricingMode: calc.pricingMode,
        mileageCategory: calc.mileageCategory,
        serviceType: input.serviceType,
        routePolyline: input.routePolyline ?? null,
        feesBreakdown: calc.feesBreakdown as Prisma.InputJsonValue,
        pricingSnapshot: calc.pricingSnapshot as Prisma.InputJsonValue,
      },
    });
  }

  private async resolvePricingContext(
    customerId: string | null
  ): Promise<ResolvedPricingContext> {
    if (customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          pricingConfigId: true,
          pricingModeOverride: true,
        },
      });

      if (!customer) {
        throw new NotFoundException("Customer not found for quote pricing");
      }

      if (customer.pricingConfigId) {
        const config = await this.prisma.pricingConfig.findUnique({
          where: { id: customer.pricingConfigId },
          select: {
            id: true,
            active: true,
            baseFee: true,
            insuranceFee: true,
            driverSharePct: true,
            feePassThrough: true,
            flatMiles: true,
            perMileRate: true,
            pricingMode: true,
            transactionFeeFixed: true,
            transactionFeePct: true,
            tiers: {
              select: {
                id: true,
                minMiles: true,
                maxMiles: true,
                flatPrice: true,
              },
              orderBy: { minMiles: "asc" },
            },
            categoryRules: {
              select: {
                id: true,
                category: true,
                minMiles: true,
                maxMiles: true,
                baseFee: true,
                flatPrice: true,
                perMileRate: true,
              },
              orderBy: [{ category: "asc" }, { minMiles: "asc" }],
            },
          },
        });

        if (!config) {
          throw new NotFoundException("Customer PricingConfig not found");
        }

        return {
          config: {
            ...config,
            categoryRules: config.categoryRules.map((rule) => ({
              ...rule,
              category: rule.category as EnumQuoteMileageCategory,
            })),
          },
          customerPricingModeOverride: customer.pricingModeOverride ?? null,
        };
      }

      const activeConfig = await this.loadLatestActivePricingConfig();

      return {
        config: activeConfig,
        customerPricingModeOverride: customer.pricingModeOverride ?? null,
      };
    }

    const activeConfig = await this.loadLatestActivePricingConfig();

    return {
      config: activeConfig,
      customerPricingModeOverride: null,
    };
  }

  private async loadLatestActivePricingConfig(): Promise<ResolvedPricingContext["config"]> {
    const config = await this.prisma.pricingConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        active: true,
        baseFee: true,
        insuranceFee: true,
        driverSharePct: true,
        feePassThrough: true,
        flatMiles: true,
        perMileRate: true,
        pricingMode: true,
        transactionFeeFixed: true,
        transactionFeePct: true,
        tiers: {
          select: {
            id: true,
            minMiles: true,
            maxMiles: true,
            flatPrice: true,
          },
          orderBy: { minMiles: "asc" },
        },
        categoryRules: {
          select: {
            id: true,
            category: true,
            minMiles: true,
            maxMiles: true,
            baseFee: true,
            flatPrice: true,
            perMileRate: true,
          },
          orderBy: [{ category: "asc" }, { minMiles: "asc" }],
        },
      },
    });

    if (!config) {
      throw new NotFoundException("No active pricing configuration found");
    }

    return {
      ...config,
      categoryRules: config.categoryRules.map((rule) => ({
        ...rule,
        category: rule.category as EnumQuoteMileageCategory,
      })),
    };
  }

  private resolveEffectiveMode(
    override: EnumCustomerPricingModeOverride | null | undefined,
    configMode: EnumPricingConfigPricingMode
  ): EnumQuotePricingMode {
    // DEPRECATED: FLAT_TIER mode is no longer supported. Any override or
    // config that requests FLAT_TIER is silently mapped to PER_MILE (Flat).
    if (override != null) {
      if (override === EnumCustomerPricingModeOverride.PER_MILE) {
        return EnumQuotePricingMode.PER_MILE;
      }

      // FLAT_TIER override → fall back to PER_MILE (Flat with extra mileage).
      // if (override === EnumCustomerPricingModeOverride.FLAT_TIER) {
      //   return EnumQuotePricingMode.FLAT_TIER;
      // }

      return EnumQuotePricingMode.CATEGORY_ABC;
    }

    if (configMode === EnumPricingConfigPricingMode.PER_MILE) {
      return EnumQuotePricingMode.PER_MILE;
    }

    // if (configMode === EnumPricingConfigPricingMode.FLAT_TIER) {
    //   return EnumQuotePricingMode.FLAT_TIER;
    // }
    // Legacy FLAT_TIER configs are treated as PER_MILE (Flat) at calculation time.
    if (configMode === EnumPricingConfigPricingMode.FLAT_TIER) {
      return EnumQuotePricingMode.PER_MILE;
    }

    return EnumQuotePricingMode.CATEGORY_ABC;
  }

  private resolveMileageCategory(miles: number): EnumQuoteMileageCategory {
    if (miles <= 25) return EnumQuoteMileageCategory.A;
    if (miles <= 75) return EnumQuoteMileageCategory.B;
    return EnumQuoteMileageCategory.C;
  }
}
