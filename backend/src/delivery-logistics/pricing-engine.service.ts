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
      if (config.perMileRate == null) {
        throw new BadRequestException("PER_MILE config requires perMileRate");
      }

      baseFare = Number((config.baseFee ?? 0).toFixed(2));
      distanceCharge = Number(
        (input.distanceMiles * config.perMileRate).toFixed(2)
      );
    } else if (effectiveMode === EnumQuotePricingMode.FLAT_TIER) {
      const tier = config.tiers.find((item) => {
        const lowerOk = input.distanceMiles >= item.minMiles;
        const upperOk =
          item.maxMiles == null || input.distanceMiles <= item.maxMiles;
        return lowerOk && upperOk;
      });

      if (!tier) {
        throw new BadRequestException("No flat tier configured for this mileage");
      }

      baseFare = Number(tier.flatPrice.toFixed(2));
      distanceCharge = 0;
      mileageCategory = this.resolveMileageCategory(input.distanceMiles);
    } else {
      mileageCategory = this.resolveMileageCategory(input.distanceMiles);

      const rule = config.categoryRules.find((item) => {
        const categoryOk = item.category === mileageCategory;
        const lowerOk = input.distanceMiles >= item.minMiles;
        const upperOk =
          item.maxMiles == null || input.distanceMiles <= item.maxMiles;

        return categoryOk && lowerOk && upperOk;
      });

      if (!rule) {
        throw new BadRequestException(
          `No CATEGORY_ABC pricing rule configured for mileage category ${mileageCategory}`
        );
      }

      if (rule.flatPrice != null) {
        baseFare = Number(rule.flatPrice.toFixed(2));
        distanceCharge = 0;
      } else {
        baseFare = Number((rule.baseFee ?? config.baseFee ?? 0).toFixed(2));

        const effectiveRate = rule.perMileRate ?? config.perMileRate;
        if (effectiveRate == null) {
          throw new BadRequestException(
            `Category ${mileageCategory} requires perMileRate or flatPrice`
          );
        }

        distanceCharge = Number(
          (input.distanceMiles * effectiveRate).toFixed(2)
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

    return {
      pricingConfigId: config.id,
      pricingMode: effectiveMode,
      mileageCategory,
      estimatedPrice,
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
        insuranceFee: config.insuranceFee,
        perMileRate: config.perMileRate,
        transactionFeeFixed: config.transactionFeeFixed,
        transactionFeePct: config.transactionFeePct,
        feePassThrough: config.feePassThrough,
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
    if (override != null) {
      if (override === EnumCustomerPricingModeOverride.PER_MILE) {
        return EnumQuotePricingMode.PER_MILE;
      }

      if (override === EnumCustomerPricingModeOverride.FLAT_TIER) {
        return EnumQuotePricingMode.FLAT_TIER;
      }

      return EnumQuotePricingMode.CATEGORY_ABC;
    }

    if (configMode === EnumPricingConfigPricingMode.PER_MILE) {
      return EnumQuotePricingMode.PER_MILE;
    }

    if (configMode === EnumPricingConfigPricingMode.FLAT_TIER) {
      return EnumQuotePricingMode.FLAT_TIER;
    }

    return EnumQuotePricingMode.CATEGORY_ABC;
  }

  private resolveMileageCategory(miles: number): EnumQuoteMileageCategory {
    if (miles <= 25) return EnumQuoteMileageCategory.A;
    if (miles <= 75) return EnumQuoteMileageCategory.B;
    return EnumQuoteMileageCategory.C;
  }
}
