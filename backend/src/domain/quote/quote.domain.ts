// src/domain/quote/quote.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type QuoteSelect = Prisma.QuoteSelect;
type QuoteWhere = Prisma.QuoteWhereInput;
type QuoteWhereUnique = Prisma.QuoteWhereUniqueInput;
type QuoteFindMany = Prisma.QuoteFindManyArgs;
type QuoteFindUnique = Prisma.QuoteFindUniqueArgs;

/**
 * QuoteDomain
 * - enriched read-only select for Quote
 * - merges user select with default enrichments
 */
@Injectable()
export class QuoteDomain extends BaseDomain<
  QuoteSelect,
  QuoteWhere,
  QuoteWhereUnique,
  QuoteFindMany,
  QuoteFindUnique
> {
  protected enrichSelectFields: QuoteSelect = {
    id: true,

    serviceType: true,
    pricingMode: true,
    mileageCategory: true,

    pickupAddress: true,
    pickupPlaceId: true,
    pickupLat: true,
    pickupLng: true,
    pickupState: true,

    dropoffAddress: true,
    dropoffPlaceId: true,
    dropoffLat: true,
    dropoffLng: true,
    dropoffState: true,

    distanceMiles: true,
    estimatedPrice: true,
    feesBreakdown: true,
    pricingSnapshot: true,
    routePolyline: true,

    createdAt: true,
    updatedAt: true,

    delivery: {
      select: {
        id: true,
        customerId: true,
        quoteId: true,
        serviceType: true,
        status: true,

        pickupAddress: true,
        dropoffAddress: true,

        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,

        sameDayEligible: true,
        requiresOpsConfirmation: true,
        afterHours: true,
        isUrgent: true,

        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.quote);
  }
}