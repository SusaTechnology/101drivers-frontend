import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AdminAuditLog as PrismaAdminAuditLog,
  Customer as PrismaCustomer,
  DeliveryAssignment as PrismaDeliveryAssignment,
  DeliveryCompliance as PrismaDeliveryCompliance,
  DeliveryEvidence as PrismaDeliveryEvidence,
  DeliveryRating as PrismaDeliveryRating,
  DeliveryRequest as PrismaDeliveryRequest,
  DeliveryStatusHistory as PrismaDeliveryStatusHistory,
  DisputeCase as PrismaDisputeCase,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EvidenceExport as PrismaEvidenceExport,
  NotificationEvent as PrismaNotificationEvent,
  Payment as PrismaPayment,
  DriverPayout as PrismaDriverPayout,
  Prisma,
  Quote as PrismaQuote,
  ScheduleChangeRequest as PrismaScheduleChangeRequest,
  Tip as PrismaTip,
  TrackingSession as PrismaTrackingSession,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DeliveryRequestServiceBase } from "./base/deliveryRequest.service.base";
import { DeliveryRequestDomain } from "../domain/deliveryRequest/deliveryRequest.domain";
import { DeliveryRequestPolicyService } from "../domain/deliveryRequest/deliveryRequestPolicy.service";

import {
  CreateDeliveryFromQuoteInput,
  CreateDeliveryDraftFromQuoteInput,
  CreateIndividualDeliveryFromQuoteInput,
  CreateIndividualDeliveryDraftFromQuoteInput,
  CreateIndividualDeliveryFromQuoteResult,
  CreateQuotePreviewInput,
  DeliveryRequestOrchestratorService,
  SchedulePreviewInput,
  SchedulePreviewResult,

} from "../delivery-logistics/delivery-request-orchestrator.service";
import { DeliveryLifecycleService } from "../delivery-logistics/delivery-lifecycle.service";

import {
  DriverFeedItem,
  DriverJobFeedResult,
  DriverJobFeedService,
} from "../delivery-logistics/driver-job-feed.service";

import { DeliveryComplianceEngine } from "../domain/deliveryCompliance/deliveryCompliance.engine";
import { DeliveryCancellationEngine } from "../domain/deliveryRequest/deliveryCancellation.engine";
import { AdminDeliveryEngine } from "../domain/deliveryRequest/adminDelivery.engine";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";
import { stripEmptyObjectsDeep } from "../domain/common/policy/utils/stripEmptyObjectsDeep.util";
import { SchedulePreviewBody, SchedulePreviewResponseBody } from "./dto/deliveryRequestLogistics.dto";
import { SchedulingPolicyEngine } from "src/domain/schedulingPolicy/schedulingPolicy.engine";

@Injectable()
export class DeliveryRequestService extends DeliveryRequestServiceBase {
constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: DeliveryRequestDomain,
  private readonly policy: DeliveryRequestPolicyService,
  private readonly orchestrator: DeliveryRequestOrchestratorService,
  private readonly driverJobFeedService: DriverJobFeedService,
  private readonly lifecycleService: DeliveryLifecycleService,
  private readonly deliveryComplianceEngine: DeliveryComplianceEngine,
  private readonly deliveryCancellationEngine: DeliveryCancellationEngine,
  private readonly adminDeliveryEngine: AdminDeliveryEngine,
  private readonly paymentPayoutEngine: PaymentPayoutEngine,
  private readonly schedulingPolicyEngine: SchedulingPolicyEngine


) {
  super(prisma);
}
  async count(
    args: Omit<Prisma.DeliveryRequestCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.deliveryRequest.count(args);
  }

  async deliveryRequests(
    args: Prisma.DeliveryRequestFindManyArgs
  ): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async deliveryRequest(
    args: Prisma.DeliveryRequestFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

async createDeliveryRequest(
  args: Prisma.DeliveryRequestCreateArgs
): Promise<any> {
  const normalizedData = stripEmptyObjectsDeep(
    this.normalizeCreateData(args.data)
  ) as Prisma.DeliveryRequestCreateArgs["data"];

  await this.policy.beforeCreate(this.prisma as any, normalizedData);

  const created = await this.prisma.deliveryRequest.create({
    ...args,
    data: normalizedData,
  });

  return this.domain.findUnique({ id: created.id });
}

async updateDeliveryRequest(
  args: Prisma.DeliveryRequestUpdateArgs
): Promise<any> {
  const normalizedData = stripEmptyObjectsDeep(
    this.normalizeUpdateData(args.data)
  ) as Prisma.DeliveryRequestUpdateArgs["data"];

  await this.policy.beforeUpdate(
    this.prisma as any,
    (args.where as any)?.id,
    normalizedData
  );

  const updated = await this.prisma.deliveryRequest.update({
    ...args,
    data: normalizedData,
  });

  return this.domain.findUnique({ id: updated.id });
}

  async deleteDeliveryRequest(
    args: Prisma.DeliveryRequestDeleteArgs
  ): Promise<PrismaDeliveryRequest> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.deliveryRequest.delete(args);
  }

