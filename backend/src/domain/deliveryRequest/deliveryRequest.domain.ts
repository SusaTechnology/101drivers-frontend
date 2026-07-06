// src/domain/deliveryRequest/deliveryRequest.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DeliveryRequestSelect = Prisma.DeliveryRequestSelect;
type DeliveryRequestWhere = Prisma.DeliveryRequestWhereInput;
type DeliveryRequestWhereUnique = Prisma.DeliveryRequestWhereUniqueInput;
type DeliveryRequestFindMany = Prisma.DeliveryRequestFindManyArgs;
type DeliveryRequestFindUnique = Prisma.DeliveryRequestFindUniqueArgs;

@Injectable()
export class DeliveryRequestDomain extends BaseDomain<
  DeliveryRequestSelect,
  DeliveryRequestWhere,
  DeliveryRequestWhereUnique,
  DeliveryRequestFindMany,
  DeliveryRequestFindUnique
> {
  protected enrichSelectFields: DeliveryRequestSelect = {
    id: true,
    status: true,
    serviceType: true,
    customerId: true,
    quoteId: true,

    createdByUserId: true,
    createdByRole: true,
    customerChose: true,

    pickupAddress: true,
    pickupLat: true,
    pickupLng: true,
    pickupPlaceId: true,
    pickupState: true,
    pickupWindowStart: true,
    pickupWindowEnd: true,

    dropoffAddress: true,
    dropoffLat: true,
    dropoffLng: true,
    dropoffPlaceId: true,
    dropoffState: true,
    dropoffWindowStart: true,
    dropoffWindowEnd: true,

    licensePlate: true,
    vehicleColor: true,
    vehicleMake: true,
    vehicleModel: true,
    vinVerificationCode: true,

    recipientName: true,
    recipientEmail: true,
    recipientPhone: true,

    etaMinutes: true,
    bufferMinutes: true,
    sameDayEligible: true,
    requiresOpsConfirmation: true,
    afterHours: true,
    isUrgent: true,
    urgentBonusAmount: true,

    trackingShareToken: true,
    trackingShareExpiresAt: true,

    resubmittedFromId: true,

    createdAt: true,
    updatedAt: true,

    customer: {
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        phone: true,
        postpaidEnabled: true,
        pricingConfigId: true,
        pricingModeOverride: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    createdBy: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    quote: {
      select: {
        id: true,
        serviceType: true,
        pricingMode: true,
        mileageCategory: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        distanceMiles: true,
        estimatedPrice: true,
        feesBreakdown: true,
        pricingSnapshot: true,
        routePolyline: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    payment: {
      select: {
        id: true,
        amount: true,
        paymentType: true,
        provider: true,
        status: true,
        authorizedAt: true,
        capturedAt: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    payout: {
      select: {
        id: true,
        driverId: true,
        grossAmount: true,
        insuranceFee: true,
        platformFee: true,
        netAmount: true,
        driverSharePct: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    compliance: {
      select: {
        id: true,
        vinConfirmed: true,
        vinVerificationCode: true,
        odometerStart: true,
        odometerEnd: true,
        pickupCompletedAt: true,
        dropoffCompletedAt: true,
        verifiedByUserId: true,
        verifiedByAdminAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    dispute: {
      select: {
        id: true,
        status: true,
        reason: true,
        legalHold: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    rating: {
      select: {
        id: true,
        stars: true,
        comment: true,
        target: true,
        customerId: true,
        driverId: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    tip: {
      select: {
        id: true,
        amount: true,
        provider: true,
        providerRef: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    trackingSession: {
      select: {
        id: true,
        status: true,
        startedAt: true,
        stoppedAt: true,
        drivenMiles: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    resubmittedFrom: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    },
assignments: {
  where: {
    unassignedAt: null,
  },
  orderBy: {
    assignedAt: "desc",
  },
  take: 1,
  select: {
    id: true,
    assignedAt: true,
    reason: true,
    driverId: true,
    driver: {
      select: {
        id: true,
        phone: true,
        selfiePhotoUrl: true,
        status: true,
        _count: {
          select: {
            assignments: true,
            ratingsReceived: true,
          },
        },
        ratingsReceived: {
          select: {
            stars: true,
          },
          take: 100,
        },
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
          },
        },
      },
    },
  },
},
evidence: {
  select: {
 imageUrl: true,
  phase: true,
  slotIndex: true,
  type: true
  }
},
    _count: {
      select: {
        assignments: true,
        audits: true,
        evidence: true,
        evidenceExports: true,
        notifications: true,
        resubmissions: true,
        scheduleChanges: true,
        statusHistory: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.deliveryRequest);
  }

  /**
   * Fetch driver details by driverId with rating & deliveryCount computed.
   * Used as fallback when no assignment record exists but a driverId is known
   * from payout, rating, or other relations.
   */
  private async resolveDriverInfo(driverId: string): Promise<any | null> {
    if (!driverId) return null;
    try {
      const raw = await this.prisma.driver.findUnique({
        where: { id: driverId },
        select: {
          id: true,
          phone: true,
          profilePhotoUrl: true,
          status: true,
          _count: {
            select: {
              assignments: true,
              ratingsReceived: true,
            },
          },
          ratingsReceived: {
            select: { stars: true },
            take: 100,
          },
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
            },
          },
        },
      });
      if (!raw) return null;

      const driver = raw as any;
      const ratings = driver.ratingsReceived || [];
      driver.rating = ratings.length
        ? Number((ratings.reduce((sum: number, r: any) => sum + (r.stars || 0), 0) / ratings.length).toFixed(1))
        : null;
      driver.deliveryCount = driver._count?.assignments || 0;
      delete driver._count;
      delete driver.ratingsReceived;
      return driver;
    } catch {
      return null;
    }
  }

  private computeDriverFields(driver: any): void {
    if (!driver) return;
    const ratings = driver.ratingsReceived || [];
    driver.rating = ratings.length
      ? Number((ratings.reduce((sum: number, r: any) => sum + (r.stars || 0), 0) / ratings.length).toFixed(1))
      : null;
    driver.deliveryCount = driver._count?.assignments || 0;
    delete driver._count;
    delete driver.ratingsReceived;
  }

  protected override async postProcessOne(record: any | null): Promise<any | null> {
    if (!record) return record;

    // Compute driver rating and deliveryCount from raw data
    if (record.assignments?.length) {
      for (const a of record.assignments) {
        if (a.driver) {
          this.computeDriverFields(a.driver);
        }
      }
    }

    // Fallback: if no active assignment but we know the driverId from payout/rating,
    // fetch driver info directly and inject a synthetic assignment
    if ((!record.assignments?.length) && (record.status === 'BOOKED' || record.status === 'ACTIVE' || record.status === 'COMPLETED')) {
      const driverId = record.payout?.driverId || record.rating?.driverId;
      if (driverId) {
        const driverInfo = await this.resolveDriverInfo(driverId);
        if (driverInfo) {
          record.assignments = [{
            id: '__fallback__',
            assignedAt: record.createdAt,
            reason: null,
            driverId: driverInfo.id,
            driver: driverInfo,
          }];
        }
      }
    }

    return record;
  }

  protected override async postProcessMany(records: any[]): Promise<any[]> {
    for (const record of records) {
      if (record.assignments?.length) {
        for (const a of record.assignments) {
          if (a.driver) {
            this.computeDriverFields(a.driver);
          }
        }
      }

      // Same fallback for list endpoints
      if ((!record.assignments?.length) && (record.status === 'BOOKED' || record.status === 'ACTIVE' || record.status === 'COMPLETED')) {
        const driverId = record.payout?.driverId || record.rating?.driverId;
        if (driverId) {
          const driverInfo = await this.resolveDriverInfo(driverId);
          if (driverInfo) {
            record.assignments = [{
              id: '__fallback__',
              assignedAt: record.createdAt,
              reason: null,
              driverId: driverInfo.id,
              driver: driverInfo,
            }];
          }
        }
      }
    }
    return records;
  }
}