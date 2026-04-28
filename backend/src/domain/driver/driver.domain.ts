// src/domain/driver/driver.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DriverSelect = Prisma.DriverSelect;
type DriverWhere = Prisma.DriverWhereInput;
type DriverWhereUnique = Prisma.DriverWhereUniqueInput;
type DriverFindMany = Prisma.DriverFindManyArgs;
type DriverFindUnique = Prisma.DriverFindUniqueArgs;

@Injectable()
export class DriverDomain extends BaseDomain<
  DriverSelect,
  DriverWhere,
  DriverWhereUnique,
  DriverFindMany,
  DriverFindUnique
> {
  protected enrichSelectFields: DriverSelect = {
    id: true,
    status: true,
    phone: true,
    profilePhotoUrl: true,
    approvedAt: true,
    approvedByUserId: true,
    userId: true,
    createdAt: true,
    updatedAt: true,

    user: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        emailVerifiedAt: true,
        disabledAt: true,
        disabledReason: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    approvedBy: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
      },
    },

    preferences: {
      select: {
        id: true,
        city: true,
        radiusMiles: true,
        createdAt: true,
        updatedAt: true,
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
        homeBaseState: true
      }

    },
    alerts: {
      select: {
        id: true,
        enabled: true,
        emailEnabled: true,
        smsEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    districts: {
      select: {
        id: true,
        districtId: true,
        createdAt: true,
        updatedAt: true,
        district: {
          select: {
            id: true,
            code: true,
            name: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    },
assignments: {
  select: {
    id: true,
    driverId: true,
    deliveryId: true,
    assignedByUserId: true,
    assignedAt: true,
    unassignedAt: true,
    reason: true,
    createdAt: true,
    updatedAt: true,

    assignedBy: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
      },
    },

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        createdByRole: true,
        customerId: true,
        quoteId: true,

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

        vehicleMake: true,
        vehicleModel: true,
        vehicleColor: true,
        licensePlate: true,
        vinVerificationCode: true,

        isUrgent: true,
        urgentBonusAmount: true,
        sameDayEligible: true,
        requiresOpsConfirmation: true,
        afterHours: true,
        bufferMinutes: true,
        etaMinutes: true,

        recipientName: true,
        recipientPhone: true,
        recipientEmail: true,

        trackingShareToken: true,
        trackingShareExpiresAt: true,

        createdAt: true,
        updatedAt: true,

        customer: {
          select: {
            id: true,
            customerType: true,
            approvalStatus: true,
            businessName: true,
            businessPhone: true,
            contactName: true,
            contactPhone: true,
            contactEmail: true,
            phone: true,
            userId: true,
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                phone: true,
                roles: true,
                isActive: true,
              },
            },
          },
        },

        compliance: {
          select: {
            id: true,
            pickupCompletedAt: true,
            dropoffCompletedAt: true,
            odometerStart: true,
            odometerEnd: true,
            vinConfirmed: true,
            vinVerificationCode: true,
            verifiedByUserId: true,
            verifiedByAdminAt: true,
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

        payout: {
          select: {
            id: true,
            status: true,
            grossAmount: true,
            netAmount: true,
            driverSharePct: true,
            platformFee: true,
            insuranceFee: true,
            paidAt: true,
            failedAt: true,
            failureMessage: true,
          },
        },

        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentType: true,
            provider: true,
            authorizedAt: true,
            capturedAt: true,
            paidAt: true,
            failedAt: true,
            failureCode: true,
            failureMessage: true,
          },
        },

        rating: {
          select: {
            id: true,
            stars: true,
            comment: true,
            target: true,
            createdAt: true,
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

        _count: {
          select: {
            assignments: true,
            evidence: true,
            statusHistory: true,
            notifications: true,
            scheduleChanges: true,
          },
        },
      },
    },
  },
},
    _count: {
      select: {
        assignments: true,
        audits: true,
        districts: true,
        notifications: true,
        payouts: true,
        ratingsReceived: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.driver);
  }
}