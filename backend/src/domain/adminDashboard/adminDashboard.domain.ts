import { Injectable } from "@nestjs/common";
import {
  EnumCustomerApprovalStatus,
  EnumCustomerCustomerType,
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
  EnumDisputeCaseStatus,
  EnumDriverPayoutStatus,
  EnumDriverStatus,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  EnumSchedulingPolicyCustomerType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AdminDashboardOverviewQuery,
  EnumAdminDashboardActionType,
  EnumAdminDashboardAttentionType,
  EnumAdminDashboardAlertSeverity,
  EnumAdminDashboardDatePreset,
} from "../../adminDashboard/dto/adminDashboard.dto";

type DateRange = {
  from: Date | null;
  to: Date | null;
};

@Injectable()
export class AdminDashboardDomain {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(filters: AdminDashboardOverviewQuery) {
    const range = this.resolveDateRange(filters);
    const deliveryWhere = this.buildDeliveryWhere(filters, range);

    const summaryCards = await this.getSummaryCards(deliveryWhere);
    const activeDeliveries = await this.getActiveDeliveries(deliveryWhere);
    const liveTrackingOverview = await this.getLiveTrackingOverview(deliveryWhere);
    const needsAttention = await this.getNeedsAttention(deliveryWhere);
    const alerts = await this.getAlerts(deliveryWhere);
    const pricingSnapshot = await this.getPricingSnapshot();
    const schedulingPolicy = await this.getSchedulingPolicySummary(filters);
    const actorSummary = await this.getActorSummary();
    const driverOperations = await this.getDriverOperations(deliveryWhere);
    const dealerActivity = await this.getDealerActivity(deliveryWhere);
    const summary = await this.getSummary(deliveryWhere);
    const pipeline = await this.getPipeline(deliveryWhere);
    const finance = await this.getFinance(deliveryWhere);
    const financialSnapshot = await this.getFinancialSnapshot(deliveryWhere);
    const operations = await this.getOperations(deliveryWhere);
    const deliveryBreakdowns = await this.getDeliveryBreakdowns(deliveryWhere);
    const reportsPreview = await this.getReportsPreview(deliveryWhere, range);
    const quickActions = this.getQuickActions();
    const recent = await this.getRecent(deliveryWhere);

    return {
      filtersApplied: {
        from: range.from,
        to: range.to,
        datePreset: filters.datePreset ?? null,
        statuses: filters.statuses ?? [],
        customerId: filters.customerId ?? null,
        customerType: filters.customerType ?? null,
        createdByRole: filters.createdByRole ?? null,
        serviceType: filters.serviceType ?? null,
        requiresOpsConfirmation: filters.requiresOpsConfirmation ?? null,
        urgentOnly: filters.urgentOnly ?? null,
        disputedOnly: filters.disputedOnly ?? null,
      },
      summaryCards,
      summary,
      pipeline,
      finance,
      financialSnapshot,
      operations,
      alerts,
      activeDeliveries,
      liveTrackingOverview,
      needsAttention,
      driverOperations,
      dealerActivity,
      pricingSnapshot,
      schedulingPolicy,
      actorSummary,
      deliveryBreakdowns,
      reportsPreview,
      quickActions,
      recent,
    };
  }

  private async getSummaryCards(deliveryWhere: Prisma.DeliveryRequestWhereInput) {
    const activeDeliveries = await this.prisma.deliveryRequest.findMany({
      where: {
        AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.ACTIVE }],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: this.activeDeliverySelect(),
    });