async createQuotePreview(input: CreateQuotePreviewInput): Promise<any> {
  return this.orchestrator.createQuotePreview({
    pickupAddress: this.trimRequiredString(input.pickupAddress),
    dropoffAddress: this.trimRequiredString(input.dropoffAddress),
    serviceType: input.serviceType,
    customerId: input.customerId ?? null,
  });
}



  async createDeliveryFromAcceptedQuote(
    input: CreateDeliveryFromQuoteInput
  ): Promise<any> {
    const created = await this.orchestrator.createDeliveryFromAcceptedQuote({
      ...input,
      licensePlate: this.trimRequiredString(input.licensePlate),
      vehicleColor: this.trimRequiredString(input.vehicleColor),
      vehicleMake: this.trimOptionalString(input.vehicleMake) ?? null,
      vehicleModel: this.trimOptionalString(input.vehicleModel) ?? null,
      vinVerificationCode: this.trimRequiredString(input.vinVerificationCode),
      recipientName: this.trimOptionalString(input.recipientName) ?? null,
      recipientEmail: this.normalizeOptionalEmail(input.recipientEmail) ?? null,
      recipientPhone: this.trimOptionalString(input.recipientPhone) ?? null,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async createIndividualDeliveryFromAcceptedQuote(
    input: CreateIndividualDeliveryFromQuoteInput
  ): Promise<CreateIndividualDeliveryFromQuoteResult> {
    const result =
      await this.orchestrator.createIndividualDeliveryFromAcceptedQuote({
        customerId: input.customerId ?? null,
        customerEmail: this.normalizeOptionalEmail(input.customerEmail) ?? null,
        customerName: this.trimOptionalString(input.customerName) ?? null,
        customerPhone: this.trimOptionalString(input.customerPhone) ?? null,
        otp:
          this.trimOptionalString(input.otp) ?? null,
        password: input.password ?? null,

        quoteId: input.quoteId,
        serviceType: input.serviceType,

        savedVehicleId: input.savedVehicleId ?? null,
        saveVehicleForFuture: input.saveVehicleForFuture === true,

        pickupWindowStart: input.pickupWindowStart ?? null,
        pickupWindowEnd: input.pickupWindowEnd ?? null,
        dropoffWindowStart: input.dropoffWindowStart ?? null,
        dropoffWindowEnd: input.dropoffWindowEnd ?? null,

        licensePlate: this.trimRequiredString(input.licensePlate),
        vehicleColor: this.trimRequiredString(input.vehicleColor),
        vehicleMake: this.trimOptionalString(input.vehicleMake) ?? null,
        vehicleModel: this.trimOptionalString(input.vehicleModel) ?? null,
        vinVerificationCode: this.trimRequiredString(input.vinVerificationCode),

        recipientName: this.trimOptionalString(input.recipientName) ?? null,
        recipientEmail:
          this.normalizeOptionalEmail(input.recipientEmail) ?? null,
        recipientPhone: this.trimOptionalString(input.recipientPhone) ?? null,

        afterHours: input.afterHours === true,
        isUrgent: input.isUrgent === true,
      });

    if (result.action !== "CREATED") {
      return result;
    }

    const delivery = await this.domain.findUnique({ id: result.deliveryId });

    return {
      action: "CREATED",
      deliveryId: result.deliveryId,
      delivery,
    };
  }

async getDriverJobFeed(input: {
  driverId: string;
  limit?: number;
  cursor?: string | null;
  urgentOnly?: boolean;
  serviceType?: string | null;
  search?: string | null;
  radiusMiles?: number | null;
  datePreset?: "ALL" | "TODAY" | "TOMORROW" | null;
  sortBy?: "BEST_MATCH" | "SOONEST" | "NEAREST" | "NEWEST" | null;
}): Promise<DriverJobFeedResult> {
  return this.driverJobFeedService.getDriverJobFeed({
    driverId: input.driverId,
    limit: input.limit,
    cursor: input.cursor ?? null,
    urgentOnly: input.urgentOnly === true,
    serviceType: this.trimOptionalString(input.serviceType) ?? null,
    search: this.trimOptionalString(input.search) ?? null,
    radiusMiles:
      typeof input.radiusMiles === "number" ? input.radiusMiles : null,
    datePreset: input.datePreset ?? "ALL",
    sortBy: input.sortBy ?? "BEST_MATCH",
  });
}

async getDriverJobDetail(input: {
  driverId: string;
  deliveryId: string;
}): Promise<DriverFeedItem | null> {
  return this.driverJobFeedService.getDriverJobDetail({
    driverId: input.driverId,
    deliveryId: input.deliveryId,
  });
}

async getDriverActiveDelivery(driverId: string): Promise<any> {
  return this.driverJobFeedService.getActiveDeliveryForDriver(driverId);
}

  async bookDelivery(input: {
    deliveryId: string;
    driverId: string;
    bookedByUserId?: string | null;
    reason?: string | null;
  }): Promise<any> {
    await this.lifecycleService.bookDelivery({
      deliveryId: input.deliveryId,
      driverId: input.driverId,
      bookedByUserId: input.bookedByUserId ?? null,
      reason: this.trimOptionalString(input.reason) ?? null,
    });

    return this.domain.findUnique({ id: input.deliveryId });
  }

  async transitionDeliveryStatus(input: {
    deliveryId: string;
    toStatus: EnumDeliveryRequestStatus;
    actorUserId?: string | null;
    actorRole?: EnumDeliveryStatusHistoryActorRole | null;
    actorType?: EnumDeliveryStatusHistoryActorType;
    note?: string | null;
  }): Promise<any> {
    await this.lifecycleService.transitionStatus(
      input.deliveryId,
      input.toStatus,
      {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        actorType: input.actorType ?? EnumDeliveryStatusHistoryActorType.USER,
        note: this.trimOptionalString(input.note) ?? null,
      }
    );

    return this.domain.findUnique({ id: input.deliveryId });
  }
async startTrip(input: {
  deliveryId: string;
  driverId: string;
  actorUserId?: string | null;
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
}): Promise<any> {
  await this.lifecycleService.startTrip({
    deliveryId: input.deliveryId,
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async completeTrip(input: {
  deliveryId: string;
  driverId: string;
  actorUserId?: string | null;
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
}): Promise<any> {
  await this.lifecycleService.completeTrip({
    deliveryId: input.deliveryId,
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

  async findAssignments(
    parentId: string,
    args: Prisma.DeliveryAssignmentFindManyArgs
  ): Promise<PrismaDeliveryAssignment[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .assignments(args);
  }

  async findAudits(
    parentId: string,
    args: Prisma.AdminAuditLogFindManyArgs
  ): Promise<PrismaAdminAuditLog[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .audits(args);
  }

  async findEvidence(
    parentId: string,
    args: Prisma.DeliveryEvidenceFindManyArgs
  ): Promise<PrismaDeliveryEvidence[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .evidence(args);
  }

  async findEvidenceExports(
    parentId: string,
    args: Prisma.EvidenceExportFindManyArgs
  ): Promise<PrismaEvidenceExport[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .evidenceExports(args);
  }

  async findNotifications(
    parentId: string,
    args: Prisma.NotificationEventFindManyArgs
  ): Promise<PrismaNotificationEvent[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .notifications(args);
  }

  async findResubmissions(
    parentId: string,
    args: Prisma.DeliveryRequestFindManyArgs
  ): Promise<PrismaDeliveryRequest[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .resubmissions(args);
  }

  async findScheduleChanges(
    parentId: string,
    args: Prisma.ScheduleChangeRequestFindManyArgs
  ): Promise<PrismaScheduleChangeRequest[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .scheduleChanges(args);
  }

  async findStatusHistory(
    parentId: string,
    args: Prisma.DeliveryStatusHistoryFindManyArgs
  ): Promise<PrismaDeliveryStatusHistory[]> {
    return this.prisma.deliveryRequest
      .findUniqueOrThrow({ where: { id: parentId } })
      .statusHistory(args);
  }

  async getCompliance(parentId: string): Promise<PrismaDeliveryCompliance | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .compliance();
  }

  async getCreatedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .createdBy();
  }

  async getCustomer(parentId: string): Promise<PrismaCustomer | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .customer();
  }

  async getDispute(parentId: string): Promise<PrismaDisputeCase | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .dispute();
  }

  async getPayment(parentId: string): Promise<PrismaPayment | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .payment();
  }

  async getPayout(parentId: string): Promise<PrismaDriverPayout | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .payout();
  }

  async getQuote(parentId: string): Promise<PrismaQuote | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .quote();
  }

  async getRating(parentId: string): Promise<PrismaDeliveryRating | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .rating();
  }

  async getResubmittedFrom(
    parentId: string
  ): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .resubmittedFrom();
  }

  async getTip(parentId: string): Promise<PrismaTip | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .tip();
  }

  async getTrackingSession(parentId: string): Promise<PrismaTrackingSession | null> {
    return this.prisma.deliveryRequest
      .findUnique({ where: { id: parentId } })
      .trackingSession();
  }

  private normalizeCreateData(
    data: Prisma.DeliveryRequestCreateArgs["data"]
  ): Prisma.DeliveryRequestCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.pickupAddress = this.trimRequiredString(normalized.pickupAddress);
    normalized.dropoffAddress = this.trimRequiredString(
      normalized.dropoffAddress
    );
    normalized.licensePlate = this.trimRequiredString(normalized.licensePlate);
    normalized.vehicleColor = this.trimRequiredString(normalized.vehicleColor);
    normalized.vinVerificationCode = this.trimRequiredString(
      normalized.vinVerificationCode
    );

    normalized.pickupPlaceId = this.trimOptionalString(normalized.pickupPlaceId);
    normalized.dropoffPlaceId = this.trimOptionalString(
      normalized.dropoffPlaceId
    );
    normalized.pickupState = this.normalizeOptionalState(normalized.pickupState);
    normalized.dropoffState = this.normalizeOptionalState(
      normalized.dropoffState
    );

    normalized.vehicleMake = this.trimOptionalString(normalized.vehicleMake);
    normalized.vehicleModel = this.trimOptionalString(normalized.vehicleModel);

    normalized.recipientName = this.trimOptionalString(normalized.recipientName);
    normalized.recipientEmail = this.normalizeOptionalEmail(
      normalized.recipientEmail
    );
    normalized.recipientPhone = this.trimOptionalString(
      normalized.recipientPhone
    );

    normalized.trackingShareToken = this.trimOptionalString(
      normalized.trackingShareToken
    );

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DeliveryRequestUpdateArgs["data"]
  ): Prisma.DeliveryRequestUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "pickupAddress", false);
    this.normalizeUpdateStringField(normalized, "dropoffAddress", false);
    this.normalizeUpdateStringField(normalized, "licensePlate", false);
    this.normalizeUpdateStringField(normalized, "vehicleColor", false);
    this.normalizeUpdateStringField(normalized, "vinVerificationCode", false);

    this.normalizeUpdateStringField(normalized, "pickupPlaceId", true);
    this.normalizeUpdateStringField(normalized, "dropoffPlaceId", true);
    this.normalizeUpdateStateField(normalized, "pickupState");
    this.normalizeUpdateStateField(normalized, "dropoffState");

    this.normalizeUpdateStringField(normalized, "vehicleMake", true);
    this.normalizeUpdateStringField(normalized, "vehicleModel", true);

    this.normalizeUpdateStringField(normalized, "recipientName", true);
    this.normalizeUpdateEmailField(normalized, "recipientEmail");
    this.normalizeUpdateStringField(normalized, "recipientPhone", true);

    this.normalizeUpdateStringField(normalized, "trackingShareToken", true);

    return normalized;
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }

    return value.trim();
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeOptionalEmail(value: unknown): string | null | undefined {
    const trimmed = this.trimOptionalString(value);
    if (typeof trimmed !== "string") {
      return trimmed as any;
    }

    return trimmed.toLowerCase();
  }

  private normalizeOptionalState(value: unknown): string | null | undefined {
    const stripped = this.trimOptionalString(value);
    if (typeof stripped !== "string") {
      return stripped as any;
    }

    return stripped.toUpperCase();
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string,
    allowNull: boolean
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: allowNull
          ? this.trimOptionalString(raw.set)
          : this.trimRequiredString(raw.set),
      };
      return;
    }

    target[field] = allowNull
      ? this.trimOptionalString(raw)
      : this.trimRequiredString(raw);
  }

  private normalizeUpdateEmailField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: this.normalizeOptionalEmail(raw.set),
      };
      return;
    }

    target[field] = this.normalizeOptionalEmail(raw);
  }

  private normalizeUpdateStateField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: this.normalizeOptionalState(raw.set),
      };
      return;
    }

    target[field] = this.normalizeOptionalState(raw);
  }
