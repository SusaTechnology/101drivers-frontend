import { Injectable, NotFoundException, ForbiddenException, GoneException, ConflictException } from "@nestjs/common";
import { businessStartOfDay, businessStartOfTomorrow, businessStartOfDayAfterTomorrow, businessEndOfWeek, businessNow, businessIsSameDay } from "./business-time";
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

export type StackingDetails = {
  /** Which check failed */
  checkType: 'backward' | 'forward' | 'radius' | null;
  /** Whether the conflict spans different calendar days (buffer waived for cross-day) */
  isCrossDay: boolean;
  /** The booked delivery that conflicts with this gig */
  conflictingDelivery: {
    id: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupWindowStart: string | null;
    estimatedFinishTime: string | null;
    etaMinutes: number | null;
  } | null;
  /** Breakdown of transit time between locations */
  transit: {
    driveMinutes: number;
    driveMiles: number;
    bufferMinutes: number;
    totalNeededMinutes: number;
    availableMinutes: number;
  } | null;
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
  /** If set, this gig cannot be booked right now. Contains the human-readable reason. */
  stackingBlocked: string | null;
  /** Structured stacking conflict details for rich UI display. */
  stackingDetails: StackingDetails | null;
  /** If true, pickup is outside the driver's preferred radius filter. */
  outsidePreferredRadius: boolean;
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

  const now = businessNow().toJSDate();
  const todayStart = businessStartOfDay();

  const tomorrowStart = businessStartOfTomorrow();

  const dayAfterTomorrowStart = businessStartOfDayAfterTomorrow();

  // End of this week: Sunday 23:59:59.999
  const endOfWeek = businessEndOfWeek();

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
              // Don't hide — flag it so the UI can show a badge
              matchScore -= 15;
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

      // ── Stacking + Radius Checks (feed filter) ──
      // Instead of comparing raw time windows (which blocked all gigs in the
      // same 2-hour slot), we now estimate when the driver actually finishes
      // each existing delivery and check if they can reach the next pickup.
      //
      // Logic: estimatedFinish_prev + driveTime_prev→new + buffer ≤ newPickup
      //
      // Gigs that can't stack are still returned (with stackingBlocked reason)
      // so drivers see them with an info flag instead of "no gigs available".
      let stackingBlockedReason: string | null = null;
      let stackingDetails: StackingDetails | null = null;
      try {
        const deliverySettings = await this.getDeliverySettings();
        const newPickupMs = delivery.pickupWindowStart
          ? new Date(delivery.pickupWindowStart).getTime()
          : null;

        // Fetch all BOOKED/ACTIVE assignments with etaMinutes for duration estimation
        let sortedExisting: {
          id: string;
          pickupAddress: string;
          dropoffAddress: string;
          pickupWindowStart: Date | string | null;
          dropoffWindowEnd: Date | string | null;
          dropoffLat: number | null;
          dropoffLng: number | null;
          etaMinutes: number | null;
        }[] = [];

        if (newPickupMs) {
          const assignments = await this.prisma.deliveryAssignment.findMany({
            where: {
              driverId: input.driverId,
              unassignedAt: null,
              delivery: {
                status: { in: [EnumDeliveryRequestStatus.ACTIVE, EnumDeliveryRequestStatus.BOOKED] },
              },
            },
            orderBy: { createdAt: "asc" },
            select: {
              delivery: {
                select: {
                  id: true,
                  pickupAddress: true,
                  dropoffAddress: true,
                  pickupWindowStart: true,
                  dropoffWindowEnd: true,
                  dropoffLat: true,
                  dropoffLng: true,
                  etaMinutes: true,
                },
              },
            },
          });

          sortedExisting = assignments.map(a => ({
            id: a.delivery.id,
            pickupAddress: a.delivery.pickupAddress,
            dropoffAddress: a.delivery.dropoffAddress,
            pickupWindowStart: a.delivery.pickupWindowStart,
            dropoffWindowEnd: a.delivery.dropoffWindowEnd,
            dropoffLat: a.delivery.dropoffLat,
            dropoffLng: a.delivery.dropoffLng,
            etaMinutes: a.delivery.etaMinutes,
          })).sort(
            (a, b) => new Date(a.pickupWindowStart!).getTime() - new Date(b.pickupWindowStart!).getTime()
          );
        }

        // Helper: estimate when driver finishes a delivery.
        // Uses pickupWindowStart + etaMinutes (actual drive time).
        // Falls back to pickupWindowEnd if no etaMinutes.
        const estimateFinishMs = (d: typeof sortedExisting[number]): number | null => {
          if (!d.pickupWindowStart) return null;
          const pickupMs = new Date(d.pickupWindowStart).getTime();
          if (d.etaMinutes != null && d.etaMinutes > 0) {
            return pickupMs + d.etaMinutes * 60 * 1000;
          }
          // Fallback: use pickupWindowEnd (less accurate but safe)
          if (d.dropoffWindowEnd) {
            return new Date(d.dropoffWindowEnd).getTime();
          }
          return null;
        };

        // Helper: estimate drive time between two points using haversine.
        // ~30 mph average urban speed → 2 minutes per mile.
        const estimateDriveMinutes = (fromLat: number, fromLng: number, toLat: number, toLng: number): number => {
          const miles = this.haversineFallback(fromLat, fromLng, toLat, toLng);
          return Math.ceil(miles * 2); // ~30 mph avg in city
        };

        // ── BACKWARD CHECK ──
        // Find the anchor delivery: the latest-finishing BOOKED/ACTIVE delivery
        // that overlaps with or precedes the new pickup window.
        // We compare against pickupWindowEnd (not pickupWindowStart) so that
        // deliveries with the same pickup start but different durations are
        // properly detected as constraints.
        const newWindowEndMs = delivery.pickupWindowEnd
          ? new Date(delivery.pickupWindowEnd).getTime()
          : newPickupMs!;

        let anchorDropoff: { finishMs: number; dropoffLat: number | null; dropoffLng: number | null; anchorDate: Date | null; anchorDelivery: typeof sortedExisting[number] | null } | null = null;

        if (newPickupMs && sortedExisting.length > 0) {
          for (const ex of sortedExisting) {
            const finishMs = estimateFinishMs(ex);
            if (finishMs === null) continue;

            const exPickupMs = ex.pickupWindowStart
              ? new Date(ex.pickupWindowStart).getTime()
              : null;

            // Skip deliveries that start after the new window ends — those
            // are future gigs handled by the forward check.
            if (exPickupMs !== null && exPickupMs > newWindowEndMs) break;

            // This delivery overlaps with or precedes the new pickup window.
            // Track the one that finishes latest as the anchor.
            if (!anchorDropoff || finishMs > anchorDropoff.finishMs) {
              anchorDropoff = { finishMs, dropoffLat: ex.dropoffLat, dropoffLng: ex.dropoffLng, anchorDate: ex.pickupWindowStart ? new Date(ex.pickupWindowStart) : null, anchorDelivery: ex };
            }
          }

          // If no anchor found among BOOKED/ACTIVE, check last completed delivery today
          if (!anchorDropoff) {
            const lastCompleted = await this.getLastCompletedDropoff(input.driverId);
            if (lastCompleted) {
              anchorDropoff = { finishMs: lastCompleted.updatedAt.getTime(), dropoffLat: lastCompleted.dropoffLat, dropoffLng: lastCompleted.dropoffLng, anchorDate: lastCompleted.updatedAt, anchorDelivery: null };
            }
          }

          // Validate: can the driver reach the new pickup before the window closes?
          if (anchorDropoff && delivery.pickupLat != null && delivery.pickupLng != null) {
            let driveMinutes: number | null = null;
            if (anchorDropoff.dropoffLat != null && anchorDropoff.dropoffLng != null) {
              driveMinutes = estimateDriveMinutes(anchorDropoff.dropoffLat, anchorDropoff.dropoffLng, delivery.pickupLat, delivery.pickupLng);
            }
            // Cross-day stacking: no buffer, only estimated drive time.
            // Same-day stacking: apply transit buffer for safety margin.
            const crossDay = anchorDropoff.anchorDate && delivery.pickupWindowStart
              ? !businessIsSameDay(delivery.pickupWindowStart, anchorDropoff.anchorDate)
              : true; // default to no buffer if we can't determine
            const bufferMs = crossDay ? 0 : deliverySettings.transitBufferMinutes * 60 * 1000;
            const driveMs = driveMinutes ? driveMinutes * 60 * 1000 : 0;
            const earliestArrivalMs = anchorDropoff.finishMs + driveMs + bufferMs;

            // The driver can start the gig as long as they arrive before the
            // pickup window ENDS — they don't have to be there at window start.
            if (newWindowEndMs < earliestArrivalMs) {
              const neededMin = Math.ceil((earliestArrivalMs - anchorDropoff.finishMs) / 60000);
              const availableMin = Math.max(0, Math.ceil((newWindowEndMs - anchorDropoff.finishMs) / 60000));
              const bufferNote = crossDay ? '' : ' (drive + buffer)';
              stackingBlockedReason = `Not enough time after your previous delivery. You need ~${neededMin} min${bufferNote} but only ${availableMin} min before this pickup window closes.`;
              matchReasons.push("stacking-blocked-backward");
              const driveMilesVal = anchorDropoff.dropoffLat != null && anchorDropoff.dropoffLng != null && delivery.pickupLat != null && delivery.pickupLng != null
                ? this.haversineFallback(anchorDropoff.dropoffLat, anchorDropoff.dropoffLng, delivery.pickupLat, delivery.pickupLng)
                : 0;
              stackingDetails = {
                checkType: 'backward',
                isCrossDay: crossDay,
                conflictingDelivery: anchorDropoff.anchorDelivery ? {
                  id: anchorDropoff.anchorDelivery.id,
                  pickupAddress: anchorDropoff.anchorDelivery.pickupAddress,
                  dropoffAddress: anchorDropoff.anchorDelivery.dropoffAddress,
                  pickupWindowStart: anchorDropoff.anchorDelivery.pickupWindowStart ?? null,
                  estimatedFinishTime: new Date(anchorDropoff.finishMs).toISOString(),
                  etaMinutes: anchorDropoff.anchorDelivery.etaMinutes,
                } : null,
                transit: {
                  driveMinutes: driveMinutes ?? 0,
                  driveMiles: Math.round(driveMilesVal * 10) / 10,
                  bufferMinutes: crossDay ? 0 : deliverySettings.transitBufferMinutes,
                  totalNeededMinutes: neededMin,
                  availableMinutes: availableMin,
                },
              };
            }
          }
        }

        // ── FORWARD CHECK ──
        // If this new delivery were booked, would it block an existing next delivery?
        // Check: newEstimatedFinish + driveTime_new→next + buffer ≤ nextPickup
        if (!stackingBlockedReason && newPickupMs && sortedExisting.length > 0) {
          const newEtaMinutes = delivery.etaMinutes ?? 30; // reasonable default if missing
          const newFinishMs = newPickupMs + newEtaMinutes * 60 * 1000;

          for (const ex of sortedExisting) {
            if (!ex.pickupWindowStart) continue;
            const exPickupMs = new Date(ex.pickupWindowStart).getTime();

            // Only check deliveries that start after the new delivery finishes
            if (exPickupMs > newFinishMs) {
              let driveMinutes: number | null = null;
              if (delivery.dropoffLat != null && delivery.dropoffLng != null &&
                  ex.dropoffLat != null && ex.dropoffLng != null) {
                // Drive from NEW delivery's dropoff to EXISTING delivery's pickup
                // Use existing delivery's pickup coords as destination proxy
              }
              if (delivery.dropoffLat != null && delivery.dropoffLng != null &&
                  ex.dropoffLat != null && ex.dropoffLng != null) {
                driveMinutes = estimateDriveMinutes(delivery.dropoffLat, delivery.dropoffLng, ex.dropoffLat, ex.dropoffLng);
              }
              // Cross-day: no buffer. Same-day: apply transit buffer.
              const crossDayForward = delivery.pickupWindowStart && ex.pickupWindowStart
                ? !businessIsSameDay(delivery.pickupWindowStart, ex.pickupWindowStart)
                : true;
              const bufferMs = crossDayForward ? 0 : deliverySettings.transitBufferMinutes * 60 * 1000;
              const driveMs = driveMinutes ? driveMinutes * 60 * 1000 : 0;
              const earliestArrivalMs = newFinishMs + driveMs + bufferMs;

              if (exPickupMs < earliestArrivalMs) {
                const neededMin = Math.ceil((earliestArrivalMs - newFinishMs) / 60000);
                const availableMin = Math.max(0, Math.ceil((exPickupMs - newFinishMs) / 60000));
                stackingBlockedReason = `This delivery would make you late for your next booking. You'd need ~${neededMin} min but only ${availableMin} min available.`;
                matchReasons.push("stacking-blocked-forward");
                const driveMilesVal = delivery.dropoffLat != null && delivery.dropoffLng != null && ex.dropoffLat != null && ex.dropoffLng != null
                  ? this.haversineFallback(delivery.dropoffLat, delivery.dropoffLng, ex.dropoffLat, ex.dropoffLng)
                  : 0;
                stackingDetails = {
                  checkType: 'forward',
                  isCrossDay: crossDayForward,
                  conflictingDelivery: {
                    id: ex.id,
                    pickupAddress: ex.pickupAddress,
                    dropoffAddress: ex.dropoffAddress,
                    pickupWindowStart: ex.pickupWindowStart ?? null,
                    estimatedFinishTime: null,
                    etaMinutes: ex.etaMinutes,
                  },
                  transit: {
                    driveMinutes: driveMinutes ?? 0,
                    driveMiles: Math.round(driveMilesVal * 10) / 10,
                    bufferMinutes: crossDayForward ? 0 : deliverySettings.transitBufferMinutes,
                    totalNeededMinutes: neededMin,
                    availableMinutes: availableMin,
                  },
                };
              }
              break; // Only check the immediately next delivery
            }
          }
        }

        // ── RADIUS CHECK (same-day only: distance cap from last dropoff) ──
        // The 20-mile radius rule only applies when the new gig and the
        // anchor (previous) gig are on the SAME calendar day.
        // If they're on different days (e.g., last drop-off was today but
        // new pickup is tomorrow), no distance restriction applies.
        const isSameDayAsAnchor = delivery.pickupWindowStart && anchorDropoff?.anchorDate
          ? businessIsSameDay(delivery.pickupWindowStart, anchorDropoff.anchorDate)
          : false;
        if (
          !stackingBlockedReason &&
          isSameDayAsAnchor &&
          anchorDropoff &&
          anchorDropoff.dropoffLat != null &&
          anchorDropoff.dropoffLng != null &&
          delivery.pickupLat != null &&
          delivery.pickupLng != null
        ) {
          const straightMiles = this.haversineFallback(
            anchorDropoff.dropoffLat,
            anchorDropoff.dropoffLng,
            delivery.pickupLat,
            delivery.pickupLng,
          );
          if (straightMiles > deliverySettings.maximumRadiusMiles * 1.3) {
            stackingBlockedReason = `Pickup is too far from your last drop-off (>${deliverySettings.maximumRadiusMiles} miles).`;
            matchReasons.push("outside-max-radius");
            stackingDetails = {
              checkType: 'radius',
              isCrossDay: false,
              conflictingDelivery: anchorDropoff?.anchorDelivery ? {
                id: anchorDropoff.anchorDelivery.id,
                pickupAddress: anchorDropoff.anchorDelivery.pickupAddress,
                dropoffAddress: anchorDropoff.anchorDelivery.dropoffAddress,
                pickupWindowStart: anchorDropoff.anchorDelivery.pickupWindowStart ?? null,
                estimatedFinishTime: new Date(anchorDropoff.finishMs).toISOString(),
                etaMinutes: anchorDropoff.anchorDelivery.etaMinutes,
              } : null,
              transit: {
                driveMinutes: 0,
                driveMiles: Math.round(straightMiles * 10) / 10,
                bufferMinutes: 0,
                totalNeededMinutes: 0,
                availableMinutes: 0,
              },
            };
          }
        }
      } catch {
        // If stacking check fails, don't block the feed — let the gig show as bookable
      }

      // Don't hide stacking-blocked gigs — return them with the reason
      // so the UI can show a flag and block accept at tap time.

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
        stackingBlocked: stackingBlockedReason,
        stackingDetails,
        outsidePreferredRadius: matchReasons.includes("outside-radius"),
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
    const assignments = await this.prisma.deliveryAssignment.findMany({
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
      orderBy: { createdAt: "asc" },
    });

    // Sort so ACTIVE comes first, then BOOKED in chronological order
    const sorted = assignments.sort((a, b) => {
      const aActive = a.delivery.status === EnumDeliveryRequestStatus.ACTIVE ? 0 : 1;
      const bActive = b.delivery.status === EnumDeliveryRequestStatus.ACTIVE ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(a.delivery.pickupWindowStart!).getTime() - new Date(b.delivery.pickupWindowStart!).getTime();
    });

    return sorted;
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
      dropoffLat: true,
      dropoffLng: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      dropoffWindowEnd: true,
      etaMinutes: true,
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

  // Multi-booking allowed: drivers can BOOK multiple deliveries while having one ACTIVE.
  // The "one ACTIVE at a time" constraint is enforced at start-trip (delivery-lifecycle.service.ts).
  // Time buffer and radius checks below still apply.

  const preferredRadiusMiles = driver.preferences?.radiusMiles ?? null;
  const origin = this.resolveDriverOrigin(driver.location ?? null);

  // Service radius check disabled temporarily for testing.
  // The new radius check is below: Maximum Radius from previous drop-off.
  // if (
  //   preferredRadiusMiles != null &&
  //   origin.lat != null &&
  //   origin.lng != null &&
  //   delivery.pickupLat != null &&
  //   delivery.pickupLng != null
  // ) {
  //   ... (original code removed)
  // }

  // ── Maximum Radius Check (from previous drop-off) ──
  // Only applies to 2nd delivery onward. First pickup of the day is exempt.
  // Checks that new pickup is within maximumRadius miles of the driver's
  // last completed drop-off location.
  const DELIVERY_SETTINGS_KEY = "DELIVERY_SETTINGS";

  const DEFAULT_MAX_RADIUS_MILES = 20;
  const DEFAULT_TRANSIT_BUFFER_MINUTES = 45;

  let deliverySettings: {
    maximumRadiusMiles: number;
    transitBufferMinutes: number;
  } = { maximumRadiusMiles: DEFAULT_MAX_RADIUS_MILES, transitBufferMinutes: DEFAULT_TRANSIT_BUFFER_MINUTES };

  try {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: DELIVERY_SETTINGS_KEY },
    });
    if (setting?.value && typeof setting.value === "object") {
      const v = setting.value as any;
      if (typeof v.maximumRadiusMiles === "number") deliverySettings.maximumRadiusMiles = v.maximumRadiusMiles;
      if (typeof v.transitBufferMinutes === "number") deliverySettings.transitBufferMinutes = v.transitBufferMinutes;
    }
  } catch {
    // Use defaults if settings not found
  }

  // Find the driver's most recent delivery that determines where they will be.
  // Priority: ACTIVE (in-progress) > BOOKED (next up) > COMPLETED today.
  // Radius + buffer checks use this delivery's drop-off as the origin.
  // First pickup of the day is exempt if no ACTIVE/BOOKED/COMPLETED exists.
  const startOfToday = businessStartOfDay();

  // Get all of driver's current assignments (ACTIVE + BOOKED) ordered by creation
  const currentAssignments = await db.deliveryAssignment.findMany({
    where: {
      driverId: input.driverId,
      unassignedAt: null,
      delivery: {
        status: {
          in: [
            EnumDeliveryRequestStatus.ACTIVE,
            EnumDeliveryRequestStatus.BOOKED,
          ],
        },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      deliveryId: true,
      delivery: {
        select: {
          id: true,
          status: true,
          pickupWindowStart: true,
          pickupWindowEnd: true,
          dropoffWindowEnd: true,
          dropoffLat: true,
          dropoffLng: true,
          pickupLat: true,
          pickupLng: true,
          etaMinutes: true,
          updatedAt: true,
        },
      },
    },
  });

  const sortedAssignments = currentAssignments.map(a => a.delivery).sort(
    (a, b) => new Date(a.pickupWindowStart!).getTime() - new Date(b.pickupWindowStart!).getTime()
  );

  // ── Helper: estimate when a delivery actually finishes ──
  // Uses pickupWindowStart + etaMinutes (drive time). Falls back to dropoffWindowEnd.
  const estimateFinishMs = (d: typeof sortedAssignments[number]): number | null => {
    if (!d.pickupWindowStart) return null;
    const pickupMs = new Date(d.pickupWindowStart).getTime();
    if (d.etaMinutes != null && d.etaMinutes > 0) {
      return pickupMs + d.etaMinutes * 60 * 1000;
    }
    if (d.dropoffWindowEnd) {
      return new Date(d.dropoffWindowEnd).getTime();
    }
    return null;
  };

  const newPickupStart = delivery.pickupWindowStart
    ? new Date(delivery.pickupWindowStart).getTime()
    : null;

  // ── BACKWARD CHECK ──
  // Find the anchor delivery: the latest-finishing BOOKED/ACTIVE delivery
  // that overlaps with or precedes the new pickup window.
  // Uses pickupWindowEnd (not pickupWindowStart) so same-window deliveries
  // are properly detected as scheduling constraints.
  const newWindowEndMs = delivery.pickupWindowEnd
    ? new Date(delivery.pickupWindowEnd).getTime()
    : newPickupStart;

  let anchorDelivery: typeof sortedAssignments[number] | null = null;
  if (newPickupStart) {
    for (const assignment of sortedAssignments) {
      const finishMs = estimateFinishMs(assignment);
      if (finishMs === null) continue;

      const exPickupMs = assignment.pickupWindowStart
        ? new Date(assignment.pickupWindowStart).getTime()
        : null;

      // Skip deliveries that start after the new window ends — those
      // are future gigs handled by the forward check.
      if (exPickupMs !== null && exPickupMs > newWindowEndMs!) break;

      // This delivery overlaps with or precedes the new pickup window.
      // Track the one that finishes latest as the anchor.
      if (!anchorDelivery || finishMs > (estimateFinishMs(anchorDelivery) ?? 0)) {
        anchorDelivery = assignment;
      }
    }
  }

  // Fall back to last completed delivery today if no anchor found
  let lastCompletedDelivery: {
    id: string;
    dropoffLat: number | null;
    dropoffLng: number | null;
    updatedAt: Date;
  } | null = null;

  if (!anchorDelivery && newPickupStart) {
    lastCompletedDelivery = await db.deliveryRequest.findFirst({
      where: {
        assignments: {
          some: {
            driverId: input.driverId,
            unassignedAt: null,
          },
        },
        status: EnumDeliveryRequestStatus.COMPLETED,
        updatedAt: { gte: startOfToday },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        dropoffLat: true,
        dropoffLng: true,
        updatedAt: true,
      },
    });
  }

  // Determine reference point for backward check
  const referenceFinishMs = anchorDelivery
    ? estimateFinishMs(anchorDelivery)
    : lastCompletedDelivery
      ? lastCompletedDelivery.updatedAt.getTime()
      : null;

  const referenceDropoffLat = anchorDelivery?.dropoffLat ?? lastCompletedDelivery?.dropoffLat ?? null;
  const referenceDropoffLng = anchorDelivery?.dropoffLng ?? lastCompletedDelivery?.dropoffLng ?? null;

  // ── Radius Check (same-day only: from previous drop-off, using Google Maps) ──
  // The 20-mile radius rule only applies when the new gig and the
  // anchor (previous) gig are on the SAME calendar day.
  // If they're on different days (e.g., last drop-off was today but
  // new pickup is tomorrow), no distance restriction applies.
  const anchorDate = anchorDelivery
    ? (anchorDelivery.pickupWindowStart ? new Date(anchorDelivery.pickupWindowStart) : null)
    : lastCompletedDelivery
      ? lastCompletedDelivery.updatedAt
      : null;
  const isSameDayAsAnchor = delivery.pickupWindowStart && anchorDate
    ? businessIsSameDay(delivery.pickupWindowStart, anchorDate)
    : false;
  if (
    isSameDayAsAnchor &&
    referenceDropoffLat != null &&
    referenceDropoffLng != null &&
    delivery.pickupLat != null &&
    delivery.pickupLng != null
  ) {
    const samePoint =
      Math.abs(referenceDropoffLat - delivery.pickupLat) < 0.000001 &&
      Math.abs(referenceDropoffLng - delivery.pickupLng) < 0.000001;

    if (!samePoint) {
      try {
        const route = await this.mapsService.computeRouteMetrics({
          originLat: referenceDropoffLat,
          originLng: referenceDropoffLng,
          destinationLat: delivery.pickupLat,
          destinationLng: delivery.pickupLng,
        });

        if (route.distanceMiles > deliverySettings.maximumRadiusMiles) {
          throw new ConflictException(
            `Pickup is ${route.distanceMiles.toFixed(1)} miles from your last drop-off. Maximum radius is ${deliverySettings.maximumRadiusMiles} miles.`
          );
        }
      } catch (error) {
        if (error instanceof ConflictException || error instanceof NotFoundException) {
          throw error;
        }
        // If routing fails, use haversine fallback
        const straightMiles = this.haversineFallback(
          referenceDropoffLat,
          referenceDropoffLng,
          delivery.pickupLat,
          delivery.pickupLng,
        );
        if (straightMiles > deliverySettings.maximumRadiusMiles * 1.3) {
          throw new ConflictException(
            `Pickup appears too far from your last drop-off (>${deliverySettings.maximumRadiusMiles} miles).`
          );
        }
      }
    }
  }

  // ── Backward Stacking Check ──
  // Check: estimatedFinish_anchor + driveTime_anchor→new + buffer ≤ newWindowEnd
  // The driver just needs to arrive before the pickup window CLOSES.
  if (referenceFinishMs !== null && newWindowEndMs !== null) {
    let driveMinutes = 0;
    if (
      referenceDropoffLat != null && referenceDropoffLng != null &&
      delivery.pickupLat != null && delivery.pickupLng != null
    ) {
      // Try Google Maps for precise drive time
      try {
        const route = await this.mapsService.computeRouteMetrics({
          originLat: referenceDropoffLat,
          originLng: referenceDropoffLng,
          destinationLat: delivery.pickupLat,
          destinationLng: delivery.pickupLng,
        });
        driveMinutes = route.durationMinutes;
      } catch {
        // Haversine fallback: ~2 min per mile at 30 mph urban average
        const miles = this.haversineFallback(referenceDropoffLat, referenceDropoffLng, delivery.pickupLat, delivery.pickupLng);
        driveMinutes = Math.ceil(miles * 2);
      }
    }
    // Cross-day stacking: no buffer, only estimated drive time.
    // Same-day stacking: apply transit buffer for safety margin.
    const bufferMs = isSameDayAsAnchor ? deliverySettings.transitBufferMinutes * 60 * 1000 : 0;
    const driveMs = driveMinutes * 60 * 1000;
    const earliestArrivalMs = referenceFinishMs + driveMs + bufferMs;

    if (newWindowEndMs < earliestArrivalMs) {
      const neededMin = Math.ceil((earliestArrivalMs - referenceFinishMs) / 60000);
      const availableMin = Math.max(0, Math.ceil((newWindowEndMs - referenceFinishMs) / 60000));
      const anchorLabel = anchorDelivery?.pickupWindowStart
        ? new Date(anchorDelivery.pickupWindowStart).toLocaleString()
        : new Date(referenceFinishMs).toLocaleString();
      const bufferNote = isSameDayAsAnchor ? ' (drive time + buffer)' : '';
      throw new ConflictException(
        `Not enough time after your delivery at ${anchorLabel}. ` +
        `You need ~${neededMin} min${bufferNote} to reach this pickup, ` +
        `but only ${availableMin} min remain before this pickup window closes.`
      );
    }
  }

  // ── Forward Stacking Check ──
  // If booked, would this new delivery make the driver late for their next booking?
  // Check: newEstimatedFinish + driveTime_new→next + buffer ≤ nextPickup
  if (newPickupStart && sortedAssignments.length > 0) {
    const newEtaMinutes = delivery.etaMinutes ?? 30;
    const newFinishMs = newPickupStart + newEtaMinutes * 60 * 1000;

    for (const existing of sortedAssignments) {
      if (!existing.pickupWindowStart) continue;
      const exPickupMs = new Date(existing.pickupWindowStart).getTime();

      // Only check deliveries starting after the new delivery would finish
      if (exPickupMs > newFinishMs) {
        let driveMinutes = 0;
        if (
          delivery.dropoffLat != null && delivery.dropoffLng != null &&
          existing.pickupLat != null && existing.pickupLng != null
        ) {
          // Drive from NEW delivery's dropoff to EXISTING delivery's pickup
          try {
            const route = await this.mapsService.computeRouteMetrics({
              originLat: delivery.dropoffLat,
              originLng: delivery.dropoffLng,
              destinationLat: existing.pickupLat,
              destinationLng: existing.pickupLng,
            });
            driveMinutes = route.durationMinutes;
          } catch {
            const miles = this.haversineFallback(delivery.dropoffLat, delivery.dropoffLng, existing.pickupLat, existing.pickupLng);
            driveMinutes = Math.ceil(miles * 2);
          }
        }
        // Cross-day: no buffer. Same-day: apply transit buffer.
        const crossDayFwd = delivery.pickupWindowStart && existing.pickupWindowStart
          ? !businessIsSameDay(delivery.pickupWindowStart, existing.pickupWindowStart)
          : true;
        const bufferMs = crossDayFwd ? 0 : deliverySettings.transitBufferMinutes * 60 * 1000;
        const driveMs = driveMinutes * 60 * 1000;
        const earliestArrivalMs = newFinishMs + driveMs + bufferMs;

        if (exPickupMs < earliestArrivalMs) {
          const neededMin = Math.ceil((earliestArrivalMs - newFinishMs) / 60000);
          const availableMin = Math.max(0, Math.ceil((exPickupMs - newFinishMs) / 60000));
          const existingLabel = new Date(existing.pickupWindowStart).toLocaleString();
          const bufferNote = crossDayFwd ? '' : ' (drive time + buffer)';
          throw new ConflictException(
            `This delivery would make you late for your next booking at ${existingLabel}. ` +
            `You'd need ~${neededMin} min${bufferNote} after finishing this delivery, ` +
            `but only ${availableMin} min are available.`
          );
        }
        break; // Only check the immediately next delivery
      }
    }
  }
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

  private haversineFallback(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 3958.7613;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async getDeliverySettings(): Promise<{
    maximumRadiusMiles: number;
    transitBufferMinutes: number;
  }> {
    const defaults = { maximumRadiusMiles: 20, transitBufferMinutes: 45 };
    try {
      const setting = await this.prisma.appSetting.findUnique({
        where: { key: "DELIVERY_SETTINGS" },
      });
      if (setting?.value && typeof setting.value === "object") {
        const v = setting.value as any;
        return {
          maximumRadiusMiles: typeof v.maximumRadiusMiles === "number" ? v.maximumRadiusMiles : defaults.maximumRadiusMiles,
          transitBufferMinutes: typeof v.transitBufferMinutes === "number" ? v.transitBufferMinutes : defaults.transitBufferMinutes,
        };
      }
    } catch {
      // Use defaults
    }
    return defaults;
  }

  private async getLastCompletedDropoff(driverId: string): Promise<{
    dropoffLat: number;
    dropoffLng: number;
    updatedAt: Date;
  } | null> {
    // Only count today's completions — first pickup each day is exempt
    const startOfToday = businessStartOfDay();

    const lastCompleted = await this.prisma.deliveryRequest.findFirst({
      where: {
        assignments: {
          some: {
            driverId,
            unassignedAt: null,
          },
        },
        status: EnumDeliveryRequestStatus.COMPLETED,
        updatedAt: { gte: startOfToday },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        dropoffLat: true,
        dropoffLng: true,
        updatedAt: true,
      },
    });
    if (lastCompleted && lastCompleted.dropoffLat != null && lastCompleted.dropoffLng != null) {
      return {
        dropoffLat: lastCompleted.dropoffLat,
        dropoffLng: lastCompleted.dropoffLng,
        updatedAt: lastCompleted.updatedAt,
      };
    }
    return null;
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