    const deliveriesInMotionCount = await this.prisma.deliveryRequest.count({
      where: {
        AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.ACTIVE }],
      },
    });

    const pendingDrivers = await this.prisma.driver.findMany({
      where: { status: EnumDriverStatus.PENDING },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        phone: true,
        profilePhotoUrl: true,
        createdAt: true,
        status: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const pendingDriverCount = await this.prisma.driver.count({
      where: { status: EnumDriverStatus.PENDING },
    });

    const openDisputes = await this.prisma.disputeCase.findMany({
      where: {
        delivery: deliveryWhere,
        status: {
          in: [
            EnumDisputeCaseStatus.OPEN,
            EnumDisputeCaseStatus.UNDER_REVIEW,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        reason: true,
        legalHold: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    const openClaimsCount = await this.prisma.disputeCase.count({
      where: {
        delivery: deliveryWhere,
        status: {
          in: [
            EnumDisputeCaseStatus.OPEN,
            EnumDisputeCaseStatus.UNDER_REVIEW,
          ],
        },
      },
    });

    const capturedPayments = await this.prisma.payment.findMany({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.CAPTURED,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        paymentType: true,
        provider: true,
        status: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    const capturedPaymentsCount = await this.prisma.payment.count({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.CAPTURED,
      },
    });

    const capturedRevenueAgg = await this.prisma.payment.aggregate({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.CAPTURED,
      },
      _sum: { amount: true },
    });

    return {
      deliveriesInMotion: {
        count: deliveriesInMotionCount,
        items: activeDeliveries,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open deliveries",
          target: "deliveries",
          filters: {
            statuses: [EnumDeliveryRequestStatus.ACTIVE],
          },
        },
      },
      pendingDriverApprovals: {
        count: pendingDriverCount,
        items: pendingDrivers,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Review approvals",
          target: "drivers",
          filters: {
            status: EnumDriverStatus.PENDING,
          },
        },
      },
      openClaims: {
        count: openClaimsCount,
        items: openDisputes,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Go to disputes",
          target: "disputes",
          filters: {
            statuses: [
              EnumDisputeCaseStatus.OPEN,
              EnumDisputeCaseStatus.UNDER_REVIEW,
            ],
          },
        },
      },
      capturedRevenue: {
        count: capturedPaymentsCount,
        amount: this.toMoney(capturedRevenueAgg._sum.amount),
        items: capturedPayments,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "View payment events",
          target: "payments",
          filters: {
            statuses: [EnumPaymentStatus.CAPTURED],
          },
        },
      },
    };
  }

  private async getActiveDeliveries(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const where: Prisma.DeliveryRequestWhereInput = {
      AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.ACTIVE }],
    };

    const items = await this.prisma.deliveryRequest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: this.activeDeliverySelect(),
    });

    const count = await this.prisma.deliveryRequest.count({ where });

    return {
      count,
      items,
      action: {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "View all",
        target: "deliveries",
        filters: {
          statuses: [EnumDeliveryRequestStatus.ACTIVE],
        },
      },
    };
  }

  private async getLiveTrackingOverview(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const where: Prisma.DeliveryRequestWhereInput = {
      AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.ACTIVE }],
    };

    const activeDeliveries = await this.prisma.deliveryRequest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        trackingSession: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            stoppedAt: true,
            drivenMiles: true,
            points: {
              take: 1,
              orderBy: { recordedAt: "desc" },
              select: {
                lat: true,
                lng: true,
                recordedAt: true,
              },
            },
          },
        },
        assignments: {
          where: { unassignedAt: null },
          take: 1,
          orderBy: { assignedAt: "desc" },
          select: {
            driver: {
              select: {
                id: true,
                user: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);

    const items = activeDeliveries.map((delivery) => {
      const latestPoint = delivery.trackingSession?.points?.[0] ?? null;
      const assignment = delivery.assignments?.[0] ?? null;

      return {
        deliveryId: delivery.id,
        status: delivery.status,
        driverId: assignment?.driver?.id ?? null,
        driverName: assignment?.driver?.user?.fullName ?? null,
        latestPointAt: latestPoint?.recordedAt ?? null,
        latestLat: latestPoint?.lat ?? null,
        latestLng: latestPoint?.lng ?? null,
        trackingStatus: delivery.trackingSession?.status ?? null,
        drivenMiles: this.toMoney(delivery.trackingSession?.drivenMiles),
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
      };
    });

    const activeTrackedCount = items.filter((i) => i.latestPointAt != null).length;
    const activeUntrackedCount = items.filter((i) => i.latestPointAt == null).length;
    const staleTrackingCount = items.filter(
      (i) => i.latestPointAt != null && new Date(i.latestPointAt) < staleBefore
    ).length;

    return {
      activeTrackedCount,
      activeUntrackedCount,
      staleTrackingCount,
      items,
      action: {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "Open live deliveries",
        target: "deliveries",
        filters: {
          statuses: [EnumDeliveryRequestStatus.ACTIVE],
        },
      },
    };
  }

  private async getNeedsAttention(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const complianceMissingWhere: Prisma.DeliveryRequestWhereInput = {
      AND: [
        deliveryWhere,
        {
          status: {
            in: [
              EnumDeliveryRequestStatus.BOOKED,
              EnumDeliveryRequestStatus.ACTIVE,
              EnumDeliveryRequestStatus.COMPLETED,
            ],
          },
        },
        {
          OR: [{ compliance: null }, { compliance: { vinConfirmed: false } }],
        },
      ],
    };

    const complianceMissingItems = await this.prisma.deliveryRequest.findMany({
      where: complianceMissingWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            customerType: true,
            businessName: true,
            contactName: true,
          },
        },
        compliance: {
          select: {
            id: true,
            vinConfirmed: true,
            pickupCompletedAt: true,
            dropoffCompletedAt: true,
          },
        },
      },
    });

    const complianceMissingCount = await this.prisma.deliveryRequest.count({
      where: complianceMissingWhere,
    });

    const dealerApprovalItems = await this.prisma.customer.findMany({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        businessPhone: true,
        createdAt: true,
        approvalStatus: true,
      },
    });

    const dealerApprovalCount = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
    });

    const driverApprovalItems = await this.prisma.driver.findMany({
      where: {
        status: EnumDriverStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        phone: true,
        status: true,
        profilePhotoUrl: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const driverApprovalCount = await this.prisma.driver.count({
      where: {
        status: EnumDriverStatus.PENDING,
      },
    });

    const listedWithoutAssignmentWhere: Prisma.DeliveryRequestWhereInput = {
      AND: [
        deliveryWhere,
        { status: EnumDeliveryRequestStatus.LISTED },
        {
          assignments: {
            none: {
              unassignedAt: null,
            },
          },
        },
      ],
    };

    const listedWithoutAssignmentItems =
      await this.prisma.deliveryRequest.findMany({
        where: listedWithoutAssignmentWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          serviceType: true,
          pickupAddress: true,
          dropoffAddress: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              customerType: true,
              businessName: true,
              contactName: true,
            },
          },
        },
      });

    const listedWithoutAssignmentCount =
      await this.prisma.deliveryRequest.count({
        where: listedWithoutAssignmentWhere,
      });

    const opsConfirmationWhere: Prisma.DeliveryRequestWhereInput = {
      AND: [
        deliveryWhere,
        { requiresOpsConfirmation: true },
        {
          status: {
            in: [
              EnumDeliveryRequestStatus.QUOTED,
              EnumDeliveryRequestStatus.LISTED,
              EnumDeliveryRequestStatus.BOOKED,
            ],
          },
        },
      ],
    };

    const opsConfirmationItems = await this.prisma.deliveryRequest.findMany({
      where: opsConfirmationWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        serviceType: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            customerType: true,
            businessName: true,
            contactName: true,
          },
        },
      },
    });

    const opsConfirmationCount = await this.prisma.deliveryRequest.count({
      where: opsConfirmationWhere,
    });

    const payoutEligibleItems = await this.prisma.driverPayout.findMany({
      where: {
        delivery: deliveryWhere,
        status: EnumDriverPayoutStatus.ELIGIBLE,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        grossAmount: true,
        netAmount: true,
        status: true,
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
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    const payoutEligibleCount = await this.prisma.driverPayout.count({
      where: {
        delivery: deliveryWhere,
        status: EnumDriverPayoutStatus.ELIGIBLE,
      },
    });

    const openDisputeWhere: Prisma.DisputeCaseWhereInput = {
      delivery: deliveryWhere,
      status: {
        in: [
          EnumDisputeCaseStatus.OPEN,
          EnumDisputeCaseStatus.UNDER_REVIEW,
        ],
      },
    };

    const openDisputeItems = await this.prisma.disputeCase.findMany({
      where: openDisputeWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        reason: true,
        legalHold: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    const openDisputeCount = await this.prisma.disputeCase.count({
      where: openDisputeWhere,
    });

    const paymentFailedItems = await this.prisma.payment.findMany({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.FAILED,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        failureCode: true,
        failureMessage: true,
        status: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    const paymentFailedCount = await this.prisma.payment.count({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.FAILED,
      },
    });

    const activeWithoutTrackingItems = await this.prisma.deliveryRequest.findMany({
      where: {
        AND: [
          deliveryWhere,
          { status: EnumDeliveryRequestStatus.ACTIVE },
          {
            OR: [
              { trackingSession: null },
              { trackingSession: { points: { none: {} } } },
            ],
          },
        ],
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            customerType: true,
            businessName: true,
            contactName: true,
          },
        },
      },
    });

    const activeWithoutTrackingCount = activeWithoutTrackingItems.length;

    return [
      {
        issueType: EnumAdminDashboardAttentionType.DELIVERY_COMPLIANCE_MISSING,
        title: "Compliance missing",
        count: complianceMissingCount,
        items: complianceMissingItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: { complianceMissing: true },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.DEALER_APPROVAL_PENDING,
        title: "Dealer approval pending",
        count: dealerApprovalCount,
        items: dealerApprovalItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "customers",
          filters: {
            customerType: EnumCustomerCustomerType.BUSINESS,
            approvalStatus: EnumCustomerApprovalStatus.PENDING,
          },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.DRIVER_APPROVAL_PENDING,
        title: "Driver approval pending",
        count: driverApprovalCount,
        items: driverApprovalItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "drivers",
          filters: {
            status: EnumDriverStatus.PENDING,
          },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.LISTED_WITHOUT_ASSIGNMENT,
        title: "Listed delivery unassigned",
        count: listedWithoutAssignmentCount,
        items: listedWithoutAssignmentItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: {
            statuses: [EnumDeliveryRequestStatus.LISTED],
            withoutAssignment: true,
          },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.OPS_CONFIRMATION_REQUIRED,
        title: "Operations confirmation required",
        count: opsConfirmationCount,
        items: opsConfirmationItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: {
            requiresOpsConfirmation: true,
          },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.PAYOUT_ELIGIBLE,
        title: "Payouts eligible",
        count: payoutEligibleCount,
        items: payoutEligibleItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "payouts",
          filters: {
            statuses: [EnumDriverPayoutStatus.ELIGIBLE],
          },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.OPEN_DISPUTE,
        title: "Open disputes",
        count: openDisputeCount,
        items: openDisputeItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "disputes",
          filters: {
            statuses: [
              EnumDisputeCaseStatus.OPEN,
              EnumDisputeCaseStatus.UNDER_REVIEW,
            ],
          },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.PAYMENT_FAILED,
        title: "Payment failures",
        count: paymentFailedCount,
        items: paymentFailedItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "payments",
          filters: {
            statuses: [EnumPaymentStatus.FAILED],
          },
        },
      },
      {
        issueType: EnumAdminDashboardAttentionType.ACTIVE_WITHOUT_TRACKING,
        title: "Active without tracking",
        count: activeWithoutTrackingCount,
        items: activeWithoutTrackingItems,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: {
            statuses: [EnumDeliveryRequestStatus.ACTIVE],
            activeWithoutTracking: true,
          },
        },
      },
    ];
  }

  private async getAlerts(deliveryWhere: Prisma.DeliveryRequestWhereInput) {
    const operations = await this.getOperations(deliveryWhere);
    const finance = await this.getFinance(deliveryWhere);
    const openDisputes = await this.prisma.disputeCase.count({
      where: {
        delivery: deliveryWhere,
        status: {
          in: [
            EnumDisputeCaseStatus.OPEN,
            EnumDisputeCaseStatus.UNDER_REVIEW,
          ],
        },
      },
    });

    const staleTrackingCount = await this.countStaleTrackingDeliveries(deliveryWhere);

    const items = [
      {
        severity:
          operations.activeWithoutTracking > 0
            ? EnumAdminDashboardAlertSeverity.CRITICAL
            : EnumAdminDashboardAlertSeverity.WARNING,
        code: EnumAdminDashboardAttentionType.ACTIVE_WITHOUT_TRACKING,
        title: "Active deliveries without tracking",
        subtitle: "Trips that started but do not have tracking points.",
        count: operations.activeWithoutTracking,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: {
            statuses: [EnumDeliveryRequestStatus.ACTIVE],
            activeWithoutTracking: true,
          },
        },
      },
      {
        severity: EnumAdminDashboardAlertSeverity.WARNING,
        code: EnumAdminDashboardAttentionType.DELIVERY_COMPLIANCE_MISSING,
        title: "Compliance missing",
        subtitle: "Trips missing VIN or required pickup/drop-off proof.",
        count: operations.deliveriesMissingCompliance,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: { complianceMissing: true },
        },
      },
      {
        severity: EnumAdminDashboardAlertSeverity.WARNING,
        code: EnumAdminDashboardAttentionType.LISTED_WITHOUT_ASSIGNMENT,
        title: "Listed without assignment",
        subtitle: "Listed jobs that still do not have a driver.",
        count: operations.listedWithoutAssignment,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: {
            statuses: [EnumDeliveryRequestStatus.LISTED],
            withoutAssignment: true,
          },
        },
      },
      {
        severity: EnumAdminDashboardAlertSeverity.WARNING,
        code: EnumAdminDashboardAttentionType.OPS_CONFIRMATION_REQUIRED,
        title: "Ops confirmation required",
        subtitle: "Deliveries waiting for operations confirmation.",
        count: (await this.getSummary(deliveryWhere)).deliveriesNeedingOpsConfirmation,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: {
            requiresOpsConfirmation: true,
          },
        },
      },
      {
        severity:
          finance.failedPaymentsCount > 0
            ? EnumAdminDashboardAlertSeverity.CRITICAL
            : EnumAdminDashboardAlertSeverity.WARNING,
        code: EnumAdminDashboardAttentionType.PAYMENT_FAILED,
        title: "Payment failures",
        subtitle: "Payments requiring admin review.",
        count: finance.failedPaymentsCount,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "payments",
          filters: {
            statuses: [EnumPaymentStatus.FAILED],
          },
        },
      },
      {
        severity:
          openDisputes > 0
            ? EnumAdminDashboardAlertSeverity.CRITICAL
            : EnumAdminDashboardAlertSeverity.WARNING,
        code: EnumAdminDashboardAttentionType.OPEN_DISPUTE,
        title: "Open disputes",
        subtitle: "Disputes waiting for ops/legal handling.",
        count: openDisputes,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "disputes",
          filters: {
            statuses: [
              EnumDisputeCaseStatus.OPEN,
              EnumDisputeCaseStatus.UNDER_REVIEW,
            ],
          },
        },
      },
      {
        severity:
          staleTrackingCount > 0
            ? EnumAdminDashboardAlertSeverity.WARNING
            : EnumAdminDashboardAlertSeverity.WARNING,
        code: EnumAdminDashboardAttentionType.STALE_TRACKING,
        title: "Stale tracking",
        subtitle: "Active trips with no recent driver location updates.",
        count: staleTrackingCount,
        action: {
          type: EnumAdminDashboardActionType.NAVIGATE,
          label: "Open",
          target: "deliveries",
          filters: {
            statuses: [EnumDeliveryRequestStatus.ACTIVE],
            staleTracking: true,
          },
        },
      },
    ];

    const criticalCount = items
      .filter((x) => x.severity === EnumAdminDashboardAlertSeverity.CRITICAL)
      .reduce((sum, item) => sum + item.count, 0);

    const warningCount = items
      .filter((x) => x.severity === EnumAdminDashboardAlertSeverity.WARNING)
      .reduce((sum, item) => sum + item.count, 0);

    return {
      criticalCount,
      warningCount,
      items,
    };
  }

  private async getPricingSnapshot() {
    const config = await this.prisma.pricingConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        active: true,
        pricingMode: true,
        baseFee: true,
        perMileRate: true,
        insuranceFee: true,
        transactionFeePct: true,
        transactionFeeFixed: true,
        feePassThrough: true,
        driverSharePct: true,
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
            perMileRate: true,
            flatPrice: true,
          },
          orderBy: [{ category: "asc" }, { minMiles: "asc" }],
        },
      },
    });

    return {
      id: config?.id ?? null,
      name: config?.name ?? null,
      pricingMode: config?.pricingMode ?? null,
      baseFee: this.toMoney(config?.baseFee),
      perMileRate:
        config?.perMileRate != null ? this.toMoney(config.perMileRate) : null,
      insuranceFee: this.toMoney(config?.insuranceFee),
      transactionFeePct:
        config?.transactionFeePct != null
          ? this.toMoney(config.transactionFeePct)
          : null,
      transactionFeeFixed:
        config?.transactionFeeFixed != null
          ? this.toMoney(config.transactionFeeFixed)
          : null,
      feePassThrough: config?.feePassThrough === true,
      driverSharePct: this.toMoney(config?.driverSharePct),
      active: config?.active === true,
      tiers: config?.tiers ?? [],
      categoryRules: config?.categoryRules ?? [],
    };
  }

  private async getSchedulingPolicySummary(
    filters: AdminDashboardOverviewQuery
  ) {
    const customerType =
      filters.customerType === EnumCustomerCustomerType.PRIVATE
        ? EnumSchedulingPolicyCustomerType.PRIVATE
        : EnumSchedulingPolicyCustomerType.BUSINESS;

    const policy = await this.prisma.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType,
        ...(filters.serviceType ? { serviceType: filters.serviceType as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerType: true,
        serviceType: true,
        defaultMode: true,
        bufferMinutes: true,
        sameDayCutoffTime: true,
        maxSameDayMiles: true,
        afterHoursEnabled: true,
        requiresOpsConfirmation: true,
      },
    });

    return {
      id: policy?.id ?? null,
      customerType: policy?.customerType ?? null,
      serviceType: policy?.serviceType ?? null,
      defaultMode: policy?.defaultMode ?? null,
      sameDayAllowed: policy?.defaultMode === "SAME_DAY",
      bufferMinutes: policy?.bufferMinutes ?? 30,
      sameDayCutoffTime: policy?.sameDayCutoffTime ?? null,
      maxSameDayMiles:
        policy?.maxSameDayMiles != null
          ? this.toMoney(policy.maxSameDayMiles)
          : null,
      afterHoursEnabled: policy?.afterHoursEnabled === true,
      requiresOpsConfirmation: policy?.requiresOpsConfirmation === true,
    };
  }

  private async getActorSummary() {
    const privatePending = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.PRIVATE,
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
    });

    const privateApproved = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.PRIVATE,
        approvalStatus: EnumCustomerApprovalStatus.APPROVED,
      },
    });

    const privateRejected = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.PRIVATE,
        approvalStatus: EnumCustomerApprovalStatus.REJECTED,
      },
    });

    const privateSuspended = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.PRIVATE,
        approvalStatus: EnumCustomerApprovalStatus.SUSPENDED,
      },
    });

    const businessPending = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
    });

    const businessApproved = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.APPROVED,
      },
    });

    const businessRejected = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.REJECTED,
      },
    });

    const businessSuspended = await this.prisma.customer.count({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.SUSPENDED,
      },
    });

    const driverPending = await this.prisma.driver.count({
      where: { status: EnumDriverStatus.PENDING },
    });

    const driverApproved = await this.prisma.driver.count({
      where: { status: EnumDriverStatus.APPROVED },
    });

    const driverSuspended = await this.prisma.driver.count({
      where: { status: EnumDriverStatus.SUSPENDED },
    });

    return {
      privateCustomers: {
        pending: privatePending,
        approved: privateApproved,
        rejected: privateRejected,
        suspended: privateSuspended,
      },
      businessCustomers: {
        pending: businessPending,
        approved: businessApproved,
        rejected: businessRejected,
        suspended: businessSuspended,
      },
      drivers: {
        pending: driverPending,
        approved: driverApproved,
        suspended: driverSuspended,
      },
    };
  }

  private async getDriverOperations(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const actorSummary = await this.getActorSummary();

    const activeAssignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        unassignedAt: null,
        delivery: {
          AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.ACTIVE }],
        },
      },
      select: {
        driverId: true,
      },
      distinct: ["driverId"],
    });

    const recentPendingDrivers = await this.prisma.driver.findMany({
      where: { status: EnumDriverStatus.PENDING },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        phone: true,
        profilePhotoUrl: true,
        createdAt: true,
        status: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return {
      approvedDrivers: actorSummary.drivers.approved,
      pendingDrivers: actorSummary.drivers.pending,
      suspendedDrivers: actorSummary.drivers.suspended,
      driversWithActiveTrips: activeAssignments.length,
      recentPendingDrivers,
    };
  }

  private async getDealerActivity(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const actorSummary = await this.getActorSummary();

    const grouped = await this.prisma.deliveryRequest.groupBy({
      by: ["customerId"],
      where: {
        AND: [
          deliveryWhere,
          {
            customer: {
              customerType: EnumCustomerCustomerType.BUSINESS,
            },
          },
        ],
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          customerId: "desc",
        },
      },
      take: 5,
    });

    const topDealersByVolume = await Promise.all(
      grouped.map(async (row) => {
        const customer = await this.prisma.customer.findUnique({
          where: { id: row.customerId },
          select: {
            id: true,
            businessName: true,
          },
        });

        const activeDeliveries = await this.prisma.deliveryRequest.count({
          where: {
            AND: [
              deliveryWhere,
              { customerId: row.customerId },
              { status: EnumDeliveryRequestStatus.ACTIVE },
            ],
          },
        });

        const disputedDeliveries = await this.prisma.deliveryRequest.count({
          where: {
            AND: [
              deliveryWhere,
              { customerId: row.customerId },
              {
                OR: [
                  { status: EnumDeliveryRequestStatus.DISPUTED },
                  {
                    dispute: {
                      status: {
                        in: [
                          EnumDisputeCaseStatus.OPEN,
                          EnumDisputeCaseStatus.UNDER_REVIEW,
                        ],
                      },
                    },
                  },
                ],
              },
            ],
          },
        });

        return {
          customerId: row.customerId,
          businessName: customer?.businessName ?? null,
          deliveries: row._count._all,
          activeDeliveries,
          disputedDeliveries,
        };
      })
    );

    const activeBusinessCustomersInRange = await this.prisma.deliveryRequest.groupBy({
      by: ["customerId"],
      where: {
        AND: [
          deliveryWhere,
          {
            customer: {
              customerType: EnumCustomerCustomerType.BUSINESS,
            },
          },
        ],
      },
      _count: {
        _all: true,
      },
    });

    return {
      approvedBusinessCustomers: actorSummary.businessCustomers.approved,
      pendingBusinessCustomers: actorSummary.businessCustomers.pending,
      activeBusinessCustomersInRange: activeBusinessCustomersInRange.length,
      topDealersByVolume,
    };
  }

  private async getSummary(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const totalDeliveries = await this.prisma.deliveryRequest.count({
      where: deliveryWhere,
    });

    const activeTrips = await this.prisma.deliveryRequest.count({
      where: {
        AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.ACTIVE }],
      },
    });

    const completedDeliveries = await this.prisma.deliveryRequest.count({
      where: {
        AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.COMPLETED }],
      },
    });

    const cancelledDeliveries = await this.prisma.deliveryRequest.count({
      where: {
        AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.CANCELLED }],
      },
    });

    const deliveriesNeedingOpsConfirmation =
      await this.prisma.deliveryRequest.count({
        where: {
          AND: [
            deliveryWhere,
            { requiresOpsConfirmation: true },
            {
              status: {
                in: [
                  EnumDeliveryRequestStatus.QUOTED,
                  EnumDeliveryRequestStatus.LISTED,
                  EnumDeliveryRequestStatus.BOOKED,
                ],
              },
            },
          ],
        },
      });

    const openDisputes = await this.prisma.disputeCase.count({
      where: {
        delivery: deliveryWhere,
        status: {
          in: [
            EnumDisputeCaseStatus.OPEN,
            EnumDisputeCaseStatus.UNDER_REVIEW,
          ],
        },
      },
    });

    const pendingCustomerApprovals = await this.prisma.customer.count({
      where: {
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
    });

    const pendingDriverApprovals = await this.prisma.driver.count({
      where: {
        status: EnumDriverStatus.PENDING,
      },
    });

    return {
      totalDeliveries,
      activeTrips,
      completedDeliveries,
      cancelledDeliveries,
      deliveriesNeedingOpsConfirmation,
      openDisputes,
      pendingCustomerApprovals,
      pendingDriverApprovals,
    };
  }

  private async getPipeline(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const grouped = await this.prisma.deliveryRequest.groupBy({
      by: ["status"],
      where: deliveryWhere,
      _count: {
        _all: true,
      },
    });

    const map = new Map<EnumDeliveryRequestStatus, number>();
    for (const row of grouped) {
      map.set(row.status, row._count._all);
    }

    return {
      draft: map.get(EnumDeliveryRequestStatus.DRAFT) ?? 0,
      quoted: map.get(EnumDeliveryRequestStatus.QUOTED) ?? 0,
      listed: map.get(EnumDeliveryRequestStatus.LISTED) ?? 0,
      booked: map.get(EnumDeliveryRequestStatus.BOOKED) ?? 0,
      active: map.get(EnumDeliveryRequestStatus.ACTIVE) ?? 0,
      completed: map.get(EnumDeliveryRequestStatus.COMPLETED) ?? 0,
      cancelled: map.get(EnumDeliveryRequestStatus.CANCELLED) ?? 0,
      expired: map.get(EnumDeliveryRequestStatus.EXPIRED) ?? 0,
      disputed: map.get(EnumDeliveryRequestStatus.DISPUTED) ?? 0,
    };
  }

  private async getFinance(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const authorizedPaymentsCount = await this.prisma.payment.count({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.AUTHORIZED,
      },
    });

    const capturedPaymentsCount = await this.prisma.payment.count({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.CAPTURED,
      },
    });

    const invoicedPostpaidCount = await this.prisma.payment.count({
      where: {
        delivery: deliveryWhere,
        paymentType: EnumPaymentPaymentType.POSTPAID,
        status: EnumPaymentStatus.INVOICED,
      },
    });

    const paidPostpaidCount = await this.prisma.payment.count({
      where: {
        delivery: deliveryWhere,
        paymentType: EnumPaymentPaymentType.POSTPAID,
        status: EnumPaymentStatus.PAID,
      },
    });

    const failedPaymentsCount = await this.prisma.payment.count({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.FAILED,
      },
    });

    const eligiblePayoutCount = await this.prisma.driverPayout.count({
      where: {
        delivery: deliveryWhere,
        status: EnumDriverPayoutStatus.ELIGIBLE,
      },
    });

    const paidPayoutCount = await this.prisma.driverPayout.count({
      where: {
        delivery: deliveryWhere,
        status: EnumDriverPayoutStatus.PAID,
      },
    });

    const grossRevenueAgg = await this.prisma.payment.aggregate({
      where: {
        delivery: deliveryWhere,
        status: {
          in: [
            EnumPaymentStatus.AUTHORIZED,
            EnumPaymentStatus.CAPTURED,
            EnumPaymentStatus.INVOICED,
            EnumPaymentStatus.PAID,
          ],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const capturedRevenueAgg = await this.prisma.payment.aggregate({
      where: {
        delivery: deliveryWhere,
        status: EnumPaymentStatus.CAPTURED,
      },
      _sum: {
        amount: true,
      },
    });

    const postpaidReceivableAgg = await this.prisma.payment.aggregate({
      where: {
        delivery: deliveryWhere,
        paymentType: EnumPaymentPaymentType.POSTPAID,
        status: EnumPaymentStatus.INVOICED,
      },
      _sum: {
        amount: true,
      },
    });

    const paidOutAmountAgg = await this.prisma.driverPayout.aggregate({
      where: {
        delivery: deliveryWhere,
        status: EnumDriverPayoutStatus.PAID,
      },
      _sum: {
        netAmount: true,
      },
    });

    const pendingPayoutAmountAgg = await this.prisma.driverPayout.aggregate({
      where: {
        delivery: deliveryWhere,
        status: EnumDriverPayoutStatus.ELIGIBLE,
      },
      _sum: {
        netAmount: true,
      },
    });

    return {
      authorizedPaymentsCount,
      capturedPaymentsCount,
      invoicedPostpaidCount,
      paidPostpaidCount,
      failedPaymentsCount,
      eligiblePayoutCount,
      paidPayoutCount,
      grossRevenue: this.toMoney(grossRevenueAgg._sum.amount),
      capturedRevenue: this.toMoney(capturedRevenueAgg._sum.amount),
      postpaidReceivable: this.toMoney(postpaidReceivableAgg._sum.amount),
      paidOutAmount: this.toMoney(paidOutAmountAgg._sum.netAmount),
      pendingPayoutAmount: this.toMoney(pendingPayoutAmountAgg._sum.netAmount),
    };
  }

  private async getFinancialSnapshot(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const finance = await this.getFinance(deliveryWhere);

    const quoteRows = await this.prisma.deliveryRequest.findMany({
      where: deliveryWhere,
      select: {
        quote: {
          select: {
            feesBreakdown: true,
          },
        },
      },
    });

    let insuranceFeesEstimated = 0;
    for (const row of quoteRows) {
      const fee =
        (row.quote?.feesBreakdown as Record<string, unknown> | null)?.insuranceFee;
      if (typeof fee === "number") {
        insuranceFeesEstimated += fee;
      }
    }

    return {
      grossRevenue: finance.grossRevenue,
      capturedRevenue: finance.capturedRevenue,
      postpaidReceivable: finance.postpaidReceivable,
      pendingPayoutAmount: finance.pendingPayoutAmount,
      paidOutAmount: finance.paidOutAmount,
      insuranceFeesEstimated: this.toMoney(insuranceFeesEstimated),
    };
  }

  private async getOperations(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const quotedStaleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bookedStaleBefore = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const listedWithoutAssignment = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { status: EnumDeliveryRequestStatus.LISTED },
          {
            assignments: {
              none: {
                unassignedAt: null,
              },
            },
          },
        ],
      },
    });

    const bookedWithoutComplianceReady =
      await this.prisma.deliveryRequest.count({
        where: {
          AND: [
            deliveryWhere,
            { status: EnumDeliveryRequestStatus.BOOKED },
            {
              OR: [
                { compliance: null },
                { compliance: { vinConfirmed: false } },
                { compliance: { pickupCompletedAt: null } },
              ],
            },
          ],
        },
      });

    const activeWithoutTracking = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { status: EnumDeliveryRequestStatus.ACTIVE },
          {
            OR: [
              { trackingSession: null },
              {
                trackingSession: {
                  points: {
                    none: {},
                  },
                },
              },
            ],
          },
        ],
      },
    });

    const deliveriesMissingCompliance = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          {
            status: {
              in: [
                EnumDeliveryRequestStatus.BOOKED,
                EnumDeliveryRequestStatus.ACTIVE,
                EnumDeliveryRequestStatus.COMPLETED,
              ],
            },
          },
          {
            OR: [{ compliance: null }, { compliance: { vinConfirmed: false } }],
          },
        ],
      },
    });

    const staleQuotedDeliveries = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { status: EnumDeliveryRequestStatus.QUOTED },
          {
            createdAt: {
              lt: quotedStaleBefore,
            },
          },
        ],
      },
    });

    const staleBookedDeliveries = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { status: EnumDeliveryRequestStatus.BOOKED },
          {
            createdAt: {
              lt: bookedStaleBefore,
            },
          },
        ],
      },
    });

    return {
      listedWithoutAssignment,
      bookedWithoutComplianceReady,
      activeWithoutTracking,
      deliveriesMissingCompliance,
      staleQuotedDeliveries,
      staleBookedDeliveries,
    };
  }

  private async getDeliveryBreakdowns(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const privateCount = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          {
            customer: {
              customerType: EnumCustomerCustomerType.PRIVATE,
            },
          },
        ],
      },
    });

    const businessCount = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          {
            customer: {
              customerType: EnumCustomerCustomerType.BUSINESS,
            },
          },
        ],
      },
    });

    const privateCreated = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          {
            createdByRole: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
          },
        ],
      },
    });

    const businessCreated = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          {
            createdByRole: EnumDeliveryRequestCreatedByRole.BUSINESS_CUSTOMER,
          },
        ],
      },
    });

    const driverCreated = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { createdByRole: EnumDeliveryRequestCreatedByRole.DRIVER },
        ],
      },
    });

    const adminCreated = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { createdByRole: EnumDeliveryRequestCreatedByRole.ADMIN },
        ],
      },
    });

    const unknownCreated = await this.prisma.deliveryRequest.count({
      where: {
        AND: [deliveryWhere, { createdByRole: null }],
      },
    });

    const homeDelivery = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { serviceType: EnumDeliveryRequestServiceType.HOME_DELIVERY },
        ],
      },
    });

    const betweenLocations = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { serviceType: EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS },
        ],
      },
    });

    const servicePickupReturn = await this.prisma.deliveryRequest.count({
      where: {
        AND: [
          deliveryWhere,
          { serviceType: EnumDeliveryRequestServiceType.SERVICE_PICKUP_RETURN },
        ],
      },
    });

    return {
      byCustomerType: {
        private: privateCount,
        business: businessCount,
      },
      byCreatedByRole: {
        privateCustomer: privateCreated,
        businessCustomer: businessCreated,
        driver: driverCreated,
        admin: adminCreated,
        unknown: unknownCreated,
      },
      byServiceType: {
        homeDelivery,
        betweenLocations,
        servicePickupReturn,
      },
    };
  }

  private async getReportsPreview(
    deliveryWhere: Prisma.DeliveryRequestWhereInput,
    range: DateRange
  ) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const deliveriesToday = await this.prisma.deliveryRequest.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const totalDeliveries = await this.prisma.deliveryRequest.count({
      where: deliveryWhere,
    });

    const completedDeliveries = await this.prisma.deliveryRequest.count({
      where: {
        AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.COMPLETED }],
      },
    });

    const openDisputes = await this.prisma.disputeCase.count({
      where: {
        delivery: deliveryWhere,
        status: {
          in: [
            EnumDisputeCaseStatus.OPEN,
            EnumDisputeCaseStatus.UNDER_REVIEW,
          ],
        },
      },
    });

    const completedTracking = await this.prisma.trackingSession.aggregate({
      where: {
        delivery: {
          AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.COMPLETED }],
        },
      },
      _avg: {
        drivenMiles: true,
      },
    });

    const completionRate =
      totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

    const disputeRate =
      totalDeliveries > 0 ? (openDisputes / totalDeliveries) * 100 : 0;

    return {
      deliveriesToday,
      completionRate: this.toMoney(completionRate),
      disputeRate: this.toMoney(disputeRate),
      avgDrivenMilesCompleted: this.toMoney(completedTracking._avg.drivenMiles),
      from: range.from,
      to: range.to,
    };
  }

  private getQuickActions() {
    return [
      {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "Open deliveries",
        target: "deliveries",
        filters: null,
      },
      {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "Review driver approvals",
        target: "drivers",
        filters: {
          status: EnumDriverStatus.PENDING,
        },
      },
      {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "Open disputes",
        target: "disputes",
        filters: {
          statuses: [
            EnumDisputeCaseStatus.OPEN,
            EnumDisputeCaseStatus.UNDER_REVIEW,
          ],
        },
      },
      {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "Open payments",
        target: "payments",
        filters: null,
      },
      {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "Open payouts",
        target: "payouts",
        filters: {
          statuses: [EnumDriverPayoutStatus.ELIGIBLE],
        },
      },
      {
        type: EnumAdminDashboardActionType.NAVIGATE,
        label: "Open insurance reporting",
        target: "insurance-reporting",
        filters: null,
      },
    ];
  }

  private async getRecent(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ) {
    const pendingPrivateCustomers = await this.prisma.customer.findMany({
      where: {
        customerType: EnumCustomerCustomerType.PRIVATE,
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        contactName: true,
        contactEmail: true,
        phone: true,
        createdAt: true,
        approvalStatus: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const pendingBusinessCustomers = await this.prisma.customer.findMany({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        businessPhone: true,
        createdAt: true,
        approvalStatus: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const pendingDrivers = await this.prisma.driver.findMany({
      where: {
        status: EnumDriverStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        phone: true,
        status: true,
        profilePhotoUrl: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const deliveriesNeedingOpsConfirmation =
      await this.prisma.deliveryRequest.findMany({
        where: {
          AND: [
            deliveryWhere,
            { requiresOpsConfirmation: true },
            {
              status: {
                in: [
                  EnumDeliveryRequestStatus.QUOTED,
                  EnumDeliveryRequestStatus.LISTED,
                  EnumDeliveryRequestStatus.BOOKED,
                ],
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          serviceType: true,
          pickupAddress: true,
          dropoffAddress: true,
          pickupWindowStart: true,
          dropoffWindowEnd: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              customerType: true,
              businessName: true,
              contactName: true,
            },
          },
        },
      });

    const recentDisputes = await this.prisma.disputeCase.findMany({
      where: {
        delivery: deliveryWhere,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        reason: true,
        legalHold: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    const recentPayments = await this.prisma.payment.findMany({
      where: {
        delivery: deliveryWhere,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        paymentType: true,
        provider: true,
        status: true,
        createdAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    const recentPayouts = await this.prisma.driverPayout.findMany({
      where: {
        delivery: deliveryWhere,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        grossAmount: true,
        netAmount: true,
        status: true,
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
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
              },
            },
          },
        },
      },
    });

    return {
      pendingPrivateCustomers,
      pendingBusinessCustomers,
      pendingDrivers,
      deliveriesNeedingOpsConfirmation,
      recentDisputes,
      recentPayments,
      recentPayouts,
    };
  }

  private buildDeliveryWhere(
    filters: AdminDashboardOverviewQuery,
    range: DateRange
  ): Prisma.DeliveryRequestWhereInput {
    const and: Prisma.DeliveryRequestWhereInput[] = [];

    if (range.from || range.to) {
      and.push({
        createdAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      });
    }

    if (filters.statuses?.length) {
      and.push({
        status: {
          in: filters.statuses,
        },
      });
    }

    if (filters.customerId) {
      and.push({
        customerId: filters.customerId,
      });
    }

    if (filters.customerType) {
      and.push({
        customer: {
          customerType: filters.customerType,
        },
      });
    }

    if (filters.createdByRole) {
      and.push({
        createdByRole: filters.createdByRole,
      });
    }

    if (filters.serviceType) {
      and.push({
        serviceType: filters.serviceType,
      });
    }

    if (filters.requiresOpsConfirmation !== undefined) {
      and.push({
        requiresOpsConfirmation: filters.requiresOpsConfirmation,
      });
    }

    if (filters.urgentOnly === true) {
      and.push({
        isUrgent: true,
      });
    }

    if (filters.disputedOnly === true) {
      and.push({
        OR: [
          { status: EnumDeliveryRequestStatus.DISPUTED },
          {
            dispute: {
              status: {
                in: [
                  EnumDisputeCaseStatus.OPEN,
                  EnumDisputeCaseStatus.UNDER_REVIEW,
                ],
              },
            },
          },
        ],
      });
    }

    return and.length ? { AND: and } : {};
  }

  private resolveDateRange(filters: AdminDashboardOverviewQuery): DateRange {
    const preset =
      filters.datePreset ?? EnumAdminDashboardDatePreset.LAST_30_DAYS;

    if (preset === EnumAdminDashboardDatePreset.CUSTOM) {
      return {
        from: filters.from ?? null,
        to: filters.to ?? null,
      };
    }

    const now = new Date();
    const from = new Date(now);
    const to = new Date(now);

    if (preset === EnumAdminDashboardDatePreset.TODAY) {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }

    if (preset === EnumAdminDashboardDatePreset.LAST_7_DAYS) {
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }

    if (preset === EnumAdminDashboardDatePreset.THIS_MONTH) {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }

    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    return { from, to };
  }

  private async countStaleTrackingDeliveries(
    deliveryWhere: Prisma.DeliveryRequestWhereInput
  ): Promise<number> {
    const activeDeliveries = await this.prisma.deliveryRequest.findMany({
      where: {
        AND: [deliveryWhere, { status: EnumDeliveryRequestStatus.ACTIVE }],
      },
      select: {
        id: true,
        trackingSession: {
          select: {
            points: {
              take: 1,
              orderBy: { recordedAt: "desc" },
              select: {
                recordedAt: true,
              },
            },
          },
        },
      },
    });

    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);

    return activeDeliveries.filter((delivery) => {
      const latest = delivery.trackingSession?.points?.[0]?.recordedAt ?? null;
      return latest != null && latest < staleBefore;
    }).length;
  }

  private activeDeliverySelect(): Prisma.DeliveryRequestSelect {
    return {
      id: true,
      status: true,
      serviceType: true,
      isUrgent: true,
      requiresOpsConfirmation: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupWindowStart: true,
      dropoffWindowEnd: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          customerType: true,
          businessName: true,
          contactName: true,
        },
      },
      assignments: {
        where: {
          unassignedAt: null,
        },
        take: 1,
        orderBy: {
          assignedAt: "desc",
        },
        select: {
          id: true,
          assignedAt: true,
          driver: {
            select: {
              id: true,
              phone: true,
              profilePhotoUrl: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
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
          points: {
            take: 1,
            orderBy: { recordedAt: "desc" },
            select: {
              lat: true,
              lng: true,
              recordedAt: true,
            },
          },
        },
      },
      compliance: {
        select: {
          id: true,
          vinConfirmed: true,
          pickupCompletedAt: true,
          dropoffCompletedAt: true,
          odometerStart: true,
          odometerEnd: true,
        },
      },
    };
  }

  private toMoney(value: number | null | undefined): number {
    return Number((value ?? 0).toFixed(2));
  }
}