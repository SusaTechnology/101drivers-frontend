import { EnterpriseReportKey } from "./report-column.definitions";

type AnyRow = Record<string, any>;

function nameOfBusiness(entity?: AnyRow | null): string {
  return (
    entity?.businessName ??
    entity?.companyName ??
    entity?.contactName ??
    entity?.user?.fullName ??
    entity?.user?.email ??
    ""
  );
}

function nameOfUser(entity?: AnyRow | null): string {
  return (
    entity?.user?.fullName ??
    entity?.fullName ??
    entity?.user?.email ??
    entity?.email ??
    ""
  );
}

export function mapReportRows(
  reportKey: EnterpriseReportKey,
  rows: AnyRow[]
): AnyRow[] {
  switch (reportKey) {
    case "deliveries":
      return rows.map((r) => ({
        deliveryId: r.id,
        status: r.status,
        serviceType: r.serviceType,
        customerName: nameOfBusiness(r.customer),
        driverName: nameOfUser(r.assignedDriver),
        pickupAddress: r.pickupAddress,
        dropoffAddress: r.dropoffAddress,
        pickupWindowStart: r.pickupWindowStart,
        dropoffWindowEnd: r.dropoffWindowEnd,
        urgent: r.isUrgent,
        opsConfirmationRequired: r.requiresOpsConfirmation,
        paymentStatus: r.payment?.status ?? "",
        payoutStatus: r.payout?.status ?? "",
      }));

    case "compliance":
      return rows.map((r) => ({
        deliveryId: r.deliveryId,
        deliveryStatus: r.delivery?.status ?? "",
        customerName: nameOfBusiness(r.delivery?.customer),
        driverName: nameOfUser(r.assignedDriver),
        vinConfirmed: r.vinConfirmed,
        vinCode: r.vinVerificationCode,
        odometerStart: r.odometerStart,
        odometerEnd: r.odometerEnd,
        pickupCompletedAt: r.pickupCompletedAt,
        dropoffCompletedAt: r.dropoffCompletedAt,
        pickupPhotoCount: r.pickupPhotoCount,
        dropoffPhotoCount: r.dropoffPhotoCount,
        drivenMiles: r.delivery?.trackingSession?.drivenMiles ?? 0,
        missingFlags: Array.isArray(r.missingFlags)
          ? r.missingFlags.join(", ")
          : "",
      }));

    case "disputes":
      return rows.map((r) => ({
        disputeId: r.id,
        deliveryId: r.deliveryId,
        status: r.status,
        legalHold: r.legalHold,
        customerName: nameOfBusiness(r.delivery?.customer),
        driverName: nameOfUser(r.assignedDriver),
        reason: r.reason,
        openedAt: r.openedAt,
        resolvedAt: r.resolvedAt,
        closedAt: r.closedAt,
        notesCount: r.notesCount ?? 0,
      }));

    case "payments":
      return rows.map((r) => ({
        paymentId: r.id,
        deliveryId: r.deliveryId,
        customerName: nameOfBusiness(r.delivery?.customer),
        driverName: nameOfUser(r.assignedDriver),
        amount: r.amount,
        paymentType: r.paymentType,
        status: r.status,
        authorizedAt: r.authorizedAt,
        capturedAt: r.capturedAt,
        paidAt: r.paidAt,
        failedAt: r.failedAt,
        refundedAt: r.refundedAt,
        provider: r.provider,
      }));

    case "payouts":
      return rows.map((r) => ({
        payoutId: r.id,
        deliveryId: r.deliveryId,
        driverName: nameOfUser(r.driver),
        customerName: nameOfBusiness(r.delivery?.customer),
        grossAmount: r.grossAmount,
        insuranceFee: r.insuranceFee,
        driverSharePct: r.driverSharePct,
        netAmount: r.netAmount,
        platformFee: r.platformFee,
        status: r.status,
        paidAt: r.paidAt,
      }));

    case "insurance-mileage":
      return rows.map((r) => ({
        trackingSessionId: r.id ?? null,
        deliveryId: r.deliveryId ?? r.delivery?.id ?? r.id ?? null,
        driverId: r.assignedDriver?.id ?? r.delivery?.assignments?.[0]?.driver?.id ?? null,
        driverName: nameOfUser(r.assignedDriver ?? r.delivery?.assignments?.[0]?.driver),
        driverEmail:
          r.assignedDriver?.user?.email ??
          r.delivery?.assignments?.[0]?.driver?.user?.email ??
          "",
        customerId: r.delivery?.customer?.id ?? null,
        customerName: nameOfBusiness(r.delivery?.customer),
        customerEmail: r.delivery?.customer?.user?.email ?? "",
        customerType: r.delivery?.customer?.customerType ?? "",
        serviceType: r.delivery?.serviceType ?? "",
        deliveryStatus: r.delivery?.status ?? "",
        trackingStatus: r.status ?? "",
        status: r.delivery?.status ?? r.status ?? "",
        drivenMiles: r.drivenMiles ?? 0,
        drivenHours: r.drivenHours ?? 0,
        startedAt: r.startedAt ?? null,
        stoppedAt: r.stoppedAt ?? null,
        period: r.period ?? "",
        pickupAddress: r.delivery?.pickupAddress ?? "",
        dropoffAddress: r.delivery?.dropoffAddress ?? "",
        paymentAmount: r.delivery?.payment?.amount ?? null,
        payoutAmount: r.delivery?.payout?.netAmount ?? null,
      }));

    default:
      return rows;
  }
}