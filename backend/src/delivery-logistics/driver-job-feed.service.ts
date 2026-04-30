import { Injectable, NotFoundException, ForbiddenException, GoneException, ConflictException } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDriverStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleMapsService } from "./google-maps.service";

type DbClient = Prisma.TransactionClient | PrismaService;

type DriverOrigin = {
  lat: number | null;
  lng: number | null;
  source: "current" | "homeBase" | "none";
};

export type DriverFeedItem = {
  deliveryId: string;
  serviceType: string;
  status: EnumDeliveryRequestStatus;
  pickupAddress: string;
  dropoffAddress: string;
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  dropoffWindowStart: Date | null;
  dropoffWindowEnd: Date | null;
  etaMinutes: number | null;
  isUrgent: boolean;
  afterHours: boolean;
  urgentBonusAmount: number | null;
  payoutPreviewAmount: number | null;
  matchScore: number;
  matchReasons: string[];
  pickupDistanceMiles: number | null;
  pickupEtaMinutes: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  originSource: "current" | "homeBase" | "none";
  createdAt: Date;
};

export type DriverJobFeedResult = {
  items: DriverFeedItem[];
  nextCursor: string | null;
};

@Injectable()
export class DriverJobFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapsService: GoogleMapsService
  ) {}

async getDriverJobFeed(input: {
  driverId: string;
  limit?: number;
  cursor?: string | null;
  urgentOnly?: boolean;
  serviceType?: string | null;
  search?: string | null;
  radiusMiles?: number | null;
  datePreset?: "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK" | null;
  sortBy?: "BEST_MATCH" | "SOONEST" | "NEAREST" | "NEWEST" | "HIGHEST_PAY" | null;
}): Promise<DriverJobFeedResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  const driver = await this.prisma.driver.findUnique({
    where: { id: input.driverId },
    select: {
      id: true,
      status: true,
      alerts: {
        select: {
          enabled: true,
        },
      },
      preferences: {
        select: {
          radiusMiles: true,
          city: true,
        },
      },
      districts: {
        select: {
          district: {
            select: {
              id: true,
              code: true,
              name: true,
              active: true,
            },
          },
        },
      },
      location: {
        select: {
          currentLat: true,
          currentLng: true,
          currentAt: true,
          homeBaseLat: true,
          homeBaseLng: true,
          homeBaseCity: true,
          homeBaseState: true,
        },
      },
    },
  });

  if (!driver) {
    throw new NotFoundException("Driver not found");
  }

  // Relaxed: allow PENDING drivers to browse gigs (they just can't book until approved)
  if (driver.status === EnumDriverStatus.SUSPENDED) {
    return { items: [], nextCursor: null };
  }

  // Removed: alerts.enabled gate — was silently hiding all gigs for many drivers

  // Relaxed: allow drivers with an active assignment to still browse available gigs
  // (the booking endpoint already handles preventing double-booking)
  // const busyAssignment = ... — removed hard block

  const preferredCity = driver.preferences?.city?.trim().toLowerCase() ?? null;
  const preferredRadiusMiles = driver.preferences?.radiusMiles ?? null;
  // When radiusMiles is null from the controller, it means "Any distance" was selected
  // on the frontend — respect that and show all gigs. Only apply preference radius
  // when a specific numeric radius was explicitly chosen.
  const inputRadius =
    input.radiusMiles != null && Number.isFinite(Number(input.radiusMiles))
      ? Number(input.radiusMiles)
      : null;
  const effectiveRadiusMiles = inputRadius ?? null; // "ANY" = no radius limit

  const normalizedSearch = input.search?.trim().toLowerCase() ?? null;
  const normalizedDatePreset = input.datePreset ?? "ALL";
  const normalizedSortBy = input.sortBy ?? "BEST_MATCH";

  const districtNames = new Set(
    (driver.districts ?? [])
      .map((d) => d.district?.name?.trim().toLowerCase())
      .filter(Boolean) as string[]
  );

  const districtCodes = new Set(
    (driver.districts ?? [])
      .map((d) => d.district?.code?.trim().toLowerCase())
      .filter(Boolean) as string[]
  );

  const origin = this.resolveDriverOrigin(driver.location ?? null);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);

  // End of this week: Sunday 23:59:59.999
  const endOfWeek = new Date(todayStart);
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  endOfWeek.setDate(todayStart.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);

  const deliveries = await this.prisma.deliveryRequest.findMany({
    where: {
      status: EnumDeliveryRequestStatus.LISTED,
      pickupWindowEnd: { gte: now },
      ...(input.urgentOnly === true ? { isUrgent: true } : {}),
      ...(input.serviceType ? { serviceType: input.serviceType as any } : {}),
      ...(input.cursor ? { id: { lt: input.cursor } } : {}),
      ...(normalizedDatePreset === "TODAY"
        ? {
            pickupWindowStart: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          }
        : {}),
      ...(normalizedDatePreset === "TOMORROW"
        ? {
            pickupWindowStart: {
              gte: tomorrowStart,
              lt: dayAfterTomorrowStart,
            },
          }
        : {}),
      ...(normalizedDatePreset === "THIS_WEEK"
        ? {
            pickupWindowStart: {
              gte: todayStart,
              lte: endOfWeek,
            },
          }
        : {}),
      assignments: {
        none: {
          unassignedAt: null,
        },
      },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      serviceType: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupLat: true,
      pickupLng: true,
      dropoffLat: true,
      dropoffLng: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      dropoffWindowStart: true,
      dropoffWindowEnd: true,
      etaMinutes: true,
      isUrgent: true,
      afterHours: true,
      urgentBonusAmount: true,
      customer: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          contactEmail: true,
        },
      },
      quote: {
        select: {
          estimatedPrice: true,
          pricingSnapshot: true,
          feesBreakdown: true,
        },
      },
    },
    orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const prelim = deliveries
    .filter((delivery) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        delivery.id,
        delivery.pickupAddress,
        delivery.dropoffAddress,
        delivery.customer?.businessName,
        delivery.customer?.contactName,
        delivery.customer?.contactEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .map((delivery) => {
      let score = 50;
      const reasons: string[] = ["listed"];

      if (delivery.isUrgent) {
        score += 25;
        reasons.push("urgent");
      }

      if (delivery.afterHours) {
        score += 5;
        reasons.push("after-hours");
      }

      const pickup = delivery.pickupAddress.toLowerCase();
      const dropoff = delivery.dropoffAddress.toLowerCase();

      let districtMatched = false;

      for (const name of districtNames) {
        if (pickup.includes(name) || dropoff.includes(name)) {
          districtMatched = true;
          break;
        }
      }

      if (!districtMatched) {
        for (const code of districtCodes) {
          if (pickup.includes(code) || dropoff.includes(code)) {
            districtMatched = true;
            break;
          }
        }
      }

      if (districtMatched) {
        score += 20;
        reasons.push("district-match");
      }

      if (preferredCity) {
        const cityMatched =
          pickup.includes(preferredCity) || dropoff.includes(preferredCity);

        if (cityMatched) {
          score += 15;
          reasons.push("city-match");
        }
      }

      if (delivery.pickupWindowStart) {
        const hoursUntilPickup =
          (delivery.pickupWindowStart.getTime() - Date.now()) / 3600000;

        if (hoursUntilPickup <= 4) {
          score += 10;
          reasons.push("pickup-soon");
        } else if (hoursUntilPickup <= 24) {
          score += 5;
          reasons.push("pickup-today");
        }
      }

      return {
        delivery,
        baseScore: score,
        baseReasons: reasons,
      };
    });

  const finalists = prelim
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, 30);

  const rankedRaw: Array<DriverFeedItem | null> = await Promise.all(
    finalists.map(async ({ delivery, baseScore, baseReasons }) => {
      let matchScore = baseScore;
      const matchReasons = [...baseReasons];
      let pickupDistanceMiles: number | null = null;
      let pickupEtaMinutes: number | null = null;

      if (origin.source === "current") {
        matchReasons.push("origin-current-location");
      } else if (origin.source === "homeBase") {
        matchReasons.push("origin-home-base");
      } else {
        matchReasons.push("origin-none");
      }

      if (
        origin.lat != null &&
        origin.lng != null &&
        delivery.pickupLat != null &&
        delivery.pickupLng != null
      ) {
        try {
          const route = await this.mapsService.computeRouteMetrics({
            originLat: origin.lat,
            originLng: origin.lng,
            destinationLat: delivery.pickupLat,
            destinationLng: delivery.pickupLng,
          });

          pickupDistanceMiles = route.distanceMiles;
          pickupEtaMinutes = route.durationMinutes;

          if (effectiveRadiusMiles != null) {
            if (route.distanceMiles <= effectiveRadiusMiles) {
              matchScore += 10;
              matchReasons.push("within-radius");
            } else {
              matchReasons.push("outside-radius");
              return null;
            }
          }

          if (route.distanceMiles <= 10) {
            matchScore += 25;
            matchReasons.push("pickup-nearby");
          } else if (route.distanceMiles <= 25) {
            matchScore += 15;
            matchReasons.push("pickup-close");
          } else if (route.distanceMiles <= 50) {
            matchScore += 5;
            matchReasons.push("pickup-reachable");
          }

          if (route.durationMinutes <= 20) {
            matchScore += 15;
            matchReasons.push("pickup-fast-eta");
          } else if (route.durationMinutes <= 45) {
            matchScore += 8;
            matchReasons.push("pickup-good-eta");
          }
        } catch {
          matchReasons.push("geo-unavailable");
        }
      } else {
        matchReasons.push("geo-fallback");
      }

      const payoutPreviewAmount = this.extractPayoutPreviewAmount(
        delivery.quote?.estimatedPrice,
        delivery.quote?.pricingSnapshot,
        delivery.quote?.feesBreakdown
      );

      const item: DriverFeedItem = {
        deliveryId: delivery.id,
        serviceType: delivery.serviceType,
        status: delivery.status,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        pickupWindowStart: delivery.pickupWindowStart,
        pickupWindowEnd: delivery.pickupWindowEnd,
        dropoffWindowStart: delivery.dropoffWindowStart,
        dropoffWindowEnd: delivery.dropoffWindowEnd,
        etaMinutes: delivery.etaMinutes,
        isUrgent: delivery.isUrgent,
        afterHours: delivery.afterHours,
        urgentBonusAmount:
          delivery.urgentBonusAmount != null
            ? Number(delivery.urgentBonusAmount)
            : null,
        payoutPreviewAmount,
        matchScore: Number(matchScore.toFixed(2)),
        matchReasons,
        pickupDistanceMiles,
        pickupEtaMinutes,
        pickupLat: delivery.pickupLat,
        pickupLng: delivery.pickupLng,
        dropoffLat: delivery.dropoffLat,
        dropoffLng: delivery.dropoffLng,
        originSource: origin.source,
        createdAt: delivery.createdAt,
      };

      return item;
    })
  );

  const ranked = rankedRaw.filter(
    (item): item is DriverFeedItem => item !== null
  );

  ranked.sort((a, b) => {
    if (normalizedSortBy === "SOONEST") {
      const aStart = a.pickupWindowStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = b.pickupWindowStart?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;
      return b.createdAt.getTime() - a.createdAt.getTime();
    }

    if (normalizedSortBy === "NEAREST") {
      const aDist = a.pickupDistanceMiles ?? Number.MAX_SAFE_INTEGER;
      const bDist = b.pickupDistanceMiles ?? Number.MAX_SAFE_INTEGER;
      if (aDist !== bDist) return aDist - bDist;
      return b.createdAt.getTime() - a.createdAt.getTime();
    }

    if (normalizedSortBy === "NEWEST") {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }

    if (normalizedSortBy === "HIGHEST_PAY") {
      const aPay = a.payoutPreviewAmount ?? 0;
      const bPay = b.payoutPreviewAmount ?? 0;
      if (bPay !== aPay) return bPay - aPay;
      return b.createdAt.getTime() - a.createdAt.getTime();
    }

    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;

    const aEta = a.pickupEtaMinutes ?? Number.MAX_SAFE_INTEGER;
    const bEta = b.pickupEtaMinutes ?? Number.MAX_SAFE_INTEGER;
    if (aEta !== bEta) return aEta - bEta;

    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const items: DriverFeedItem[] = ranked.slice(0, limit);
  const nextCursor =
    ranked.length > limit && items.length > 0
      ? items[items.length - 1].deliveryId
      : null;

  return {
    items,
    nextCursor,
  };
}
  async getDriverJobDetail(input: {
    driverId: string;
    deliveryId: string;
  }): Promise<DriverFeedItem | null> {
    // Don't assert booking eligibility here — drivers should be able to
    // browse gig details freely. The booking endpoint enforces restrictions.
    const feed = await this.getDriverJobFeed({
      driverId: input.driverId,
      limit: 50,
    });

    return (
      feed.items.find((item) => item.deliveryId === input.deliveryId) ?? null
    );
  }

  async getActiveDeliveryForDriver(driverId: string) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        driverId,
        unassignedAt: null,
        delivery: {
          status: {
            in: [
              EnumDeliveryRequestStatus.BOOKED,
              EnumDeliveryRequestStatus.ACTIVE,
            ],
          },
        },
      },
      select: {
        id: true,
        deliveryId: true,
        assignedByUserId: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            serviceType: true,
            pickupAddress: true,
            dropoffAddress: true,
            pickupLat: true,
            pickupLng: true,
            dropoffLat: true,
            dropoffLng: true,
            pickupWindowStart: true,
            pickupWindowEnd: true,
            dropoffWindowStart: true,
            dropoffWindowEnd: true,
            etaMinutes: true,
            isUrgent: true,
            afterHours: true,
            urgentBonusAmount: true,
            licensePlate: true,
            vehicleColor: true,
            vehicleMake: true,
            vehicleModel: true,
            vinVerificationCode: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
                contactPhone: true,
                contactEmail: true,
              },
            },
            recipientName: true,
            recipientPhone: true,
            recipientEmail: true,
            compliance: {
              select: {
                id: true,
                odometerStart: true,
                odometerEnd: true,
                pickupCompletedAt: true,
                dropoffCompletedAt: true,
              },
            },
            quote: {
              select: {
                id: true,
                distanceMiles: true,
                estimatedPrice: true,
                pricingMode: true,
                mileageCategory: true,
              },
            },
            trackingSession: {
              select: {
                id: true,
                startedAt: true,
                stoppedAt: true,
                status: true,
                drivenMiles: true,
              },
            },
            evidence: {
              select: {
                id: true,
                slotIndex: true,
                imageUrl: true,
                phase: true,
                type: true,
              },
            },
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return assignment ?? null;
  }

  async assertDriverCanBookDelivery(
  db: DbClient,
  input: {
    driverId: string;
    deliveryId: string;
  }
): Promise<void> {
  const driver = await db.driver.findUnique({
    where: { id: input.driverId },
    select: {
      id: true,
      status: true,
      alerts: {
        select: {
          enabled: true,
        },
      },
      preferences: {
        select: {
          radiusMiles: true,
        },
      },
      location: {
        select: {
          currentLat: true,
          currentLng: true,
          currentAt: true,
          homeBaseLat: true,
          homeBaseLng: true,
        },
      },
    },
  });

  if (!driver) {
    throw new NotFoundException("Driver not found");
  }

  if (driver.status !== EnumDriverStatus.APPROVED) {
    throw new ForbiddenException("Driver account is not approved — cannot book deliveries");
  }

  // NOTE: alerts.enabled gate removed here to match feed behavior.
  // Drivers with disabled push notifications can still browse and book.
  // (Previously this silently blocked booking for many drivers.)

  const delivery = await db.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      pickupLat: true,
      pickupLng: true,
    },
  });

  if (!delivery) {
    throw new NotFoundException("Delivery request not found");
  }

  if (delivery.status !== EnumDeliveryRequestStatus.LISTED) {
    throw new GoneException("This gig is no longer available");
  }

  const existingBooking = await db.deliveryAssignment.findFirst({
    where: {
      deliveryId: input.deliveryId,
      unassignedAt: null,
    },
    select: { id: true },
  });

  if (existingBooking) {
    throw new GoneException("This gig has already been booked by another driver");
  }

  const busyAssignment = await db.deliveryAssignment.findFirst({
    where: {
      driverId: input.driverId,
      unassignedAt: null,
      delivery: {
        status: {
          in: [
            EnumDeliveryRequestStatus.BOOKED,
            EnumDeliveryRequestStatus.ACTIVE,
          ],
        },
      },
    },
    select: { id: true },
  });

  if (busyAssignment) {
    throw new ConflictException("You already have an active delivery — complete it before booking another");
  }

  const preferredRadiusMiles = driver.preferences?.radiusMiles ?? null;
  const origin = this.resolveDriverOrigin(driver.location ?? null);

  // Service radius check disabled temporarily for testing.
  // if (
  //   preferredRadiusMiles != null &&
  //   origin.lat != null &&
  //   origin.lng != null &&
  //   delivery.pickupLat != null &&
  //   delivery.pickupLng != null
  // ) {
  //   const samePoint =
  //     Math.abs(origin.lat - delivery.pickupLat) < 0.000001 &&
  //     Math.abs(origin.lng - delivery.pickupLng) < 0.000001;
  //
  //   if (!samePoint) {
  //     try {
  //       const route = await this.mapsService.computeRouteMetrics({
  //         originLat: origin.lat,
  //         originLng: origin.lng,
  //         destinationLat: delivery.pickupLat,
  //         destinationLng: delivery.pickupLng,
  //       });
  //
  //       if (route.distanceMiles > preferredRadiusMiles) {
  //         throw new NotFoundException(
  //           "Delivery is outside the driver's service radius"
  //         );
  //       }
  //     } catch (error) {
  //       if (error instanceof NotFoundException) {
  //         throw error;
  //       }
  //
  //       throw new NotFoundException(
  //         "Unable to validate driver service radius for this delivery"
  //       );
  //     }
  //   }
  // }
}


  private resolveDriverOrigin(location: {
    currentLat?: number | null;
    currentLng?: number | null;
    currentAt?: Date | null;
    homeBaseLat?: number | null;
    homeBaseLng?: number | null;
  } | null): DriverOrigin {
    if (
      location?.currentLat != null &&
      location?.currentLng != null &&
      location.currentAt != null
    ) {
      const ageMs = Date.now() - new Date(location.currentAt).getTime();
      const isFresh = ageMs <= 15 * 60 * 1000;

      if (isFresh) {
        return {
          lat: location.currentLat,
          lng: location.currentLng,
          source: "current",
        };
      }
    }

    if (location?.homeBaseLat != null && location?.homeBaseLng != null) {
      return {
        lat: location.homeBaseLat,
        lng: location.homeBaseLng,
        source: "homeBase",
      };
    }

    return {
      lat: null,
      lng: null,
      source: "none",
    };
  }

  private extractPayoutPreviewAmount(
    quoteEstimatedPrice: number | null | undefined,
    pricingSnapshot: unknown,
    feesBreakdown: unknown
  ): number | null {
    const snapshot = (pricingSnapshot ?? {}) as Record<string, unknown>;
    const fees = (feesBreakdown ?? {}) as Record<string, unknown>;

    // Total price: feesBreakdown.total (set by pricing engine) or quote.estimatedPrice
    const total =
      this.toNumber(fees.total) ??
      this.toNumber(snapshot.totalAmount) ??
      this.toNumber(snapshot.finalAmount) ??
      (quoteEstimatedPrice != null ? quoteEstimatedPrice : null);

    if (total == null) return null;

    // Driver share percentage from pricing snapshot (frozen at quote time)
    const driverSharePct = this.toNumber(snapshot.driverSharePct) ?? 60;

    // Net payout = total × driverShare% (no tip at listing time — tips are post-completion)
    const payout = total * (driverSharePct / 100);
    return Number(payout.toFixed(2));
  }

  private toNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
}
