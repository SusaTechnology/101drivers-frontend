import { Injectable } from "@nestjs/common";
import {
  EnumDeliveryEvidenceType,
  EnumDisputeCaseStatus,
  EnumDriverPayoutStatus,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ComplianceReportQueryDto,
  DeliveriesReportQueryDto,
  DisputesReportQueryDto,
  InsuranceMileageReportQueryDto,
  PaymentsReportQueryDto,
  PayoutsReportQueryDto,
} from "./dto/report-query.dto";

@Injectable()
export class ReportsDomain {
  constructor(private readonly prisma: PrismaService) {}

  private buildDateRange(
    field: string,
    from?: string,
    to?: string
  ): Record<string, any> {
    if (!from && !to) return {};
    return {
      [field]: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    };
  }

  private calcPagination(page: number, pageSize: number, totalRows: number) {
    return {
      page,
      pageSize,
      totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    };
  }

  private paginate(page: number, pageSize: number) {
    return {
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }

  private deliveryBaseWhere(query: {
    from?: string;
    to?: string;
    customerId?: string;
    driverId?: string;
  }): Prisma.DeliveryRequestWhereInput {
    return {
      ...this.buildDateRange("createdAt", query.from, query.to),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.driverId
        ? {
            assignments: {
              some: {
                driverId: query.driverId,
                unassignedAt: null,
              },
            },
          }
        : {}),
    };
  }

