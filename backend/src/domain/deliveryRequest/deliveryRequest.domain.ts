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
        profilePhotoUrl: true,
        status: true,
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
}