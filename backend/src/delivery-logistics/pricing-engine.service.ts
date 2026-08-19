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
    isDefault: boolean;
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

    return this.computeQuoteFromConfig({
      config: pricingContext.config,
      distanceMiles: input.distanceMiles,
      serviceType: input.serviceType,
      customerPricingModeOverride: pricingContext.customerPricingModeOverride,
    });
  }

  /**
   * Preview a quote against a SAVED PricingConfig by id.
   *
   * Used by the admin "Preview Quote" dialog (Item 9) and the
   * admin-pricing-config-form "Rate Preview" panel (Item 10) when an
   * admin wants to see what a delivery of N miles would cost under a
   * specific config — without creating a Quote row.
   *
   * Option A contract: takes a configId (not inline config fields), so
   * the admin must save the config first. This matches the existing
   * pricing-engine code path and avoids duplicating validation logic.
   *
   * `categoryOverride` lets the admin force a specific mileage category
   * (A/B/C) regardless of distance — useful for previewing the upper
   * end of a category band. When omitted, the category is resolved
   * from distanceMiles using the standard ≤25/≤75/else boundaries.
   */
  async previewQuote(input: {
    pricingConfigId: string;
    distanceMiles: number;
    serviceType: EnumQuoteServiceType;
    categoryOverride?: EnumQuoteMileageCategory | null;
  }): Promise<QuoteCalculationResult> {
    if (input.distanceMiles < 0) {
      throw new BadRequestException("Distance miles must be >= 0");
    }

    const config = await this.loadPricingConfigById(input.pricingConfigId);

    // categoryOverride is honored in the CATEGORY_ABC branch of
    // computeQuoteFromConfig — when supplied, it replaces the distance-derived
    // mileage category (≤25/≤75/else → A/B/C). This lets an admin preview
    // "what would category C cost at 50 miles?" without changing the distance.
    // It has no effect in PER_MILE or FLAT_TIER modes (those don't consult
    // the category for pricing — though FLAT_TIER still records it for display).

    return this.computeQuoteFromConfig({
      config,
      distanceMiles: input.distanceMiles,
      serviceType: input.serviceType,
      customerPricingModeOverride: null,
      categoryOverride: input.categoryOverride ?? null,
    });
  }

  /**
   * Load a PricingConfig by id with the same select shape used by
   * resolvePricingContext / loadLatestActivePricingConfig — so the
   * preview path produces results identical to a real quote.
   */
  private async loadPricingConfigById(
    id: string
  ): Promise<ResolvedPricingContext["config"]> {
    const config = await this.prisma.pricingConfig.findUnique({
      where: { id },
      select: {
        id: true,
        active: true,
        isDefault: true,
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
      throw new NotFoundException(
        `PricingConfig not found: ${id}`
      );
    }

    return {
      ...config,
      categoryRules: config.categoryRules.map((rule) => ({
        ...rule,
        category: rule.category as EnumQuoteMileageCategory,
      })),
    };
  }

  /**
   * Pure pricing math — extracted from calculateQuote so previewQuote
   * can reuse it without duplicating ~100 lines of formula code.
   *
   * Takes a fully-resolved config (with tiers + categoryRules already
   * loaded) and produces the same QuoteCalculationResult shape that
   * calculateQuote returns. Behavior is identical to the pre-refactor
   * inline math.
   */
  private async computeQuoteFromConfig(input: {
    config: ResolvedPricingContext["config"];
    distanceMiles: number;
    serviceType: EnumQuoteServiceType;
    customerPricingModeOverride: EnumCustomerPricingModeOverride | null;
    categoryOverride?: EnumQuoteMileageCategory | null;
  }): Promise<QuoteCalculationResult> {
    const { config, distanceMiles } = input;

    const effectiveMode = this.resolveEffectiveMode(
      input.customerPricingModeOverride,
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
        // Surface a clear, admin-actionable message. The dealer sees this
        // as a delivery-creation failure, so the message must explain what
        // to do next (ask admin to fix the pricing config).
        throw new BadRequestException(
          "This dealer's pricing configuration is incomplete (missing per-mile rate). " +
            "Please contact support so an admin can update the pricing config before placing this delivery."
        );
      }

      const flatMilesAllowance = Number(config.flatMiles ?? 0);
      const billableMiles = Number(
        Math.max(0, distanceMiles - flatMilesAllowance).toFixed(4)
      );

      baseFare = Number((config.baseFee ?? 0).toFixed(2));
      distanceCharge = Number(
        (billableMiles * config.perMileRate).toFixed(2)
      );
    } else {
      // ──────────────────────────────────────────────────────────────────
      // ABC model (progressive tiered, schema name CATEGORY_ABC)
      //
      // Formula (tax-bracket style, bands defined in DB via categoryRules):
      //   price = baseFee
      //         + MIN(miles, maxMiles_A) × rate_A
      //         + MAX(0, MIN(miles, maxMiles_B) − maxMiles_A) × rate_B
      //         + MAX(0, miles − maxMiles_B) × rate_C
      //
      // where maxMiles_A / maxMiles_B come from the categoryRules rows
      // (A.maxMiles, B.maxMiles). The implementation iterates bands sorted
      // by minMiles and tracks prevUpper so bands are always contiguous
      // (avoids the 0.01-mile gap when admins enter 25.01 / 75.01).
      //
      // The config-level baseFee is added once on top. Per-rule baseFee /
      // flatPrice are NOT used by this formula (kept in schema for legacy
      // rows only).
      //
      // categoryOverride (Preview endpoint): informational only — the math
      // is purely distance-based and progressive. The override only affects
      // which category is REPORTED in the result's `mileageCategory` field
      // (used for UI display).
      // ──────────────────────────────────────────────────────────────────
      mileageCategory =
        input.categoryOverride ??
        this.resolveMileageCategory(distanceMiles, config.categoryRules);

      baseFare = Number((config.baseFee ?? 0).toFixed(2));

      const sortedRules = [...config.categoryRules].sort(
        (a, b) => a.minMiles - b.minMiles
      );

      if (sortedRules.length === 0) {
        throw new BadRequestException(
          "This dealer's pricing configuration is incomplete (no ABC category rules defined). " +
            "Please contact support so an admin can update the pricing config before placing this delivery."
        );
      }

      // Track the previous band's upper bound so we can use it as the next
      // band's lower bound (ensures contiguity — see comment in loop body).
      let prevUpper = 0;
      for (const rule of sortedRules) {
        // Use the PREVIOUS band's maxMiles as this band's lower bound so the
        // bands are always contiguous. This avoids the $0.02 gap that occurs
        // when admins enter minMiles=25.01 / 75.01 (the 0.01 anti-overlap
        // offset) — without this fix, those 0.01 miles at each boundary
        // would fall through the cracks and never be billed.
        // Example: 100mi with A(0-25@$2), B(25.01-75@$1.80), C(75.01-@$1.75)
        //   buggy (rule.minMiles): A=25mi + B=49.99mi + C=24.99mi = 99.98mi
        //   fixed (prevUpper):     A=25mi + B=50mi    + C=25mi    = 100mi
        const lower = prevUpper;
        const upper = rule.maxMiles == null ? Infinity : Number(rule.maxMiles);
        const milesInBand = Math.max(
          0,
          Math.min(distanceMiles, upper) - lower
        );
        const rate = Number(rule.perMileRate ?? 0);
        distanceCharge = Number(
          (distanceCharge + milesInBand * rate).toFixed(2)
        );
        prevUpper = upper;
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
                Math.max(0, distanceMiles - (config.flatMiles ?? 0)).toFixed(2)
              ),
            }
          : {}),
      },
      pricingSnapshot: {
        pricingConfigId: config.id,
        serviceType: input.serviceType,
        distanceMiles: Number(distanceMiles.toFixed(2)),
        pricingMode: config.pricingMode,
        effectiveMode,
        customerPricingModeOverride:
          input.customerPricingModeOverride ?? null,
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
        throw new NotFoundException(
          "We could not load your account information. Please contact support."
        );
      }

      if (customer.pricingConfigId) {
        const config = await this.prisma.pricingConfig.findUnique({
          where: { id: customer.pricingConfigId },
          select: {
            id: true,
            active: true,
            isDefault: true,
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
          throw new NotFoundException(
            "Your assigned pricing configuration could not be found. " +
              "Please contact support so an admin can re-assign a pricing plan to your account."
          );
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
    // Look up the default active config first. Falls back to the legacy
    // "most recently created active config" behavior if no row is marked
    // isDefault (e.g. installations that predate the isDefault column,
    // or fresh databases where no admin has picked one yet).
    let config = await this.prisma.pricingConfig.findFirst({
      where: { active: true, isDefault: true },
      select: {
        id: true,
        active: true,
        isDefault: true,
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
      // Legacy fallback — no row marked isDefault. Use the most recently
      // created active config so existing installations keep working
      // until an admin explicitly picks a default via the UI.
      config = await this.prisma.pricingConfig.findFirst({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          active: true,
          isDefault: true,
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
    }

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
    // The platform supports exactly two pricing modes:
    //   • PER_MILE     — "Flat with extra mileage" (baseFee + extra miles × rate)
    //   • CATEGORY_ABC — "ABC progressive tiered" (tax-bracket style bands)
    //
    // FLAT_TIER is DEPRECATED. The enum value is kept in the Prisma schema
    // only so historical quote snapshots and legacy customer overrides keep
    // resolving. Any FLAT_TIER value (override or config) is silently
    // remapped to PER_MILE — the closest semantic equivalent.
    //
    // NOTE: the override branch MUST remap FLAT_TIER → PER_MILE too. Earlier
    // revisions left the FLAT_TIER override case un-handled, which caused it
    // to fall through to the trailing `return CATEGORY_ABC` — silently
    // routing customers with a stale FLAT_TIER override into the ABC branch.
    // If their assigned config was a PER_MILE config (no categoryRules), the
    // ABC branch would throw "no ABC category rules defined" — surfacing to
    // the dealer as "Flat Pricing doesn't work".
    if (override != null) {
      if (override === EnumCustomerPricingModeOverride.PER_MILE) {
        return EnumQuotePricingMode.PER_MILE;
      }
      // FLAT_TIER override → silently remap to PER_MILE (Flat with extra
      // mileage). The override UI no longer exposes FLAT_TIER, but legacy
      // customers may still have it set from before the deprecation.
      if (override === EnumCustomerPricingModeOverride.FLAT_TIER) {
        return EnumQuotePricingMode.PER_MILE;
      }
      return EnumQuotePricingMode.CATEGORY_ABC;
    }

    if (configMode === EnumPricingConfigPricingMode.PER_MILE) {
      return EnumQuotePricingMode.PER_MILE;
    }

    // Legacy FLAT_TIER configs are treated as PER_MILE (Flat) at calculation
    // time. The FLAT_TIER calc branch has been removed; this remap routes
    // the quote through the PER_MILE formula instead.
    if (configMode === EnumPricingConfigPricingMode.FLAT_TIER) {
      return EnumQuotePricingMode.PER_MILE;
    }

    return EnumQuotePricingMode.CATEGORY_ABC;
  }

  /**
   * Resolve the mileage category (A / B / C) for a given distance.
   *
   * Band boundaries are read from the categoryRules in the PricingConfig —
   * NOT hardcoded. The maxMiles of category A defines the A/B boundary,
   * and the maxMiles of category B defines the B/C boundary. Category C is
   * always "everything above B" (its maxMiles is typically null / open-ended).
   *
   * Fallbacks (used only when a rule is missing OR its maxMiles is null):
   *   A.maxMiles ?? 25
   *   B.maxMiles ?? 50
   * (These match the seed values in backend/scripts/seed/index.ts.)
   *
   * If categoryRules is empty (shouldn't happen — validated upstream), all
   * three fallbacks kick in and the function reduces to the legacy behavior:
   *   miles ≤ 25 → A, miles ≤ 50 → B, else C.
   *
   * NOTE: This is purely for DISPLAY / audit purposes (the `mileageCategory`
   * field on Quote). The actual price math iterates ALL bands in
   * computeQuoteFromConfig — it does NOT use this function.
   */
  private resolveMileageCategory(
    miles: number,
    categoryRules: ResolvedPricingContext["config"]["categoryRules"]
  ): EnumQuoteMileageCategory {
    const ruleA = categoryRules.find((r) => r.category === EnumQuoteMileageCategory.A);
    const ruleB = categoryRules.find((r) => r.category === EnumQuoteMileageCategory.B);

    const aMax = ruleA?.maxMiles ?? 25;
    const bMax = ruleB?.maxMiles ?? 50;

    if (miles <= aMax) return EnumQuoteMileageCategory.A;
    if (miles <= bMax) return EnumQuoteMileageCategory.B;
    return EnumQuoteMileageCategory.C;
  }
}