  private paymentBaseWhere(query: {
    from?: string;
    to?: string;
    customerId?: string;
    driverId?: string;
  }): Prisma.PaymentWhereInput {
    return {
      ...this.buildDateRange("createdAt", query.from, query.to),
      delivery: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.driverId
          ? {
              assignments: {
                some: {
                  driverId: query.driverId,
                  unassignedAt: null,
                },
              },
            }
          : {}),
      },
    };
  }

  private payoutBaseWhere(query: {
    from?: string;
    to?: string;
    customerId?: string;
    driverId?: string;
  }): Prisma.DriverPayoutWhereInput {
    return {
      ...this.buildDateRange("createdAt", query.from, query.to),
      ...(query.driverId ? { driverId: query.driverId } : {}),
      delivery: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
    };
  }

  private trackingBaseWhere(query: {
    from?: string;
    to?: string;
    customerId?: string;
    driverId?: string;
    serviceType?: any;
  }): Prisma.TrackingSessionWhereInput {
    return {
      ...this.buildDateRange("createdAt", query.from, query.to),
      delivery: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.driverId
          ? {
              assignments: {
                some: {
                  driverId: query.driverId,
                  unassignedAt: null,
                },
              },
            }
          : {}),
        ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      },
    };
  }

  private startOfWeekUtc(date: Date) {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    const day = d.getUTCDay(); // 0 Sun ... 6 Sat
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }

  private monthKeyUtc(date: Date) {
    const y = date.getUTCFullYear();
    const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    return `${y}-${m}`;
  }

  private weekKeyUtc(date: Date) {
    const start = this.startOfWeekUtc(date);
    const y = start.getUTCFullYear();
    const m = `${start.getUTCMonth() + 1}`.padStart(2, "0");
    const d = `${start.getUTCDate()}`.padStart(2, "0");
    return `${y}-W${m}-${d}`;
  }

  async getDeliveriesReport(query: DeliveriesReportQueryDto) {
    const where: Prisma.DeliveryRequestWhereInput = {
      ...this.deliveryBaseWhere(query),
      ...(query.status ? { status: query.status } : {}),
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.createdByRole ? { createdByRole: query.createdByRole } : {}),
      ...(typeof query.isUrgent === "boolean"
        ? { isUrgent: query.isUrgent }
        : {}),
      ...(typeof query.requiresOpsConfirmation === "boolean"
        ? { requiresOpsConfirmation: query.requiresOpsConfirmation }
        : {}),
      ...(query.disputedOnly ? { dispute: { isNot: null } } : {}),
    };

    const totalRows = await this.prisma.deliveryRequest.count({ where });

    const rows = await this.prisma.deliveryRequest.findMany({
      where,
      ...this.paginate(query.page, query.pageSize),
      orderBy: {
        [query.sortBy || "createdAt"]: query.sortOrder,
      } as Prisma.DeliveryRequestOrderByWithRelationInput,
      select: {
        id: true,
        createdAt: true,
        status: true,
        serviceType: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,
        isUrgent: true,
        requiresOpsConfirmation: true,
        createdByRole: true,
        customer: {
          select: {
            id: true,
            businessName: true,
            customerType: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            driver: {
              select: {
                id: true,
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            paymentType: true,
            amount: true,
            paidAt: true,
          },
        },
        payout: {
          select: {
            id: true,
            status: true,
            netAmount: true,
            paidAt: true,
          },
        },
        dispute: {
          select: {
            id: true,
            status: true,
            legalHold: true,
          },
        },
        trackingSession: {
          select: {
            id: true,
            status: true,
            drivenMiles: true,
          },
        },
      },
    });

    const grouped = await this.prisma.deliveryRequest.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const summary = {
      totalDeliveries: totalRows,
      urgentCount: await this.prisma.deliveryRequest.count({
        where: { ...where, isUrgent: true },
      }),
      disputedCount: await this.prisma.deliveryRequest.count({
        where: { ...where, dispute: { isNot: null } },
      }),
      activePaymentCount: await this.prisma.deliveryRequest.count({
        where: { ...where, payment: { isNot: null } },
      }),
      completedCount: await this.prisma.deliveryRequest.count({
        where: { ...where, status: "COMPLETED" as any },
      }),
    };

    return {
      rows: rows.map((row) => ({
        ...row,
        assignedDriver: row.assignments[0]?.driver ?? null,
      })),
      summary,
      groupings: {
        byStatus: grouped.map((g) => ({
          status: g.status,
          count: g._count._all,
        })),
      },
      pagination: this.calcPagination(query.page, query.pageSize, totalRows),
    };
  }

  async getComplianceReport(query: ComplianceReportQueryDto) {
    const deliveryWhere: Prisma.DeliveryRequestWhereInput = {
      ...this.deliveryBaseWhere(query),
      ...(query.status ? { status: query.status } : {}),
    };

    const complianceWhere: Prisma.DeliveryComplianceWhereInput = {
      delivery: deliveryWhere,
      ...(query.verifiedOnly ? { vinConfirmed: true } : {}),
    };

    const totalRows = await this.prisma.deliveryCompliance.count({
      where: complianceWhere,
    });

    const rows = await this.prisma.deliveryCompliance.findMany({
      where: complianceWhere,
      ...this.paginate(query.page, query.pageSize),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        deliveryId: true,
        vinConfirmed: true,
        vinVerificationCode: true,
        odometerStart: true,
        odometerEnd: true,
        pickupCompletedAt: true,
        dropoffCompletedAt: true,
        verifiedByAdminAt: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
            assignments: {
              where: { unassignedAt: null },
              orderBy: { assignedAt: "desc" },
              take: 1,
              select: {
                driver: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        fullName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
            trackingSession: {
              select: {
                id: true,
                status: true,
                startedAt: true,
                stoppedAt: true,
                drivenMiles: true,
              },
            },
            evidence: {
              select: {
                id: true,
                phase: true,
                type: true,
                slotIndex: true,
                imageUrl: true,
                value: true,
              },
            },
            evidenceExports: {
              select: {
                id: true,
                createdAt: true,
                url: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    const normalizedRows = rows
      .map((row) => {
        const pickupPhotos = row.delivery.evidence.filter(
          (e) => e.type === EnumDeliveryEvidenceType.PICKUP_PHOTO
        ).length;

        const dropoffPhotos = row.delivery.evidence.filter(
          (e) => e.type === EnumDeliveryEvidenceType.DROPOFF_PHOTO
        ).length;

        const missingFlags: string[] = [];
        if (!row.vinConfirmed) missingFlags.push("VIN_NOT_CONFIRMED");
        if (row.odometerStart == null) missingFlags.push("ODOMETER_START_MISSING");
        if (row.odometerEnd == null) missingFlags.push("ODOMETER_END_MISSING");
        if (pickupPhotos < 6) missingFlags.push("PICKUP_PHOTOS_INCOMPLETE");
        if (dropoffPhotos < 6) missingFlags.push("DROPOFF_PHOTOS_INCOMPLETE");
        if (!row.delivery.trackingSession?.startedAt) {
          missingFlags.push("TRACKING_START_MISSING");
        }
        if (!row.delivery.trackingSession?.stoppedAt) {
          missingFlags.push("TRACKING_STOP_MISSING");
        }

        return {
          ...row,
          pickupPhotoCount: pickupPhotos,
          dropoffPhotoCount: dropoffPhotos,
          assignedDriver: row.delivery.assignments[0]?.driver ?? null,
          latestEvidenceExport: row.delivery.evidenceExports[0] ?? null,
          missingFlags,
        };
      })
      .filter((row) => (query.missingOnly ? row.missingFlags.length > 0 : true));

    const summary = {
      totalComplianceRows: totalRows,
      vinConfirmedCount: rows.filter((r) => r.vinConfirmed).length,
      missingEvidenceCount: normalizedRows.filter((r) => r.missingFlags.length > 0)
        .length,
      totalDrivenMiles: rows.reduce(
        (sum, r) => sum + (r.delivery.trackingSession?.drivenMiles || 0),
        0
      ),
    };

    return {
      rows: normalizedRows,
      summary,
      groupings: {},
      pagination: this.calcPagination(
        query.page,
        query.pageSize,
        query.missingOnly ? normalizedRows.length : totalRows
      ),
    };
  }

  async getDisputesReport(query: DisputesReportQueryDto) {
    const where: Prisma.DisputeCaseWhereInput = {
      ...this.buildDateRange("openedAt", query.from, query.to),
      ...(query.status ? { status: query.status } : {}),
      ...(typeof query.legalHold === "boolean"
        ? { legalHold: query.legalHold }
        : {}),
      delivery: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.driverId
          ? {
              assignments: {
                some: {
                  driverId: query.driverId,
                  unassignedAt: null,
                },
              },
            }
          : {}),
      },
    };

    const totalRows = await this.prisma.disputeCase.count({ where });

    const rows = await this.prisma.disputeCase.findMany({
      where,
      ...this.paginate(query.page, query.pageSize),
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        deliveryId: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
        status: true,
        legalHold: true,
        reason: true,
        _count: {
          select: { notes: true },
        },
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
            assignments: {
              where: { unassignedAt: null },
              orderBy: { assignedAt: "desc" },
              take: 1,
              select: {
                driver: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        fullName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
            evidenceExports: {
              select: {
                id: true,
                createdAt: true,
                url: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    const grouped = await this.prisma.disputeCase.groupBy({
      by: ["status", "legalHold"],
      where,
      _count: { _all: true },
    });

    const summary = {
      totalDisputes: totalRows,
      legalHoldCount: await this.prisma.disputeCase.count({
        where: { ...where, legalHold: true },
      }),
      openCount: await this.prisma.disputeCase.count({
        where: { ...where, status: EnumDisputeCaseStatus.OPEN },
      }),
      underReviewCount: await this.prisma.disputeCase.count({
        where: { ...where, status: EnumDisputeCaseStatus.UNDER_REVIEW },
      }),
      resolvedCount: await this.prisma.disputeCase.count({
        where: { ...where, status: EnumDisputeCaseStatus.RESOLVED },
      }),
      closedCount: await this.prisma.disputeCase.count({
        where: { ...where, status: EnumDisputeCaseStatus.CLOSED },
      }),
    };

    return {
      rows: rows.map((row) => ({
        ...row,
        notesCount: row._count.notes,
        assignedDriver: row.delivery.assignments[0]?.driver ?? null,
        latestEvidenceExport: row.delivery.evidenceExports[0] ?? null,
      })),
      summary,
      groupings: {
        byStatus: grouped.map((g) => ({
          status: g.status,
          legalHold: g.legalHold,
          count: g._count._all,
        })),
      },
      pagination: this.calcPagination(query.page, query.pageSize, totalRows),
    };
  }

  async getPaymentsReport(query: PaymentsReportQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      ...this.paymentBaseWhere(query),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentType ? { paymentType: query.paymentType } : {}),
      ...(query.prepaidOnly ? { paymentType: EnumPaymentPaymentType.PREPAID } : {}),
      ...(query.postpaidOnly
        ? { paymentType: EnumPaymentPaymentType.POSTPAID }
        : {}),
      ...(query.failedOnly
        ? {
            OR: [
              { status: EnumPaymentStatus.FAILED },
              { failedAt: { not: null } },
            ],
          }
        : {}),
    };

    const totalRows = await this.prisma.payment.count({ where });

    const rows = await this.prisma.payment.findMany({
      where,
      ...this.paginate(query.page, query.pageSize),
      orderBy: {
        [query.sortBy || "createdAt"]: query.sortOrder,
      } as Prisma.PaymentOrderByWithRelationInput,
      select: {
        id: true,
        deliveryId: true,
        amount: true,
        paymentType: true,
        status: true,
        provider: true,
        providerChargeId: true,
        providerPaymentIntentId: true,
        invoiceId: true,
        authorizedAt: true,
        capturedAt: true,
        paidAt: true,
        failedAt: true,
        refundedAt: true,
        voidedAt: true,
        failureCode: true,
        failureMessage: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
            assignments: {
              where: { unassignedAt: null },
              orderBy: { assignedAt: "desc" },
              take: 1,
              select: {
                driver: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        fullName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            message: true,
            providerRef: true,
            createdAt: true,
          },
        },
      },
    });

    const aggregate = await this.prisma.payment.aggregate({
      where,
      _sum: { amount: true },
      _avg: { amount: true },
    });

    const grouped = await this.prisma.payment.groupBy({
      by: ["status", "paymentType"],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    });

    const summary = {
      totalPayments: totalRows,
      totalAmount: aggregate._sum.amount ?? 0,
      averageAmount: aggregate._avg.amount ?? 0,
      authorizedCount: await this.prisma.payment.count({
        where: { ...where, status: EnumPaymentStatus.AUTHORIZED },
      }),
      capturedCount: await this.prisma.payment.count({
        where: { ...where, status: EnumPaymentStatus.CAPTURED },
      }),
      invoicedCount: await this.prisma.payment.count({
        where: { ...where, status: EnumPaymentStatus.INVOICED },
      }),
      paidCount: await this.prisma.payment.count({
        where: { ...where, status: EnumPaymentStatus.PAID },
      }),
      failedCount: await this.prisma.payment.count({
        where: { ...where, status: EnumPaymentStatus.FAILED },
      }),
      refundedCount: await this.prisma.payment.count({
        where: { ...where, status: EnumPaymentStatus.REFUNDED },
      }),
    };

    return {
      rows: rows.map((row) => ({
        ...row,
        assignedDriver: row.delivery.assignments[0]?.driver ?? null,
        recentEvents: row.events,
      })),
      summary,
      groupings: {
        byStatusAndType: grouped.map((g) => ({
          status: g.status,
          paymentType: g.paymentType,
          count: g._count._all,
          totalAmount: g._sum.amount ?? 0,
        })),
      },
      pagination: this.calcPagination(query.page, query.pageSize, totalRows),
    };
  }

  async getPayoutsReport(query: PayoutsReportQueryDto) {
    const where: Prisma.DriverPayoutWhereInput = {
      ...this.payoutBaseWhere(query),
      ...(query.status ? { status: query.status } : {}),
    };

    const totalRows = await this.prisma.driverPayout.count({ where });

    const rows = await this.prisma.driverPayout.findMany({
      where,
      ...this.paginate(query.page, query.pageSize),
      orderBy: {
        [query.sortBy || "createdAt"]: query.sortOrder,
      } as Prisma.DriverPayoutOrderByWithRelationInput,
      select: {
        id: true,
        deliveryId: true,
        driverId: true,
        grossAmount: true,
        insuranceFee: true,
        driverSharePct: true,
        netAmount: true,
        platformFee: true,
        status: true,
        paidAt: true,
        failedAt: true,
        failureMessage: true,
        providerTransferId: true,
        createdAt: true,
        driver: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        delivery: {
          select: {
            id: true,
            status: true,
            serviceType: true,
            customer: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
            payment: {
              select: {
                id: true,
                amount: true,
                status: true,
                paymentType: true,
              },
            },
            trackingSession: {
              select: {
                id: true,
                drivenMiles: true,
              },
            },
          },
        },
      },
    });

    const aggregate = await this.prisma.driverPayout.aggregate({
      where,
      _sum: {
        grossAmount: true,
        insuranceFee: true,
        netAmount: true,
        platformFee: true,
      },
      _avg: {
        grossAmount: true,
        insuranceFee: true,
        netAmount: true,
        platformFee: true,
      },
    });

    const grouped = await this.prisma.driverPayout.groupBy({
      by: ["status", "driverId"],
      where,
      _count: { _all: true },
      _sum: {
        grossAmount: true,
        insuranceFee: true,
        netAmount: true,
        platformFee: true,
      },
    });

    const summary = {
      totalPayouts: totalRows,
      grossAmount: aggregate._sum.grossAmount ?? 0,
      insuranceFee: aggregate._sum.insuranceFee ?? 0,
      netAmount: aggregate._sum.netAmount ?? 0,
      platformFee: aggregate._sum.platformFee ?? 0,
      pendingCount: await this.prisma.driverPayout.count({
        where: { ...where, status: EnumDriverPayoutStatus.PENDING },
      }),
      eligibleCount: await this.prisma.driverPayout.count({
        where: { ...where, status: EnumDriverPayoutStatus.ELIGIBLE },
      }),
      paidCount: await this.prisma.driverPayout.count({
        where: { ...where, status: EnumDriverPayoutStatus.PAID },
      }),
      failedCount: await this.prisma.driverPayout.count({
        where: { ...where, status: EnumDriverPayoutStatus.FAILED },
      }),
      cancelledCount: await this.prisma.driverPayout.count({
        where: { ...where, status: EnumDriverPayoutStatus.CANCELLED },
      }),
    };

    return {
      rows,
      summary,
      groupings: {
        byDriverAndStatus: grouped.map((g) => ({
          driverId: g.driverId,
          status: g.status,
          count: g._count._all,
          grossAmount: g._sum.grossAmount ?? 0,
          insuranceFee: g._sum.insuranceFee ?? 0,
          netAmount: g._sum.netAmount ?? 0,
          platformFee: g._sum.platformFee ?? 0,
        })),
      },
      pagination: this.calcPagination(query.page, query.pageSize, totalRows),
    };
  }

  async getInsuranceMileageReport(query: InsuranceMileageReportQueryDto) {
    const baseWhere: Prisma.TrackingSessionWhereInput = {
      ...this.trackingBaseWhere(query),
      ...(query.status
        ? { delivery: { status: query.status } }
        : {}),
    };

    // ── Driven hours helper ──
    const computeDrivenHours = (
      startedAt: Date | null,
      stoppedAt: Date | null,
    ): number | null => {
      if (!startedAt || !stoppedAt) return null;
      return (stoppedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
    };

    const hasHoursFilter = query.minDrivenHours != null || query.maxDrivenHours != null;

    // When exporting (format != json), strip pagination so all matching rows
    // are returned. Hard cap at 50,000 rows to prevent OOM.
    const isExport = query.format && query.format !== "json";
    const EXPORT_ROW_CAP = 50000;

    const rowSelect: Prisma.TrackingSessionSelect = {
      id: true,
      deliveryId: true,
      status: true,
      startedAt: true,
      stoppedAt: true,
      drivenMiles: true,
      createdAt: true,
      delivery: {
        select: {
          id: true,
          status: true,
          serviceType: true,
          pickupAddress: true,
          dropoffAddress: true,
          customer: {
            select: {
              id: true,
              businessName: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          assignments: {
            where: { unassignedAt: null },
            orderBy: { assignedAt: "desc" },
            take: 1,
            select: {
              driver: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    let filteredRows: any[];
    let totalRows: number;

    if (hasHoursFilter) {
      // When driven hours filter is active, we need in-memory filtering
      // because driven hours is a computed field (stoppedAt - startedAt).
      // Add NOT NULL constraints to eliminate rows that can never match.
      const where: Prisma.TrackingSessionWhereInput = {
        ...baseWhere,
        startedAt: { not: null },
        stoppedAt: { not: null },
      };

      // Fetch ALL rows (no DB pagination) since we must filter in-memory.
      // Cap at EXPORT_ROW_CAP to prevent OOM on large datasets.
      const allRows = await this.prisma.trackingSession.findMany({
        where,
        orderBy: {
          [query.sortBy || "createdAt"]: query.sortOrder,
        } as Prisma.TrackingSessionOrderByWithRelationInput,
        select: rowSelect,
        ...(isExport ? { take: EXPORT_ROW_CAP } : {}),
      });

      // Filter by driven hours range in-memory
      filteredRows = allRows.filter((row) => {
        const hours = computeDrivenHours(row.startedAt, row.stoppedAt);
        if (hours === null) return false;
        if (query.minDrivenHours != null && hours < query.minDrivenHours) return false;
        if (query.maxDrivenHours != null && hours > query.maxDrivenHours) return false;
        return true;
      });

      totalRows = filteredRows.length;
    } else {
      // No hours filter — use efficient DB-level pagination
      totalRows = await this.prisma.trackingSession.count({ where: baseWhere });

      const rows = await this.prisma.trackingSession.findMany({
        where: baseWhere,
        ...(isExport
          ? { take: EXPORT_ROW_CAP }
          : this.paginate(query.page, query.pageSize) as any),
        orderBy: {
          [query.sortBy || "createdAt"]: query.sortOrder,
        } as Prisma.TrackingSessionOrderByWithRelationInput,
        select: rowSelect,
      });

      filteredRows = rows;
    }

    // Map rows with driven hours computation
    const mappedRows = filteredRows.map((row) => {
      const drivenHours = computeDrivenHours(row.startedAt, row.stoppedAt);
      return {
        ...row,
        drivenHours: drivenHours !== null ? Math.round(drivenHours * 100) / 100 : null,
        assignedDriver: row.delivery.assignments[0]?.driver ?? null,
        period:
          query.groupBy === "week"
            ? this.weekKeyUtc(row.startedAt ?? row.createdAt)
            : this.monthKeyUtc(row.startedAt ?? row.createdAt),
      };
    });

    // When hours filter is active, apply in-memory pagination after filtering
    // (unless this is an export — exports return ALL rows).
    // Otherwise DB already handled pagination.
    const displayRows = hasHoursFilter && !isExport
      ? mappedRows.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        )
      : mappedRows;

    // Grouping data — reuse filtered rows when hours filter is active,
    // otherwise fetch separately for aggregation.
    const allForGrouping = hasHoursFilter
      ? filteredRows
      : await this.prisma.trackingSession.findMany({
          where: baseWhere,
          select: {
            id: true,
            drivenMiles: true,
            startedAt: true,
            stoppedAt: true,
            createdAt: true,
            delivery: {
              select: {
                customerId: true,
                serviceType: true,
                assignments: {
                  where: { unassignedAt: null },
                  orderBy: { assignedAt: "desc" },
                  take: 1,
                  select: {
                    driverId: true,
                  },
                },
              },
            },
          },
        });

    // ── Grouping ──
    const groupedMap = new Map<
      string,
      {
        period: string;
        tripCount: number;
        totalDrivenMiles: number;
        totalDrivenHours: number;
        driverIds: Set<string>;
        customerIds: Set<string>;
      }
    >();

    for (const row of allForGrouping) {
      const anchor = row.startedAt ?? row.createdAt;
      const period =
        query.groupBy === "week"
          ? this.weekKeyUtc(anchor)
          : this.monthKeyUtc(anchor);

      if (!groupedMap.has(period)) {
        groupedMap.set(period, {
          period,
          tripCount: 0,
          totalDrivenMiles: 0,
          totalDrivenHours: 0,
          driverIds: new Set<string>(),
          customerIds: new Set<string>(),
        });
      }

      const bucket = groupedMap.get(period)!;
      bucket.tripCount += 1;
      bucket.totalDrivenMiles += row.drivenMiles ?? 0;
      const hours = computeDrivenHours(row.startedAt, row.stoppedAt);
      if (hours !== null) bucket.totalDrivenHours += hours;

      const driverId = row.delivery.assignments[0]?.driverId;
      if (driverId) bucket.driverIds.add(driverId);
      if (row.delivery.customerId) bucket.customerIds.add(row.delivery.customerId);
    }

    const byPeriod = Array.from(groupedMap.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((g) => ({
        period: g.period,
        tripCount: g.tripCount,
        totalDrivenMiles: g.totalDrivenMiles,
        averageMilesPerTrip:
          g.tripCount > 0 ? g.totalDrivenMiles / g.tripCount : 0,
        totalDrivenHours: Math.round(g.totalDrivenHours * 100) / 100,
        averageDrivenHoursPerTrip:
          g.tripCount > 0 ? Math.round((g.totalDrivenHours / g.tripCount) * 100) / 100 : 0,
        uniqueDriverCount: g.driverIds.size,
        uniqueCustomerCount: g.customerIds.size,
      }));

    // ── Summary ──
    const totalDrivenMiles = allForGrouping.reduce(
      (sum, row) => sum + (row.drivenMiles ?? 0),
      0
    );

    const totalDrivenHours = allForGrouping.reduce(
      (sum, row) => {
        const hours = computeDrivenHours(row.startedAt, row.stoppedAt);
        return sum + (hours ?? 0);
      },
      0
    );

    const sessionsWithHours = allForGrouping.filter(
      (row) => computeDrivenHours(row.startedAt, row.stoppedAt) !== null
    ).length;

    const summary = {
      totalTrackingSessions: hasHoursFilter ? allForGrouping.length : totalRows,
      totalDrivenMiles,
      averageMilesPerTrip:
        allForGrouping.length > 0 ? totalDrivenMiles / allForGrouping.length : 0,
      totalDrivenHours: Math.round(totalDrivenHours * 100) / 100,
      averageDrivenHoursPerTrip:
        sessionsWithHours > 0
          ? Math.round((totalDrivenHours / sessionsWithHours) * 100) / 100
          : 0,
      startedCount: hasHoursFilter
        ? allForGrouping.filter((r) => r.startedAt !== null).length
        : await this.prisma.trackingSession.count({
            where: { ...baseWhere, startedAt: { not: null } },
          }),
      stoppedCount: hasHoursFilter
        ? allForGrouping.filter((r) => r.stoppedAt !== null).length
        : await this.prisma.trackingSession.count({
            where: { ...baseWhere, stoppedAt: { not: null } },
          }),
    };

    return {
      rows: displayRows,
      summary,
      groupings: {
        byPeriod,
      },
      pagination: this.calcPagination(
        isExport ? 1 : query.page,
        isExport ? totalRows : query.pageSize,
        totalRows
      ),
    };
  }
}