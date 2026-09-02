// src/pricingConfig/dto/pricingConfigPublic.dto.ts

import * as nestSwagger from "@nestjs/swagger";

/**
 * Mileage band definition for CATEGORY_ABC (progressive tiered) mode.
 *
 * One entry per category rule. The home page uses these to render the
 * "first 25 mi @ $2.00, next 50 mi @ $1.80, …" breakdown if the admin
 * has switched to tiered pricing.
 */
export class PublicPricingTierBandDto {
  @nestSwagger.ApiProperty({
    example: "A",
    description: "Band label (A / B / C).",
  })
  category!: string;

  @nestSwagger.ApiProperty({
    example: 0,
    description: "Lower bound of the band (miles).",
  })
  minMiles!: number;

  @nestSwagger.ApiProperty({
    example: 25,
    nullable: true,
    type: Number,
    description:
      "Upper bound of the band (miles). null = open-ended (last band).",
  })
  maxMiles!: number | null;

  @nestSwagger.ApiProperty({
    example: 1.8,
    nullable: true,
    type: Number,
    description: "Per-mile rate (USD) applied to miles in this band.",
  })
  perMileRate!: number | null;
}

/**
 * Public-facing pricing config — returned by the unauthenticated
 * `GET /api/pricingConfigs/public/default` endpoint.
 *
 * This is a SANITIZED view of the admin-configured PricingConfig:
 *   - Includes ONLY the fields needed to advertise the public rate and
 *     compute a quote preview on the home page.
 *   - EXCLUDES internal fields like `driverSharePct`, `feePassThrough`,
 *     `isDefault`, `active`, `id`, `name`, `description`, audit columns.
 *     None of those should be exposed to anonymous visitors.
 *
 * The home page (and any other public surface) should consume this DTO
 * and the shared `calculatePricing` utility in
 * `src/lib/pricing/calculate.ts` to compute a quote locally — no auth
 * required, no PII exposed, no tight coupling to the full PricingConfig
 * schema (which can evolve independently of this contract).
 *
 * If the admin has not configured any pricing config yet, the endpoint
 * returns `null` so the frontend can fall back to its hard-coded
 * advertised rate (HOME_FLAT_QUOTE_CONFIG).
 */
export class PublicPricingConfigDto {
  @nestSwagger.ApiProperty({
    example: "PER_MILE",
    enum: ["PER_MILE", "CATEGORY_ABC"],
    description:
      "Active pricing mode. PER_MILE = flat fee + per-mile beyond flatMiles. CATEGORY_ABC = progressive tiered bands.",
  })
  pricingMode!: "PER_MILE" | "CATEGORY_ABC";

  @nestSwagger.ApiProperty({
    example: 101,
    description: "Flat base fee (USD).",
  })
  baseFee!: number;

  @nestSwagger.ApiProperty({
    example: 25,
    nullable: true,
    type: Number,
    description:
      "Distance (miles) covered by the flat base fee. Only meaningful in PER_MILE mode; null in CATEGORY_ABC mode.",
  })
  flatMiles!: number | null;

  @nestSwagger.ApiProperty({
    example: 1.8,
    nullable: true,
    type: Number,
    description:
      "Per-mile rate (USD) beyond flatMiles. Only meaningful in PER_MILE mode; null in CATEGORY_ABC mode (use tierBands instead).",
  })
  perMileRate!: number | null;

  @nestSwagger.ApiProperty({
    example: 8,
    description: "Insurance fee (USD) added on top of the subtotal.",
  })
  insuranceFee!: number;

  @nestSwagger.ApiProperty({
    example: 2.9,
    nullable: true,
    type: Number,
    description: "Transaction fee percent (e.g. 2.9 means 2.9%).",
  })
  transactionFeePct!: number | null;

  @nestSwagger.ApiProperty({
    example: 3,
    nullable: true,
    type: Number,
    description: "Fixed transaction fee (USD).",
  })
  transactionFeeFixed!: number | null;

  @nestSwagger.ApiProperty({
    example: true,
    description:
      "Whether transaction fees are passed through to the customer (vs absorbed by the platform).",
  })
  feePassThrough!: boolean;

  @nestSwagger.ApiProperty({
    type: [PublicPricingTierBandDto],
    description:
      "Tiered mileage bands. Populated only in CATEGORY_ABC mode; empty in PER_MILE mode.",
  })
  tierBands!: PublicPricingTierBandDto[];

  @nestSwagger.ApiProperty({
    example: "2024-09-01T00:00:00.000Z",
    description:
      "When this config was last updated. The frontend uses this for cache invalidation.",
  })
  updatedAt!: Date;
}