async submitPickupCompliance(input: {
  deliveryId: string;
  driverId: string;
  vinVerificationCode: string;
  odometerStart: number;
  photos: Array<{
    slotIndex: number;
    imageUrl: string;
  }>;
}): Promise<any> {
  await this.deliveryComplianceEngine.submitPickupCompliance({
    deliveryId: input.deliveryId,
    driverId: input.driverId,
    vinVerificationCode: this.trimRequiredString(input.vinVerificationCode),
    odometerStart: Number(input.odometerStart),
    photos: (input.photos ?? []).map((photo) => ({
      slotIndex: Number(photo.slotIndex),
      imageUrl: this.trimRequiredString(photo.imageUrl),
    })),
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async submitDropoffCompliance(input: {
  deliveryId: string;
  driverId: string;
  odometerEnd: number;
  photos: Array<{
    slotIndex: number;
    imageUrl: string;
  }>;
}): Promise<any> {
  await this.deliveryComplianceEngine.submitDropoffCompliance({
    deliveryId: input.deliveryId,
    driverId: input.driverId,
    odometerEnd: Number(input.odometerEnd),
    photos: (input.photos ?? []).map((photo) => ({
      slotIndex: Number(photo.slotIndex),
      imageUrl: this.trimRequiredString(photo.imageUrl),
    })),
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async getDriverWorkflowSummary(input: {
  deliveryId: string;
  driverId: string;
}): Promise<any> {
  return this.deliveryComplianceEngine.getDriverWorkflowSummary(
    input.deliveryId,
    input.driverId
  );
}
// async schedulePreview(input: SchedulePreviewInput): Promise<SchedulePreviewResult> {
//   return this.orchestrator.schedulePreview({
//     quoteId: input.quoteId,
//     serviceType: input.serviceType,
//     customerId: input.customerId ?? null,
//     customerChose: input.customerChose ?? null,
//     pickupWindowStart: input.pickupWindowStart ?? null,
//     pickupWindowEnd: input.pickupWindowEnd ?? null,
//     dropoffWindowStart: input.dropoffWindowStart ?? null,
//     dropoffWindowEnd: input.dropoffWindowEnd ?? null,
//   });
// }
async schedulePreview(
  input: SchedulePreviewBody
): Promise<SchedulePreviewResponseBody> {
   console.log("input in the service", input)
  return this.schedulingPolicyEngine.previewDeliverySchedule({
    quoteId: input.quoteId,
    serviceType: input.serviceType,
    customerId: input.customerId ?? null,
    customerType: input.customerType ?? null,
    customerChose: input.customerChose,
    pickupWindowStart: input.pickupWindowStart ?? null,
    pickupWindowEnd: input.pickupWindowEnd ?? null,
    dropoffWindowStart: input.dropoffWindowStart ?? null,
    dropoffWindowEnd: input.dropoffWindowEnd ?? null,
    afterHoursRequested: input.afterHoursRequested ?? false,
    preferredDate: input.preferredDate ?? null,
  });

}
async cancelDelivery(input: {
  deliveryId: string;
  actorUserId?: string | null;
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
  note?: string | null;
}): Promise<any> {
  await this.deliveryCancellationEngine.cancelDelivery({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}
async adminCancelDelivery(input: {
  deliveryId: string;
  actorUserId?: string | null;
  reason: string;
}): Promise<any> {
  await this.adminDeliveryEngine.cancelDelivery({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async adminReassignDelivery(input: {
  deliveryId: string;
  newDriverId: string;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<any> {
  await this.adminDeliveryEngine.reassignDelivery({
    deliveryId: input.deliveryId,
    newDriverId: input.newDriverId,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason ?? null,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async getDeliveryFinancialSummary(input: {
  deliveryId: string;
}): Promise<any> {
  return this.paymentPayoutEngine.getDeliveryFinancialSummary(
    input.deliveryId
  );
}

async adminInvoicePostpaid(input: {
  deliveryId: string;
  actorUserId?: string | null;
  invoiceId?: string | null;
  note?: string | null;
}): Promise<any> {
  await this.paymentPayoutEngine.adminInvoicePostpaid({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    invoiceId: this.trimOptionalString(input.invoiceId) ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async adminMarkPostpaidPaid(input: {
  deliveryId: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<any> {
  await this.paymentPayoutEngine.adminMarkPostpaidPaid({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async adminMarkPayoutPaid(input: {
  deliveryId: string;
  actorUserId?: string | null;
  providerTransferId?: string | null;
  note?: string | null;
}): Promise<any> {
  await this.paymentPayoutEngine.adminMarkPayoutPaid({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    providerTransferId:
      this.trimOptionalString(input.providerTransferId) ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: input.deliveryId });
}

async ingestDriverLocation(input: {
  userId: string;
  lat: number;
  lng: number;
  recordedAt?: Date;
}): Promise<any> {
  return this.lifecycleService.ingestDriverLocation({
    userId: input.userId,
    lat: input.lat,
    lng: input.lng,
    recordedAt: input.recordedAt ?? new Date(),
  });
}

async createTrackingLink(input: {
  deliveryId: string;
  expiresInHours?: number;
}): Promise<any> {
  return this.lifecycleService.createTrackingLink({
    deliveryId: input.deliveryId,
    expiresInHours: input.expiresInHours ?? 24,
  });
}

async getTrackingLink(input: {
  deliveryId: string;
}): Promise<any> {
  return this.lifecycleService.getTrackingLink({
    deliveryId: input.deliveryId,
  });
}

async getPublicTracking(input: {
  token: string;
}): Promise<any> {
  return this.lifecycleService.getPublicTracking({
    token: this.trimRequiredString(input.token),
  });
}

async getAdminDeliveries(input: {
  status?: string | null;
  from?: Date | null;
  to?: Date | null;
  customerId?: string | null;
  customerType?: string | null;
  serviceType?: string | null;
  urgentOnly?: boolean;
  disputedOnly?: boolean;
  requiresOpsConfirmation?: boolean;
  withoutAssignment?: boolean;
  complianceMissing?: boolean;
  activeWithoutTracking?: boolean;
  staleTracking?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<any> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 20, 100));
  const skip = (page - 1) * pageSize;

  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000);

  const where: Prisma.DeliveryRequestWhereInput = {
    ...(input.status ? { status: input.status as any } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.customerType
      ? { customer: { customerType: input.customerType as any } }
      : {}),
    ...(input.serviceType ? { serviceType: input.serviceType as any } : {}),
    ...(input.urgentOnly === true ? { isUrgent: true } : {}),
    ...(input.disputedOnly === true
      ? {
          OR: [
            { status: EnumDeliveryRequestStatus.DISPUTED },
            { dispute: { isNot: null } },
          ],
        }
      : {}),
    ...(input.requiresOpsConfirmation === true
      ? { requiresOpsConfirmation: true }
      : {}),
    ...(input.withoutAssignment === true
      ? {
          assignments: {
            none: {
              unassignedAt: null,
            },
          },
        }
      : {}),
    ...(input.complianceMissing === true
      ? {
          OR: [
            { compliance: null },
            { compliance: { vinConfirmed: false } },
            { compliance: { pickupCompletedAt: null } },
            { compliance: { dropoffCompletedAt: null } },
          ],
        }
      : {}),
    ...(input.activeWithoutTracking === true
      ? {
          status: EnumDeliveryRequestStatus.ACTIVE,
          OR: [
            { trackingSession: null },
            { trackingSession: { status: { not: "STARTED" as any } } },
          ],
        }
      : {}),
    ...(input.staleTracking === true
      ? {
          status: EnumDeliveryRequestStatus.ACTIVE,
          trackingSession: {
            is: {
              points: {
                none: {
                  recordedAt: {
                    gte: staleCutoff,
                  },
                },
              },
            },
          },
        }
      : {}),
    ...((input.from || input.to)
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
  };

  const [count, items] = await Promise.all([
    this.prisma.deliveryRequest.count({ where }),
    this.domain.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        serviceType: true,
        createdAt: true,
        updatedAt: true,

        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,

        etaMinutes: true,
        bufferMinutes: true,
        afterHours: true,
        isUrgent: true,
        sameDayEligible: true,
        requiresOpsConfirmation: true,

        customer: {
          select: {
            id: true,
            customerType: true,
            businessName: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            approvalStatus: true,
          },
        },

        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            id: true,
            assignedAt: true,
            driverId: true,
            driver: {
              select: {
                id: true,
                phone: true,
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
            },
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
          },
        },

        payment: {
          select: {
            id: true,
            amount: true,
            paymentType: true,
            provider: true,
            status: true,
            invoiceId: true,
            authorizedAt: true,
            capturedAt: true,
            paidAt: true,
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
              orderBy: { recordedAt: "desc" },
              take: 1,
              select: {
                id: true,
                lat: true,
                lng: true,
                recordedAt: true,
              },
            },
          },
        },

        _count: {
          select: {
            statusHistory: true,
            evidence: true,
            audits: true,
            notifications: true,
          },
        },
      },
    }),
  ]);

  return {
    items: items.map((row: any) => {
      const activeAssignment = row.assignments?.[0] ?? null;
      const latestTrackingPoint = row.trackingSession?.points?.[0] ?? null;

      return {
        id: row.id,
        status: row.status,
        serviceType: row.serviceType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,

        customer: row.customer,
        pickup: {
          address: row.pickupAddress,
          windowStart: row.pickupWindowStart,
          windowEnd: row.pickupWindowEnd,
        },
        dropoff: {
          address: row.dropoffAddress,
          windowStart: row.dropoffWindowStart,
          windowEnd: row.dropoffWindowEnd,
        },

        scheduling: {
          etaMinutes: row.etaMinutes,
          bufferMinutes: row.bufferMinutes,
          sameDayEligible: row.sameDayEligible,
          requiresOpsConfirmation: row.requiresOpsConfirmation,
          afterHours: row.afterHours,
          isUrgent: row.isUrgent,
        },

        activeAssignment,
        compliance: row.compliance,
        dispute: row.dispute,
        payment: row.payment,
        payout: row.payout,

        tracking: {
          sessionId: row.trackingSession?.id ?? null,
          status: row.trackingSession?.status ?? null,
          startedAt: row.trackingSession?.startedAt ?? null,
          stoppedAt: row.trackingSession?.stoppedAt ?? null,
          drivenMiles: row.trackingSession?.drivenMiles ?? null,
          latestPoint: latestTrackingPoint,
          stale:
            row.status === EnumDeliveryRequestStatus.ACTIVE &&
            (!latestTrackingPoint ||
              new Date(latestTrackingPoint.recordedAt).getTime() <
                staleCutoff.getTime()),
        },

        counts: row._count,
      };
    }),
    count,
    page,
    pageSize,
    filtersApplied: {
      status: input.status ?? null,
      from: input.from ?? null,
      to: input.to ?? null,
      customerId: input.customerId ?? null,
      customerType: input.customerType ?? null,
      serviceType: input.serviceType ?? null,
      urgentOnly: input.urgentOnly === true,
      disputedOnly: input.disputedOnly === true,
      requiresOpsConfirmation: input.requiresOpsConfirmation === true,
      withoutAssignment: input.withoutAssignment === true,
      complianceMissing: input.complianceMissing === true,
      activeWithoutTracking: input.activeWithoutTracking === true,
      staleTracking: input.staleTracking === true,
    },
  };
}

async getAdminDeliveryDetail(input: {
  deliveryId: string;
}): Promise<any> {
  const delivery = await this.domain.findUnique(
    { id: input.deliveryId },
    {
      id: true,
      status: true,
      serviceType: true,
      createdAt: true,
      updatedAt: true,
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
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              isActive: true,
              emailVerifiedAt: true,
            },
          },
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
        },
      },

      quote: {
        select: {
          id: true,
          serviceType: true,
          pricingMode: true,
          mileageCategory: true,
          pickupAddress: true,
          dropoffAddress: true,
          distanceMiles: true,
          estimatedPrice: true,
          feesBreakdown: true,
          pricingSnapshot: true,
          routePolyline: true,
          createdAt: true,
        },
      },

      payment: {
        select: {
          id: true,
          amount: true,
          paymentType: true,
          provider: true,
          status: true,
          invoiceId: true,
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

      assignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          id: true,
          driverId: true,
          assignedAt: true,
          unassignedAt: true,
          reason: true,
          assignedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
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
                  email: true,
                  phone: true,
                },
              },
            },
          },
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
          points: {
            orderBy: { recordedAt: "desc" },
            take: 50,
            select: {
              id: true,
              lat: true,
              lng: true,
              recordedAt: true,
            },
          },
        },
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
    }
  );

  if (!delivery) {
    throw new NotFoundException("Delivery request not found");
  }

  const [statusHistory, audits, notifications, financialSummary] =
    await Promise.all([
      this.prisma.deliveryStatusHistory.findMany({
        where: { deliveryId: input.deliveryId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.adminAuditLog.findMany({
        where: { deliveryId: input.deliveryId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notificationEvent.findMany({
        where: { deliveryId: input.deliveryId },
        orderBy: { createdAt: "desc" },
      }),
      this.paymentPayoutEngine.getDeliveryFinancialSummary(input.deliveryId),
    ]);

  return {
    ...delivery,
    activeAssignment:
      delivery.assignments?.find((a: any) => !a.unassignedAt) ?? null,
    statusHistory,
    audits,
    notifications,
    financialSummary,
  };
}
async adminAssignDriver(input: {
  deliveryId: string;
  driverId: string;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<any> {
  await this.adminDeliveryEngine.assignDriver({
    deliveryId: input.deliveryId,
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    reason: this.trimOptionalString(input.reason) ?? null,
  });

  return this.getAdminDeliveryDetail({
    deliveryId: input.deliveryId,
  });
}

async adminReassignDeliveryV2(input: {
  deliveryId: string;
  newDriverId: string;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<any> {
  await this.adminDeliveryEngine.reassignDelivery({
    deliveryId: input.deliveryId,
    newDriverId: input.newDriverId,
    actorUserId: input.actorUserId ?? null,
    reason: this.trimOptionalString(input.reason) ?? null,
  });

  return this.getAdminDeliveryDetail({
    deliveryId: input.deliveryId,
  });
}
async adminForceCancelDelivery(input: {
  deliveryId: string;
  actorUserId?: string | null;
  reason: string;
}): Promise<any> {
  await this.adminDeliveryEngine.forceCancelDelivery({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    reason: this.trimRequiredString(input.reason),
  });

  return this.getAdminDeliveryDetail({
    deliveryId: input.deliveryId,
  });
}

async adminOpenDispute(input: {
  deliveryId: string;
  actorUserId?: string | null;
  reason: string;
  note?: string | null;
  legalHold?: boolean;
}): Promise<any> {
  await this.adminDeliveryEngine.openDispute({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    reason: this.trimRequiredString(input.reason),
    note: this.trimOptionalString(input.note) ?? null,
    legalHold: input.legalHold === true,
  });

  return this.getAdminDeliveryDetail({
    deliveryId: input.deliveryId,
  });
}

async adminSetLegalHold(input: {
  deliveryId: string;
  actorUserId?: string | null;
  legalHold: boolean;
  note?: string | null;
}): Promise<any> {
  await this.adminDeliveryEngine.setLegalHold({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    legalHold: input.legalHold === true,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.getAdminDeliveryDetail({
    deliveryId: input.deliveryId,
  });
}
async adminApproveCompliance(input: {
  deliveryId: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<any> {
  await this.adminDeliveryEngine.approveCompliance({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.getAdminDeliveryDetail({
    deliveryId: input.deliveryId,
  });
}
async deliveryRequestLookupList(): Promise<
  { id: string; label: string | null; status: EnumDeliveryRequestStatus }[]
> {
  const rows = await this.prisma.deliveryRequest.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      licensePlate: true,
      vehicleMake: true,
      vehicleModel: true,
      pickupAddress: true,
      dropoffAddress: true,
      recipientName: true,
    },
  });

  return rows.map((row) => {
    const vehicle =
      [row.vehicleMake, row.vehicleModel].filter(Boolean).join(" ") ||
      row.licensePlate ||
      null;

    const route =
      row.pickupAddress && row.dropoffAddress
        ? `${row.pickupAddress} → ${row.dropoffAddress}`
        : row.pickupAddress || row.dropoffAddress || null;

    const label =
      vehicle && route
        ? `${vehicle} • ${route}`
        : vehicle || route || row.recipientName || row.id;

    return {
      id: row.id,
      label,
      status: row.status,
    };
  });
}
async createDeliveryDraftFromQuote(
  input: CreateDeliveryDraftFromQuoteInput
): Promise<any> {
  const created = await this.orchestrator.createDeliveryDraftFromQuote({
    ...input,
    licensePlate: this.trimOptionalString(input.licensePlate) ?? null,
    vehicleColor: this.trimOptionalString(input.vehicleColor) ?? null,
    vehicleMake: this.trimOptionalString(input.vehicleMake) ?? null,
    vehicleModel: this.trimOptionalString(input.vehicleModel) ?? null,
    vinVerificationCode: this.trimOptionalString(input.vinVerificationCode) ?? null,
    recipientName: this.trimOptionalString(input.recipientName) ?? null,
    recipientEmail: this.normalizeOptionalEmail(input.recipientEmail) ?? null, 
    recipientPhone: this.trimOptionalString(input.recipientPhone) ?? null,
  });

  return this.domain.findUnique({ id: created.id });
}

async createIndividualDeliveryDraftFromQuote(
  input: CreateIndividualDeliveryDraftFromQuoteInput
): Promise<any> {
  const result =
    await this.orchestrator.createIndividualDeliveryDraftFromQuote({
      customerId: input.customerId ?? null,
      customerEmail: this.normalizeOptionalEmail(input.customerEmail) ?? null,
      customerName: this.trimOptionalString(input.customerName) ?? null,
      customerPhone: this.trimOptionalString(input.customerPhone) ?? null,

      quoteId: input.quoteId,
      serviceType: input.serviceType,

      savedVehicleId: input.savedVehicleId ?? null,
      saveVehicleForFuture: input.saveVehicleForFuture === true,

      pickupWindowStart: input.pickupWindowStart ?? null,
      pickupWindowEnd: input.pickupWindowEnd ?? null,
      dropoffWindowStart: input.dropoffWindowStart ?? null,
      dropoffWindowEnd: input.dropoffWindowEnd ?? null,

      licensePlate: this.trimOptionalString(input.licensePlate) ?? null,
      vehicleColor: this.trimOptionalString(input.vehicleColor) ?? null,
      vehicleMake: this.trimOptionalString(input.vehicleMake) ?? null,
      vehicleModel: this.trimOptionalString(input.vehicleModel) ?? null,
      vinVerificationCode: this.trimOptionalString(input.vinVerificationCode) ?? null,

      recipientName: this.trimOptionalString(input.recipientName) ?? null,
      recipientEmail:
        this.normalizeOptionalEmail(input.recipientEmail) ?? null,
      recipientPhone: this.trimOptionalString(input.recipientPhone) ?? null,

      afterHours: input.afterHours === true,
      isUrgent: input.isUrgent === true,
    });

  return this.domain.findUnique({ id: result.id });
}
}