import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DeliveryRequestService } from "./deliveryRequest.service";
import { DeliveryRequestControllerBase } from "./base/deliveryRequest.controller.base";
import { QuoteUsageLimitService } from "./quote-usage-limit.service";
import { isRecordNotFoundError } from "../prisma.util";
import { EnumDeliveryRequestCreatedByRole } from "./base/EnumDeliveryRequestCreatedByRole";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { DeliveryRequestCreateInput } from "./base/DeliveryRequestCreateInput";
import { DeliveryRequest } from "./base/DeliveryRequest";
import { DeliveryRequestFindManyArgs } from "./base/DeliveryRequestFindManyArgs";
import { DeliveryRequestWhereUniqueInput } from "./base/DeliveryRequestWhereUniqueInput";
import { DeliveryRequestUpdateInput } from "./base/DeliveryRequestUpdateInput";
import { DeliveryAssignmentFindManyArgs } from "../deliveryAssignment/base/DeliveryAssignmentFindManyArgs";
import { DeliveryAssignment } from "../deliveryAssignment/base/DeliveryAssignment";
import { DeliveryAssignmentWhereUniqueInput } from "../deliveryAssignment/base/DeliveryAssignmentWhereUniqueInput";
import { AdminAuditLogFindManyArgs } from "../adminAuditLog/base/AdminAuditLogFindManyArgs";
import { AdminAuditLog } from "../adminAuditLog/base/AdminAuditLog";
import { AdminAuditLogWhereUniqueInput } from "../adminAuditLog/base/AdminAuditLogWhereUniqueInput";
import { DeliveryEvidenceFindManyArgs } from "../deliveryEvidence/base/DeliveryEvidenceFindManyArgs";
import { DeliveryEvidence } from "../deliveryEvidence/base/DeliveryEvidence";
import { DeliveryEvidenceWhereUniqueInput } from "../deliveryEvidence/base/DeliveryEvidenceWhereUniqueInput";
import { EvidenceExportFindManyArgs } from "../evidenceExport/base/EvidenceExportFindManyArgs";
import { EvidenceExport } from "../evidenceExport/base/EvidenceExport";
import { EvidenceExportWhereUniqueInput } from "../evidenceExport/base/EvidenceExportWhereUniqueInput";
import { NotificationEventFindManyArgs } from "../notificationEvent/base/NotificationEventFindManyArgs";
import { NotificationEvent } from "../notificationEvent/base/NotificationEvent";
import { NotificationEventWhereUniqueInput } from "../notificationEvent/base/NotificationEventWhereUniqueInput";
import { ScheduleChangeRequestFindManyArgs } from "../scheduleChangeRequest/base/ScheduleChangeRequestFindManyArgs";
import { ScheduleChangeRequest } from "../scheduleChangeRequest/base/ScheduleChangeRequest";
import { ScheduleChangeRequestWhereUniqueInput } from "../scheduleChangeRequest/base/ScheduleChangeRequestWhereUniqueInput";
import { DeliveryStatusHistoryFindManyArgs } from "../deliveryStatusHistory/base/DeliveryStatusHistoryFindManyArgs";
import { DeliveryStatusHistory } from "../deliveryStatusHistory/base/DeliveryStatusHistory";
import { DeliveryStatusHistoryWhereUniqueInput } from "../deliveryStatusHistory/base/DeliveryStatusHistoryWhereUniqueInput";
import { EnumDeliveryStatusHistoryActorType } from "@prisma/client";

import {
  BookDeliveryBody,
  CompleteTripBody,
  CreateDeliveryFromQuoteBody,
  CreateDeliveryDraftFromQuoteBody,
  PromoteDraftBody,
  QuotePreviewBody,
  DriverLocationPingBody,
  CreateTrackingLinkBody,
  TrackingLinkResponseBody,
  StartTripBody,
  SubmitDropoffComplianceBody,
  SubmitPickupComplianceBody,
  TransitionDeliveryStatusBody,
  CancelDeliveryBody,
  SchedulePreviewResponseBody,
  SchedulePreviewBody,
  CancelDeliveryAdminBody,
  ReassignDeliveryAdminBody,
  AdminInvoicePostpaidBody,
  AdminMarkPostpaidPaidBody,
  AdminMarkPayoutPaidBody,
  DeliveryFinancialSummaryResponseBody,
  AdminDeliveryListQueryDto,
  AdminDeliveryListResponseDto,
  AdminDeliveryDetailResponseDto,
  AssignDriverAdminBody,
  ReassignDeliveryAdminPatchBody,
  ForceCancelDeliveryAdminBody,
  OpenDisputeAdminBody,
  LegalHoldAdminBody,
  ApproveComplianceAdminBody,
  CheckPickupProximityBody,
  VerifyPickupPinBody,
  VerifyVinBody,
  EditDeliveryPricingBody,
  EditDeliveryPricingResponseDto,
  PreviewEditDeliveryPricingBody,
  PreviewEditDeliveryPricingResponseDto,
} from "./dto/deliveryRequestLogistics.dto";
import { SupportRequestWhereUniqueInput } from "src/supportRequest/base/SupportRequestWhereUniqueInput";
import { SupportRequestFindManyArgs } from "src/supportRequest/base/SupportRequestFindManyArgs";
import { SupportRequest } from "src/supportRequest/base/SupportRequest";
import { DeliveryPricingEditEngine } from "src/domain/deliveryRequest/deliveryPricingEdit.engine";
import { PrismaService } from "../prisma/prisma.service";
import { EnumDeliveryRequestStatus, EnumUserRoles, EnumDeliveryStatusHistoryActorRole } from "@prisma/client";


@swagger.ApiTags("deliveryRequests")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
@common.Controller("deliveryRequests")
export class DeliveryRequestController extends DeliveryRequestControllerBase {
  constructor(
    protected readonly service: DeliveryRequestService,
    private readonly pricingEditEngine: DeliveryPricingEditEngine,
    private readonly quoteUsageLimit: QuoteUsageLimitService,
    private readonly prisma: PrismaService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SESSION-AWARE ACCESS HELPERS (authorization hardening)
  //
  // The generated-ACL grants allow broad resource actions for every
  // role; the real authorization contract is enforced HERE, per
  // endpoint, from the JWT session:
  //   - Admin action endpoints are ADMIN-only (assertAdmin).
  //   - Driver workflow endpoints derive the driver from the session
  //     JWT, never from the request body/params.
  //   - Customer-facing reads/writes are scoped to the caller's own
  //     Customer row (or to deliveries where they are the assigned
  //     driver).
  // ═══════════════════════════════════════════════════════════════════

  private sessionUser(request: Request): any {
    return (request as any).user ?? null;
  }

  private isAdminRequest(request: Request): boolean {
    const user = this.sessionUser(request);
    return Array.isArray(user?.roles)
      ? user.roles.includes(EnumUserRoles.ADMIN)
      : false;
  }

  /** ADMIN-only gate for every admin action endpoint. */
  private assertAdmin(request: Request): void {
    if (!this.isAdminRequest(request)) {
      throw new common.ForbiddenException("Admin access required");
    }
  }

  /** Resolve the Customer row id for the session user (or null). */
  private async resolveSessionCustomerId(request: Request): Promise<string | null> {
    const user = this.sessionUser(request);
    if (!user?.id) return null;
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return customer?.id ?? null;
  }

  /** Resolve the Driver row id for the session user (or null). */
  private async resolveSessionDriverId(request: Request): Promise<string | null> {
    const user = this.sessionUser(request);
    if (!user?.id) return null;
    const driver = await this.prisma.driver.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return driver?.id ?? null;
  }

  /**
   * Non-admin participant gate for per-delivery operations.
   * The caller must be the delivery's owning customer OR the currently
   * assigned driver. Everyone else gets a 404 (no existence leak).
   */
  private async assertDeliveryParticipantOrAdmin(
    deliveryId: string,
    request: Request,
  ): Promise<void> {
    if (this.isAdminRequest(request)) return;

    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        customerId: true,
        assignments: {
          where: { unassignedAt: null },
          select: { driverId: true },
        },
      },
    });
    if (!delivery) {
      throw new errors.NotFoundException(
        `No resource was found for delivery ${deliveryId}`
      );
    }

    const customerId = await this.resolveSessionCustomerId(request);
    if (customerId && delivery.customerId === customerId) return;

    const driverId = await this.resolveSessionDriverId(request);
    if (driverId && delivery.assignments.some((a) => a.driverId === driverId)) {
      return;
    }

    // 404 rather than 403 — do not reveal other customers' deliveries.
    throw new errors.NotFoundException(
      `No resource was found for delivery ${deliveryId}`
    );
  }

  /**
   * Bind the acting driver to the SESSION for driver-workflow actions
   * (book / start-trip / complete-trip / compliance). The body value is
   * only accepted when it matches the session's own driver profile.
   * Returns the authoritative driverId.
   */
  private async bindSessionDriver(
    request: Request,
    bodyDriverId?: string | null,
  ): Promise<string> {
    const sessionDriverId = await this.resolveSessionDriverId(request);
    if (!sessionDriverId) {
      throw new common.ForbiddenException(
        "This action requires an authenticated driver account"
      );
    }
    if (bodyDriverId && bodyDriverId !== sessionDriverId) {
      throw new common.ForbiddenException(
        "Driver identity must match the authenticated session"
      );
    }
    return sessionDriverId;
  }

  /**
   * Enforce that the session user's role set contains the given role —
   * used to stop body-claimed actorRole escalation (e.g. a customer
   * claiming actorRole=ADMIN in transition-status).
   */
  private assertNoRoleEscalation(request: Request, claimedActorRole?: string | null): void {
    if (!claimedActorRole) return;
    if (claimedActorRole === EnumUserRoles.ADMIN) {
      this.assertAdmin(request);
      return;
    }
    const user = this.sessionUser(request);
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    if (!roles.includes(claimedActorRole)) {
      throw new common.ForbiddenException(
        "actorRole must match the authenticated session"
      );
    }
  }

  @common.Get("counts")
  async count(@common.Req() request: Request): Promise<number> {
    this.assertAdmin(request);
    return this.service.count({});
  }
@common.Post("create-draft-from-quote")
@swagger.ApiOkResponse({ type: DeliveryRequest })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "create",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async createDeliveryDraftFromQuote(
  @common.Body() body: CreateDeliveryDraftFromQuoteBody,
  @common.Req() request: Request
): Promise<DeliveryRequest> {
  // Ownership binding: non-admin callers can only create drafts for
  // their OWN customer row (the FE always sends its own profileId).
  if (!this.isAdminRequest(request)) {
    const sessionCustomerId = await this.resolveSessionCustomerId(request);
    if (!sessionCustomerId || sessionCustomerId !== body.customerId) {
      throw new common.ForbiddenException(
        "customerId must match the authenticated session"
      );
    }
  }
  return this.service.createDeliveryDraftFromQuote({
    customerId: body.customerId,
    quoteId: body.quoteId ?? null,
    serviceType: body.serviceType,
    createdByUserId: body.createdByUserId ?? null,
    createdByRole: body.createdByRole ?? null,
    customerChose: body.customerChose ?? null,
    pickupWindowStart: body.pickupWindowStart ?? null,
    pickupWindowEnd: body.pickupWindowEnd ?? null,
    dropoffWindowStart: body.dropoffWindowStart ?? null,
    dropoffWindowEnd: body.dropoffWindowEnd ?? null,
    licensePlate: body.licensePlate ?? null,
    vehicleColor: body.vehicleColor ?? null,
    vehicleMake: body.vehicleMake ?? null,
    vehicleModel: body.vehicleModel ?? null,
    vinVerificationCode: body.vinVerificationCode ?? null,
    recipientName: body.recipientName ?? null,
    recipientEmail: body.recipientEmail ?? null,
    recipientPhone: body.recipientPhone ?? null,
    specialInstructions: body.specialInstructions ?? null,
    afterHours: body.afterHours === true,
    isUrgent: body.isUrgent === true,
    vehicleStandardsConfirmed: body.vehicleStandardsConfirmed === true,
    // Address fields — used when quoteId is NOT provided (dealer saves draft
    // before calculating a quote). Ignored when quoteId IS provided.
    pickupAddress: body.pickupAddress ?? null,
    pickupLat: body.pickupLat ?? null,
    pickupLng: body.pickupLng ?? null,
    pickupPlaceId: body.pickupPlaceId ?? null,
    pickupState: body.pickupState ?? null,
    dropoffAddress: body.dropoffAddress ?? null,
    dropoffLat: body.dropoffLat ?? null,
    dropoffLng: body.dropoffLng ?? null,
    dropoffPlaceId: body.dropoffPlaceId ?? null,
    dropoffState: body.dropoffState ?? null,
  });
}
@common.Get("/lookup/minimal")
@swagger.ApiOkResponse({
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        label: { type: "string", nullable: true },
        status: { type: "string" },
      },
    },
  },
})
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
async deliveryRequestLookupMinimal(): Promise<
  { id: string; label: string | null; status: string }[]
> {
  return this.service.deliveryRequestLookupList();
}

@common.Post(":id/force-cancel")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminForceCancelDelivery(
  @common.Param("id") id: string,
  @common.Body() body: ForceCancelDeliveryAdminBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminForceCancelDelivery({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason,
    applyPenalty: body.applyPenalty ?? false,
  });
}

/**
 * POST /api/deliveryRequests/:id/close
 * Close a delivery — sets status to CLOSED (not COMPLETED).
 * Used when a dealer/customer ends a delivery without the driver
 * completing the normal dropoff compliance flow.
 * Body: { actorUserId?, actorRole?, reason? }
 */
@common.Post(":id/close")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async closeDelivery(
  @common.Param("id") id: string,
  @common.Body() body: { actorUserId?: string; actorRole?: string; reason?: string; applyPenalty?: boolean },
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.closeDelivery({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    actorRole: body.actorRole ?? null,
    reason: body.reason ?? null,
    // Default: true — dealer-initiated close auto-applies the penalty if
    // the pickup PIN was verified. Pass false to skip (e.g. admin acting
    // on behalf of dealer with explicit no-penalty decision).
    applyPenalty: body.applyPenalty ?? true,
  });
}

@common.Post(":id/open-dispute")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminOpenDispute(
  @common.Param("id") id: string,
  @common.Body() body: OpenDisputeAdminBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminOpenDispute({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason,
    note: body.note ?? null,
    legalHold: body.legalHold === true,
  });
}

@common.Post(":id/legal-hold")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminSetLegalHold(
  @common.Param("id") id: string,
  @common.Body() body: LegalHoldAdminBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminSetLegalHold({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    legalHold: body.legalHold === true,
    note: body.note ?? null,
  });
}
@common.Post(":id/assign-driver")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async assignDriverToDelivery(
  @common.Param("id") id: string,
  @common.Body() body: AssignDriverAdminBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminAssignDriver({
    deliveryId: id,
    driverId: body.driverId,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? null,
  });
}

@common.Patch(":id/reassign")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})

async adminReassignDeliveryV2(
  @common.Param("id") id: string,
  @common.Body() body: ReassignDeliveryAdminPatchBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminReassignDeliveryV2({
    deliveryId: id,
    newDriverId: body.newDriverId,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? null,
  });
}
@common.Post(":id/approve-compliance")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminApproveCompliance(
  @common.Param("id") id: string,
  @common.Body() body: ApproveComplianceAdminBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminApproveCompliance({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}
  @common.Get("admin")
@swagger.ApiOkResponse({ type: AdminDeliveryListResponseDto })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
async getAdminDeliveries(
  @common.Query() query: AdminDeliveryListQueryDto,
  @common.Req() request: Request
): Promise<AdminDeliveryListResponseDto> {
  this.assertAdmin(request);
  return this.service.getAdminDeliveries({
    status: query.status ?? null,
    from: query.from ? new Date(query.from) : null,
    to: query.to ? new Date(query.to) : null,
    customerId: query.customerId ?? null,
    customerType: query.customerType ?? null,
    serviceType: query.serviceType ?? null,
urgentOnly: query.urgentOnly === true,
disputedOnly: query.disputedOnly === true,
requiresOpsConfirmation: query.requiresOpsConfirmation === true,
withoutAssignment: query.withoutAssignment === true,
complianceMissing: query.complianceMissing === true,
activeWithoutTracking: query.activeWithoutTracking === true,
staleTracking: query.staleTracking === true,
    page: query.page ? Number(query.page) : 1,
    pageSize: query.pageSize ? Number(query.pageSize) : 20,
  });
}

/**
 * GET /api/deliveryRequests/admin/stats
 * Returns global delivery status counts — NOT affected by filters or
 * pagination. Used by the admin deliveries page KPI cards so the counts
 * stay stable when filters/page change.
 *
 * Must be declared BEFORE @Get(":id/admin") so the route "admin/stats"
 * doesn't get captured by the ":id" param route.
 */
@common.Get("admin/stats")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
async getAdminDeliveryStats(@common.Req() request: Request): Promise<any> {
  this.assertAdmin(request);
  return this.service.getAdminDeliveryStats();
}

@common.Get(":id/admin")
@swagger.ApiOkResponse({ type: AdminDeliveryDetailResponseDto })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
async getAdminDeliveryDetail(
  @common.Param("id") id: string,
  @common.Req() request: Request
): Promise<AdminDeliveryDetailResponseDto> {
  this.assertAdmin(request);
  return this.service.getAdminDeliveryDetail({ deliveryId: id });
}

@common.Get(":id/admin-financial-summary")
@swagger.ApiOkResponse({ type: DeliveryFinancialSummaryResponseBody })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
async getDeliveryFinancialSummary(
  @common.Param("id") id: string,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.getDeliveryFinancialSummary({
    deliveryId: id,
  });
}

@common.Post(":id/admin-payment-invoice")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminInvoicePostpaid(
  @common.Param("id") id: string,
  @common.Body() body: AdminInvoicePostpaidBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminInvoicePostpaid({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    invoiceId: body.invoiceId ?? null,
    note: body.note ?? null,
  });
}

@common.Post(":id/admin-payment-paid")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminMarkPostpaidPaid(
  @common.Param("id") id: string,
  @common.Body() body: AdminMarkPostpaidPaidBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminMarkPostpaidPaid({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Post(":id/admin-payout-paid")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminMarkPayoutPaid(
  @common.Param("id") id: string,
  @common.Body() body: AdminMarkPayoutPaidBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminMarkPayoutPaid({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    providerTransferId: body.providerTransferId ?? null,
    note: body.note ?? null,
  });
}

@common.Post(":id/admin-cancel")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminCancelDelivery(
  @common.Param("id") id: string,
  @common.Body() body: CancelDeliveryAdminBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminCancelDelivery({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason,
    applyPenalty: body.applyPenalty ?? false,
  });
}

@common.Get(":id/close-penalty-preview")
@swagger.ApiOkResponse({
  schema: {
    type: "object",
    properties: {
      pickupPinVerified: { type: "boolean" },
      penaltyAmountDollars: { type: "number", nullable: true },
      driverId: { type: "string", nullable: true },
      outcome: { type: "string", enum: ["apply_penalty", "no_penalty", "no_driver"] },
      summary: { type: "string" },
    },
  },
})
@swagger.ApiOperation({
  summary:
    "Preview the close penalty for a delivery. Returns whether the pickup PIN was " +
    "verified (penalty warranted) and the penalty amount. Used by the admin UI " +
    "to show the admin the choice before confirming a cancel with penalty.",
})
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
async adminPreviewClosePenalty(
  @common.Param("id") id: string,
  @common.Req() request: Request,
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminPreviewClosePenalty(id);
}

@common.Post(":id/admin-reassign")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async adminReassignDelivery(
  @common.Param("id") id: string,
  @common.Body() body: ReassignDeliveryAdminBody,
  @common.Req() request: Request
): Promise<any> {
  this.assertAdmin(request);
  return this.service.adminReassignDelivery({
    deliveryId: id,
    newDriverId: body.newDriverId,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? null,
  });
}

@common.Post("quote-preview")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "create",
  possession: "any",
})
async createQuotePreview(
  @common.Body() body: QuotePreviewBody,
  @common.Req() request: Request
): Promise<any> {
  // Daily quote budget (billed Google Maps calls happen inside the
  // pricing engine). Admins/drivers are exempt; customers are budgeted
  // per user by role. Throws 429 QUOTE_DAILY_LIMIT_REACHED when over.
  const limitUser = request.user as any;
  await this.quoteUsageLimit.assertQuotePreviewAllowed({
    userId: limitUser?.id ?? null,
    roles: limitUser?.roles ?? [],
    ip: null,
  });

  // Ownership binding: a non-admin caller who supplies a customerId can
  // only quote for their OWN customer row (FE dealers send their own
  // profileId; drivers/other roles omit it entirely).
  if (!this.isAdminRequest(request) && body.customerId) {
    const sessionCustomerId = await this.resolveSessionCustomerId(request);
    if (sessionCustomerId !== body.customerId) {
      throw new common.ForbiddenException(
        "customerId must match the authenticated session"
      );
    }
  }

  return this.service.createQuotePreview({
    pickupAddress: body.pickupAddress,
    dropoffAddress: body.dropoffAddress,
    serviceType: body.serviceType,
    customerId: body.customerId ?? null,
    deliveryType: body.deliveryType ?? null,
  });
}

  @common.Post("create-from-quote")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createDeliveryFromAcceptedQuote(
    @common.Body() body: CreateDeliveryFromQuoteBody,
    @common.Req() request: Request
  ): Promise<DeliveryRequest> {
    const authenticatedUser = request.user as any;
    // Ownership binding: non-admin callers can only book their OWN
    // customer row (the FE always sends its own profileId).
    if (!this.isAdminRequest(request)) {
      const sessionCustomerId = await this.resolveSessionCustomerId(request);
      if (!sessionCustomerId || sessionCustomerId !== body.customerId) {
        throw new common.ForbiddenException(
          "customerId must match the authenticated session"
        );
      }
    }
    return this.service.createDeliveryFromAcceptedQuote({
      customerId: body.customerId,
      quoteId: body.quoteId,
      serviceType: body.serviceType,
      createdByUserId: body.createdByUserId ?? authenticatedUser?.id ?? null,
      createdByRole: body.createdByRole ?? EnumDeliveryRequestCreatedByRole.BusinessCustomer,
      customerChose: body.customerChose ?? null,
      pickupWindowStart: new Date(body.pickupWindowStart),
      pickupWindowEnd: new Date(body.pickupWindowEnd),
      dropoffWindowStart: new Date(body.dropoffWindowStart),
      dropoffWindowEnd: new Date(body.dropoffWindowEnd),
      licensePlate: body.licensePlate,
      vehicleColor: body.vehicleColor,
      vehicleMake: body.vehicleMake ?? null,
      vehicleModel: body.vehicleModel ?? null,
      vinVerificationCode: body.vinVerificationCode,
      recipientName: body.recipientName ?? null,
      recipientEmail: body.recipientEmail ?? null,
      recipientPhone: body.recipientPhone ?? null,
      specialInstructions: body.specialInstructions ?? null,
      isUrgent: body.isUrgent === true,
      afterHours: body.afterHours === true,
      vehicleStandardsConfirmed: body.vehicleStandardsConfirmed === true,
    });
  }

  @common.Post(":id/promote")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async promoteDraftToDelivery(
    @common.Param("id") id: string,
    @common.Body() body: PromoteDraftBody,
    @common.Req() request: Request
  ): Promise<DeliveryRequest> {
    const authenticatedUser = request.user as any;
    return this.service.promoteDraftToDelivery({
      draftId: id,
      // Pass through the frontend-supplied quoteId. The orchestrator resolves
      // the effective quoteId (input.quoteId || draft.quoteId) so that drafts
      // saved without a quote can still be promoted after the dealer calculates
      // one in the editor.
      quoteId: body.quoteId ?? null,
      createdByUserId: body.createdByUserId ?? authenticatedUser?.id ?? null,
      createdByRole: body.createdByRole ?? EnumDeliveryRequestCreatedByRole.BusinessCustomer,
      customerChose: body.customerChose ?? null,
      pickupWindowStart: new Date(body.pickupWindowStart),
      pickupWindowEnd: new Date(body.pickupWindowEnd),
      dropoffWindowStart: new Date(body.dropoffWindowStart),
      dropoffWindowEnd: new Date(body.dropoffWindowEnd),
      licensePlate: body.licensePlate,
      vehicleColor: body.vehicleColor,
      vehicleMake: body.vehicleMake ?? null,
      vehicleModel: body.vehicleModel ?? null,
      vinVerificationCode: body.vinVerificationCode,
      recipientName: body.recipientName ?? null,
      recipientEmail: body.recipientEmail ?? null,
      recipientPhone: body.recipientPhone ?? null,
      specialInstructions: body.specialInstructions ?? null,
      isUrgent: body.isUrgent === true,
      afterHours: body.afterHours === true,
      vehicleStandardsConfirmed: body.vehicleStandardsConfirmed === true,
    });
  }

  /**
   * POST /api/deliveryRequests/:id/edit-pricing/preview
   *
   * Read-only companion to /edit-pricing. Computes the price delta, determines
   * whether the actual edit would trigger a Stripe reauthorization, and
   * returns a user-facing headline + body the frontend can render in a
   * confirmation dialog.
   *
   * NEVER throws PricingEditException for non-editable statuses — returns
   * `editable: false` + `notEditableReason` instead, so the frontend can
   * render the dialog with a disabled submit button (better UX than a hard
   * error — the dealer sees the price delta + the reason on the same screen).
   *
   * Like /edit-pricing, this endpoint is SEPARATE from the generic PATCH /:id
   * flow — it does not modify the DB or Stripe in any way.
   */
  @common.Post(":id/edit-pricing/preview")
  @swagger.ApiOkResponse({ type: PreviewEditDeliveryPricingResponseDto })
  @swagger.ApiBadRequestResponse({ schema: { type: "object", properties: { message: { type: "string" }, statusCode: { type: "number" } } } })
  @swagger.ApiForbiddenResponse({ type: errors.ForbiddenException })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async previewDeliveryPricingEdit(
    @common.Param("id") id: string,
    @common.Body() body: PreviewEditDeliveryPricingBody,
    @common.Req() request: Request,
  ): Promise<PreviewEditDeliveryPricingResponseDto> {
    const authenticatedUser = request.user as any;
    // Derive actorRole from the authenticated session, NOT the request body.
    // The body field is accepted for OpenAPI documentation but ignored —
    // a dealer cannot spoof the ADMIN role by passing it in the body.
    const sessionRole: EnumDeliveryStatusHistoryActorRole | null =
      authenticatedUser?.roles === EnumUserRoles.ADMIN
        ? EnumDeliveryStatusHistoryActorRole.ADMIN
        : authenticatedUser?.roles === EnumUserRoles.DRIVER
          ? EnumDeliveryStatusHistoryActorRole.DRIVER
          : authenticatedUser?.roles === EnumUserRoles.PRIVATE_CUSTOMER
            ? EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER
            : EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER;
    return this.pricingEditEngine.previewPricingEdit({
      deliveryId: id,
      newQuoteId: body.newQuoteId,
      actorRole: sessionRole,
      reactivateIfExpired: body.reactivateIfExpired ?? true,
    });
  }

  /**
   * POST /api/deliveryRequests/:id/edit-pricing
   *
   * Allows a dealer to edit the pricing/addresses of a delivery that is in
   * DRAFT, QUOTED, LISTED, or EXPIRED status. Other statuses (BOOKED, ACTIVE,
   * COMPLETED, CLOSED, CANCELLED, DISPUTED) are blocked for dealers.
   *
   * Admins (session role = ADMIN) may additionally edit terminal-state
   * deliveries (COMPLETED, CLOSED, CANCELLED, DISPUTED) through this same
   * endpoint. The engine records the admin's role in the audit trail.
   *
   * BOOKED and ACTIVE are NEVER editable through this endpoint — a driver has
   * already accepted the trip and money is committed. Admins must use the
   * cancellation/refund flow instead.
   *
   * The caller must first generate a new quote via
   * POST /api/deliveryRequests/quote-preview with the new addresses, then
   * pass that quote's id in the body. The frontend SHOULD also call
   * POST /api/deliveryRequests/:id/edit-pricing/preview first to show the
   * dealer a price-difference confirmation dialog before committing.
   *
   * Stripe reconciliation is handled automatically by DeliveryPricingEditEngine:
   *  - PREPAID + price changed on LISTED/EXPIRED → new PI created first, then
   *    old PI cancelled (safe order: if new PI fails, old PI stays intact).
   *  - POSTPAID → just updates Payment.amount in DB (no Stripe call).
   *  - Price unchanged → no Stripe call (addresses may still be updated).
   *  - EXPIRED → reactivates the delivery (EXPIRED → QUOTED → LISTED) by default.
   *
   * This is a SEPARATE code path from the generic PATCH /:id endpoint, so the
   * existing update flow is completely untouched.
   */
  @common.Post(":id/edit-pricing")
  @swagger.ApiOkResponse({ type: EditDeliveryPricingResponseDto })
  @swagger.ApiBadRequestResponse({ schema: { type: "object", properties: { message: { type: "string" }, statusCode: { type: "number" } } } })
  @swagger.ApiForbiddenResponse({ type: errors.ForbiddenException })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async editDeliveryPricing(
    @common.Param("id") id: string,
    @common.Body() body: EditDeliveryPricingBody,
    @common.Req() request: Request,
  ): Promise<EditDeliveryPricingResponseDto> {
    const authenticatedUser = request.user as any;
    // Derive actorRole from the authenticated session, NOT the request body.
    // The body field is documented in the DTO for OpenAPI but ignored here —
    // a dealer cannot escalate to ADMIN by passing it in the body. This is
    // important because admin-role edits are allowed on terminal-state
    // deliveries (CANCELLED/DISPUTED/CLOSED/COMPLETED) that dealers can't touch.
    const sessionRole: EnumDeliveryStatusHistoryActorRole =
      authenticatedUser?.roles === EnumUserRoles.ADMIN
        ? EnumDeliveryStatusHistoryActorRole.ADMIN
        : authenticatedUser?.roles === EnumUserRoles.DRIVER
          ? EnumDeliveryStatusHistoryActorRole.DRIVER
          : authenticatedUser?.roles === EnumUserRoles.PRIVATE_CUSTOMER
            ? EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER
            : EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER;
    return this.pricingEditEngine.editPricing({
      deliveryId: id,
      newQuoteId: body.newQuoteId,
      reason: body.reason,
      actorUserId: authenticatedUser?.id ?? null,
      actorRole: sessionRole,
      reactivateIfExpired: body.reactivateIfExpired ?? true,
    });
  }

@common.Get("driver/active-delivery/:driverId")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async getDriverActiveDelivery(
  @common.Param("driverId") driverId: string,
  @common.Req() request: Request
): Promise<any> {
  // Session binding: a driver may only ever read their own active delivery.
  const sessionDriverId = await this.resolveSessionDriverId(request);
  if (!sessionDriverId || sessionDriverId !== driverId) {
    throw new common.ForbiddenException(
      "driverId must match the authenticated session"
    );
  }
  return this.service.getDriverActiveDelivery(driverId);
}

@common.Get("driver/feed/:driverId")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async getDriverJobFeed(
  @common.Param("driverId") driverId: string,
  @common.Req() request: Request,
  @common.Query("limit") limit?: string,
  @common.Query("cursor") cursor?: string,
  @common.Query("urgentOnly") urgentOnly?: string,
  @common.Query("serviceType") serviceType?: string,
  @common.Query("search") search?: string,
  @common.Query("radiusMiles") radiusMiles?: string,
  @common.Query("datePreset") datePreset?: "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK",
  @common.Query("sortBy")
  sortBy?: "BEST_MATCH" | "SOONEST" | "NEAREST" | "NEWEST" | "HIGHEST_PAY"
): Promise<any> {
  // Session binding: the feed is always the authenticated driver's own.
  const sessionDriverId = await this.resolveSessionDriverId(request);
  if (!sessionDriverId || sessionDriverId !== driverId) {
    throw new common.ForbiddenException(
      "driverId must match the authenticated session"
    );
  }
  // Translate radiusMiles/datePreset sort values into sortBy for the service
  // Frontend sends sortBy directly; radiusMiles and datePreset are only numeric/date-window filters
  let effectiveSortBy = sortBy ?? "BEST_MATCH";
  let effectiveRadiusMiles =
    radiusMiles !== undefined && radiusMiles !== null && radiusMiles !== "" && radiusMiles !== "NEAREST"
      ? Number(radiusMiles)
      : null;

  return this.service.getDriverJobFeed({
    driverId,
    limit: limit ? Number(limit) : undefined,
    cursor: cursor ?? null,
    urgentOnly: urgentOnly === "true",
    serviceType: serviceType ?? null,
    search: search ?? null,
    radiusMiles: effectiveRadiusMiles,
    datePreset: datePreset === "ALL" || datePreset === "TODAY" || datePreset === "TOMORROW" || datePreset === "THIS_WEEK"
      ? datePreset
      : "ALL",
    sortBy: effectiveSortBy,
  });
}

@common.Get("driver/feed/:driverId/:deliveryId")
@swagger.ApiOkResponse({ type: Object })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async getDriverJobDetail(
  @common.Param("driverId") driverId: string,
  @common.Param("deliveryId") deliveryId: string,
  @common.Req() request: Request
): Promise<any> {
  // Session binding: drivers may only read job detail through their own id.
  const sessionDriverId = await this.resolveSessionDriverId(request);
  if (!sessionDriverId || sessionDriverId !== driverId) {
    throw new common.ForbiddenException(
      "driverId must match the authenticated session"
    );
  }
  return this.service.getDriverJobDetail({
    driverId,
    deliveryId,
  });
}


  @common.Post(":id/book")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async bookDelivery(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: BookDeliveryBody,
    @common.Req() request: Request
  ): Promise<DeliveryRequest> {
    // Session binding: the booking driver is the JWT session's driver —
    // the body value (if any) must agree with it.
    const sessionDriverId = await this.bindSessionDriver(request, body.driverId);
    const sessionUser = this.sessionUser(request);
    return this.service.bookDelivery({
      deliveryId: params.id,
      driverId: sessionDriverId,
      bookedByUserId: sessionUser?.id ?? body.bookedByUserId ?? null,
      reason: body.reason ?? null,
      driverLat: body.driverLat ?? null,
      driverLng: body.driverLng ?? null,
    });
  }

  @common.Post(":id/transition-status")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async transitionDeliveryStatus(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: TransitionDeliveryStatusBody,
    @common.Req() request: Request
  ): Promise<DeliveryRequest> {
    // Session hardening: no actorRole escalation, and non-admin callers
    // may only transition deliveries they own.
    this.assertNoRoleEscalation(request, body.actorRole);
    if (!this.isAdminRequest(request)) {
      await this.assertDeliveryParticipantOrAdmin(params.id, request);
    }
    const sessionUser = this.sessionUser(request);
    return this.service.transitionDeliveryStatus({
      deliveryId: params.id,
      toStatus: body.toStatus,
      actorUserId: sessionUser?.id ?? body.actorUserId ?? null,
      actorRole: body.actorRole ?? null,
      actorType: body.actorType ?? EnumDeliveryStatusHistoryActorType.USER,
      note: body.note ?? null,
    });
  }
  @common.Post("driver/location-ping")
  @swagger.ApiOkResponse({ type: Object })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async pingDriverLocation(
    @common.Body() body: DriverLocationPingBody,
    @common.Req() req: Request
  ): Promise<any> {
    const user = req.user as any;

    const lat = Number(body.lat);
    const lng = Number(body.lng);

    // Server-side GPS sanity checks (same as socket gateway)
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new common.BadRequestException("Invalid GPS coordinates");
    }
    if (Math.abs(lat) < 1 && Math.abs(lng) < 1) {
      throw new common.BadRequestException("GPS cold-start position rejected");
    }

    return this.service.ingestDriverLocation({
      userId: user?.id,
      lat,
      lng,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
    });
  }

  @common.Post(":id/tracking-link")
  @swagger.ApiOkResponse({ type: TrackingLinkResponseBody })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async createTrackingLink(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: CreateTrackingLinkBody,
    @common.Req() request: Request
  ): Promise<TrackingLinkResponseBody> {
    // Only the owner customer, the assigned driver, or an admin may mint
    // a live tracking link for a delivery.
    await this.assertDeliveryParticipantOrAdmin(params.id, request);
    return this.service.createTrackingLink({
      deliveryId: params.id,
      expiresInHours: body.expiresInHours ?? 24,
    });
  }

  @common.Post(":id/tracking-link/resend")
  @swagger.ApiOperation({
    summary:
      "Admin: regenerate the tracking share token and email the fresh link to customer + recipient",
  })
  @swagger.ApiOkResponse({ type: TrackingLinkResponseBody })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async resendTrackingLink(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Req() request: Request
  ): Promise<TrackingLinkResponseBody> {
    this.assertAdmin(request);
    return this.service.resendTrackingLink({
      deliveryId: params.id,
    });
  }

  @common.Get(":id/tracking-link")
  @swagger.ApiOkResponse({ type: TrackingLinkResponseBody })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async getTrackingLink(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Req() request: Request
  ): Promise<TrackingLinkResponseBody> {
    // Only the owner customer, the assigned driver, or an admin may read
    // (or mint) the tracking share link for a delivery.
    await this.assertDeliveryParticipantOrAdmin(params.id, request);
    return this.service.getTrackingLink({
      deliveryId: params.id,
    });
  }

  @common.Post(":id/start-trip")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async startTrip(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: StartTripBody,
  @common.Req() request: Request
): Promise<DeliveryRequest> {
  // Session binding: the trip is started by the JWT session's driver.
  const sessionDriverId = await this.bindSessionDriver(request, body.driverId);
  const sessionUser = this.sessionUser(request);
  return this.service.startTrip({
    deliveryId: params.id,
    driverId: sessionDriverId,
    actorUserId: sessionUser?.id ?? body.actorUserId ?? null,
    actorRole: EnumDeliveryStatusHistoryActorRole.DRIVER,
  });
}

@common.Post(":id/check-pickup-proximity")
@swagger.ApiOkResponse({ description: "GPS proximity check for Start Pickup Now" })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async checkPickupProximity(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: CheckPickupProximityBody
): Promise<{ withinRadius: boolean; distanceMeters: number }> {
  return this.service.checkPickupProximity({
    deliveryId: params.id,
    driverLat: body.driverLat,
    driverLng: body.driverLng,
  });
}

@common.Post(":id/verify-pin")
@swagger.ApiOkResponse({ type: Object })
@swagger.ApiBadRequestResponse({ description: "Invalid PIN" })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async verifyPickupPin(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: VerifyPickupPinBody
): Promise<{ valid: boolean }> {
  return this.service.verifyPickupPin({
    deliveryId: params.id,
    pin: body.pin,
  });
}

@common.Post(":id/verify-vin")
@swagger.ApiOkResponse({ type: Object })
@swagger.ApiBadRequestResponse({ description: "Invalid VIN" })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
async verifyVin(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: VerifyVinBody
): Promise<{ valid: boolean }> {
  return this.service.verifyVin({
    deliveryId: params.id,
    vin: body.vin,
  });
}

@common.Post(":id/complete-trip")
@swagger.ApiOkResponse({ type: DeliveryRequest })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async completeTrip(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: CompleteTripBody,
  @common.Req() request: Request
): Promise<DeliveryRequest> {
  // Session binding: the trip is completed by the JWT session's driver.
  const sessionDriverId = await this.bindSessionDriver(request, body.driverId);
  const sessionUser = this.sessionUser(request);
  return this.service.completeTrip({
    deliveryId: params.id,
    driverId: sessionDriverId,
    actorUserId: sessionUser?.id ?? body.actorUserId ?? null,
    actorRole: EnumDeliveryStatusHistoryActorRole.DRIVER,
  });
}

@common.Post(":id/pickup-compliance")
@swagger.ApiOkResponse({ type: DeliveryRequest })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async submitPickupCompliance(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: SubmitPickupComplianceBody,
  @common.Req() request: Request
): Promise<DeliveryRequest> {
  // Session binding: compliance evidence is filed by the session's driver.
  const sessionDriverId = await this.bindSessionDriver(request, body.driverId);
  return this.service.submitPickupCompliance({
    deliveryId: params.id,
    driverId: sessionDriverId,
    vinVerificationCode: body.vinVerificationCode,
    odometerStart: body.odometerStart,
    photos: body.photos ?? [],
    dashboardPhotoUrl: body.dashboardPhotoUrl ?? null,
  });
}

@common.Post(":id/dropoff-compliance")
@swagger.ApiOkResponse({ type: DeliveryRequest })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async submitDropoffCompliance(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: SubmitDropoffComplianceBody,
  @common.Req() request: Request
): Promise<DeliveryRequest> {
  // Session binding: compliance evidence is filed by the session's driver.
  const sessionDriverId = await this.bindSessionDriver(request, body.driverId);
  return this.service.submitDropoffCompliance({
    deliveryId: params.id,
    driverId: sessionDriverId,
    odometerEnd: body.odometerEnd,
    photos: body.photos ?? [],
    dashboardPhotoUrl: body.dashboardPhotoUrl ?? null,
  });
}

@common.Get(":id/driver-workflow/:driverId")
@swagger.ApiOkResponse({ schema: { type: "object" } })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async getDriverWorkflowSummary(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Param("driverId") driverId: string,
  @common.Req() request: Request
): Promise<any> {
  // Session binding: workflow summaries are per-driver.
  const sessionDriverId = await this.resolveSessionDriverId(request);
  if (!sessionDriverId || sessionDriverId !== driverId) {
    throw new common.ForbiddenException(
      "driverId must match the authenticated session"
    );
  }
  return this.service.getDriverWorkflowSummary({
    deliveryId: params.id,
    driverId,
  });
}
@common.Post(":id/cancel")
@swagger.ApiOkResponse({ type: DeliveryRequest })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "update",
  possession: "any",
})
@swagger.ApiForbiddenResponse({
  type: errors.ForbiddenException,
})
async cancelDelivery(
  @common.Param() params: DeliveryRequestWhereUniqueInput,
  @common.Body() body: CancelDeliveryBody,
  @common.Req() request: Request
): Promise<DeliveryRequest> {
  // Cancellation moves money (void auth holds / auto refunds) and is an
  // ops decision — ADMIN-only. Zero FE callers outside admin surfaces.
  this.assertAdmin(request);
  return this.service.cancelDelivery({
    deliveryId: params.id,
    actorUserId: body.actorUserId ?? null,
    actorRole: body.actorRole ?? null,
    note: body.note ?? null,
  });
}
@common.Post("schedule-preview")
@swagger.ApiOkResponse({ type: SchedulePreviewResponseBody })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "create",
  possession: "any",
})
async schedulePreview(
  @common.Body() body: SchedulePreviewBody
): Promise<SchedulePreviewResponseBody> {
  return this.service.schedulePreview(body);
}
  @common.UseInterceptors(AclValidateRequestInterceptor)
 @common.Post()
  @swagger.ApiCreatedResponse({ type: DeliveryRequest })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createDeliveryRequest(
    @common.Body() data: DeliveryRequestCreateInput
  ): Promise<DeliveryRequest> {
    return await this.service.createDeliveryRequest({
      data: {
        ...data,

        compliance: data.compliance
          ? {
              connect: data.compliance,
            }
          : undefined,

        createdBy: data.createdBy
          ? {
              connect: data.createdBy,
            }
          : undefined,

        customer: {
          connect: data.customer,
        },

        dispute: data.dispute
          ? {
              connect: data.dispute,
            }
          : undefined,

        payment: data.payment
          ? {
              connect: data.payment,
            }
          : undefined,

        payout: data.payout
          ? {
              connect: data.payout,
            }
          : undefined,

        quote: data.quote
          ? {
              connect: data.quote,
            }
          : undefined,

        rating: data.rating
          ? {
              connect: data.rating,
            }
          : undefined,

        resubmittedFrom: data.resubmittedFrom
          ? {
              connect: data.resubmittedFrom,
            }
          : undefined,

        tip: data.tip
          ? {
              connect: data.tip,
            }
          : undefined,

        trackingSession: data.trackingSession
          ? {
              connect: data.trackingSession,
            }
          : undefined,
      },
      select: {
        afterHours: true,
        bufferMinutes: true,

        compliance: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        createdBy: {
          select: {
            id: true,
          },
        },

        createdByRole: true,

        customer: {
          select: {
            id: true,
          },
        },

        customerChose: true,

        dispute: {
          select: {
            id: true,
          },
        },

        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        dropoffWindowEnd: true,
        dropoffWindowStart: true,
        etaMinutes: true,
        id: true,
        isUrgent: true,
        licensePlate: true,

        payment: {
          select: {
            id: true,
          },
        },

        payout: {
          select: {
            id: true,
          },
        },

        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupPin: true,
        pickupState: true,
        pickupWindowEnd: true,
        pickupWindowStart: true,

        quote: {
          select: {
            id: true,
          },
        },

        rating: {
          select: {
            id: true,
          },
        },

        recipientEmail: true,
        recipientName: true,
        recipientPhone: true,
        requiresOpsConfirmation: true,

        resubmittedFrom: {
          select: {
            id: true,
          },
        },

        sameDayEligible: true,
        serviceType: true,
        status: true,

        tip: {
          select: {
            id: true,
          },
        },

        trackingSession: {
          select: {
            id: true,
          },
        },

        trackingShareExpiresAt: true,
        trackingShareToken: true,
        updatedAt: true,
        urgentBonusAmount: true,
        vehicleColor: true,
        vehicleMake: true,
        vehicleModel: true,
        vinVerificationCode: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [DeliveryRequest] })
  @ApiNestedQuery(DeliveryRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deliveryRequests(
    @common.Req() request: Request
  ): Promise<DeliveryRequest[]> {
    const args = plainToClass(DeliveryRequestFindManyArgs, request.query);

    // ROW-LEVEL SCOPING: the grants allow read:any for every role, so
    // ownership is enforced here. Admins see everything; customers see
    // ONLY their own deliveries (the FE dealer-drafts page already
    // filters by its own id — this makes the filter authoritative);
    // drivers must use the driver feed endpoints.
    if (!this.isAdminRequest(request)) {
      const user = this.sessionUser(request);
      const isDriver =
        Array.isArray(user?.roles) && user.roles.includes(EnumUserRoles.DRIVER);
      if (isDriver) {
        throw new common.ForbiddenException(
          "Driver accounts use the driver feed endpoints"
        );
      }
      const sessionCustomerId = await this.resolveSessionCustomerId(request);
      if (!sessionCustomerId) {
        // No customer profile → nothing to show. Empty list, not an error,
        // so odd auth states can never become a data leak.
        return [];
      }
      const ownerFilter = { customerId: sessionCustomerId } as any;
      args.where = args.where
        ? { AND: [args.where as any, ownerFilter] }
        : ownerFilter;
    }

    return this.service.deliveryRequests({
      ...args,
      select: {
        afterHours: true,
        bufferMinutes: true,

        compliance: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        createdBy: {
          select: {
            id: true,
          },
        },

        createdByRole: true,

        customer: {
          select: {
            id: true,
          },
        },

        customerChose: true,

        dispute: {
          select: {
            id: true,
          },
        },

        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        dropoffWindowEnd: true,
        dropoffWindowStart: true,
        etaMinutes: true,
        id: true,
        isUrgent: true,
        licensePlate: true,

        payment: {
          select: {
            id: true,
          },
        },

        payout: {
          select: {
            id: true,
          },
        },

        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupPin: true,
        pickupState: true,
        pickupWindowEnd: true,
        pickupWindowStart: true,

        quote: {
          select: {
            id: true,
          },
        },

        rating: {
          select: {
            id: true,
          },
        },

        recipientEmail: true,
        recipientName: true,
        recipientPhone: true,
        requiresOpsConfirmation: true,

        resubmittedFrom: {
          select: {
            id: true,
          },
        },

        sameDayEligible: true,
        serviceType: true,
        status: true,

        tip: {
          select: {
            id: true,
          },
        },

        trackingSession: {
          select: {
            id: true,
          },
        },

        trackingShareExpiresAt: true,
        trackingShareToken: true,
        updatedAt: true,
        urgentBonusAmount: true,
        vehicleColor: true,
        vehicleMake: true,
        vehicleModel: true,
        vinVerificationCode: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deliveryRequest(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Req() request?: Request
  ): Promise<DeliveryRequest | null> {
    // ROW-LEVEL SCOPING: owner customer, assigned driver, or admin. A
    // 404 (not 403) for everyone else — no existence leak.
    // (`request` is optional so the override signature stays compatible
    // with the base class; NestJS always injects it at runtime.)
    if (request) {
      await this.assertDeliveryParticipantOrAdmin(params.id, request);
    }
    const result = await this.service.deliveryRequest({
      where: params,
      select: {
        afterHours: true,
        bufferMinutes: true,

        compliance: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        createdBy: {
          select: {
            id: true,
          },
        },

        createdByRole: true,

        customer: {
          select: {
            id: true,
          },
        },

        customerChose: true,

        dispute: {
          select: {
            id: true,
          },
        },

        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        dropoffWindowEnd: true,
        dropoffWindowStart: true,
        etaMinutes: true,
        id: true,
        isUrgent: true,
        licensePlate: true,

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
            status: true,
            createdAt: true,
          },
        },

        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupPin: true,
        pickupState: true,
        pickupWindowEnd: true,
        pickupWindowStart: true,

        quote: {
          select: {
            id: true,
            serviceType: true,
            estimatedPrice: true,
            feesBreakdown: true,
          },
        },

        rating: {
          select: {
            id: true,
            stars: true,
          },
        },

        recipientEmail: true,
        recipientName: true,
        recipientPhone: true,
        requiresOpsConfirmation: true,

        resubmittedFrom: {
          select: {
            id: true,
            status: true,
          },
        },

        sameDayEligible: true,
        serviceType: true,
        status: true,

        tip: {
          select: {
            id: true,
            amount: true,
          },
        },

        trackingSession: {
          select: {
            id: true,
            status: true,
          },
        },

        trackingShareExpiresAt: true,
        trackingShareToken: true,
        updatedAt: true,
        urgentBonusAmount: true,
        vehicleColor: true,
        vehicleMake: true,
        vehicleModel: true,
        vinVerificationCode: true,

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
      },
    });
    if (result === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return result;
  }

  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("/:id")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateDeliveryRequest(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() data: DeliveryRequestUpdateInput,
    @common.Req() request?: Request,
  ): Promise<DeliveryRequest | null> {
    // ── PRICING-EDIT LOCKDOWN ────────────────────────────────────────────
    // If a dealer tries to change quote / pricing / pickup-or-dropoff
    // addresses on a delivery that is in a dealer-editable status
    // (DRAFT/QUOTED/LISTED/EXPIRED), we REJECT the PATCH and tell them to
    // use POST /:id/edit-pricing instead. The edit-pricing engine is the
    // only code path that does proper Stripe reconciliation (cancel old PI,
    // create new PI) — bypassing it via PATCH would leave Stripe with the
    // old auth hold while the DB shows the new price, which is exactly the
    // bug this whole subsystem was built to prevent.
    //
    // Admins (role=ADMIN) are exempt — they can PATCH whatever they want
    // (e.g. to fix a manually-intervened delivery).
    //
    // `request` is declared optional so the override signature stays
    // compatible with the base class. NestJS always injects it at runtime.
    if (request) {
      // OWNERSHIP + FIELD LOCKDOWN: non-admin callers may only PATCH
      // their own deliveries, and status/quote/customer relations are
      // owned by the lifecycle + pricing engines, never by this
      // generic endpoint. Runs BEFORE the pricing guard below.
      await this.guardDeliveryPatchOwnershipAndFields(
        params.id,
        data as any,
        request,
      );
      await this.guardPricingFieldsForDealerEditableStatuses(
        params.id,
        data as any,
        request,
      );
    }

    try {
      // Strip fields the frontend may send that are NOT valid Prisma
      // DeliveryRequestUpdateInput keys. Without this, the `...data` spread
      // below passes them through to prisma.deliveryRequest.update(), which
      // throws a PrismaClientValidationError:
      //   - customerId / quoteId / resubmittedFromId / createdByUserId:
      //     these are foreign-key SCALARS. Prisma's typed UpdateInput only
      //     accepts the relation form (customer: { connect: { id } }), not
      //     the flat scalar. They are converted to relation connects below.
      //   - transmission / recipientBusinessName / transmissionOther:
      //     form-only fields that have no matching column on DeliveryRequest.
      //     The dealer-edit-delivery form includes them for UX but they must
      //     never reach Prisma.
      //   - paymentType: also form-only — NOT a DeliveryRequest column.
      //     PREPAID/POSTPAID is decided on the Payment row at create/promote
      //     time from the customer's postpaidEnabled flag. The review page's
      //     save-draft payload includes it (shared with the create-draft
      //     body), and when forwarded it made every draft PATCH fail with
      //     PrismaClientValidationError "Unknown argument paymentType" —
      //     for private AND business customers alike.
      //   - customer / quote / createdBy / resubmittedFrom as RELATION
      //     objects are kept and handled by the explicit `connect:` blocks
      //     below (so we delete the raw form here to avoid double-handling).
      const {
        customerId,
        quoteId,
        resubmittedFromId,
        createdByUserId,
        transmission,
        transmissionOther,
        recipientBusinessName,
        paymentType,
        customer: rawCustomer,
        quote: rawQuote,
        createdBy: rawCreatedBy,
        resubmittedFrom: rawResubmittedFrom,
        ...rest
      } = data as any;

      return await this.service.updateDeliveryRequest({
        where: params,
        data: {
          ...rest,

          compliance: data.compliance
            ? {
                connect: data.compliance,
              }
            : undefined,

          createdBy: data.createdBy
            ? {
                connect: data.createdBy,
              }
            : createdByUserId
            ? {
                connect: { id: createdByUserId },
              }
            : undefined,

          customer: data.customer
            ? {
                connect: data.customer,
              }
            : customerId
            ? {
                connect: { id: customerId },
              }
            : undefined,

          dispute: data.dispute
            ? {
                connect: data.dispute,
              }
            : undefined,

          payment: data.payment
            ? {
                connect: data.payment,
              }
            : undefined,

          payout: data.payout
            ? {
                connect: data.payout,
              }
            : undefined,

          quote: data.quote
            ? {
                connect: data.quote,
              }
            : quoteId
            ? {
                connect: { id: quoteId },
              }
            : undefined,

          rating: data.rating
            ? {
                connect: data.rating,
              }
            : undefined,

          resubmittedFrom: data.resubmittedFrom
            ? {
                connect: data.resubmittedFrom,
              }
            : resubmittedFromId
            ? {
                connect: { id: resubmittedFromId },
              }
            : undefined,

          tip: data.tip
            ? {
                connect: data.tip,
              }
            : undefined,

          trackingSession: data.trackingSession
            ? {
                connect: data.trackingSession,
              }
            : undefined,
        },
        select: {
          afterHours: true,
          bufferMinutes: true,

          compliance: {
            select: {
              id: true,
            },
          },

          createdAt: true,

          createdBy: {
            select: {
              id: true,
            },
          },

          createdByRole: true,

          customer: {
            select: {
              id: true,
            },
          },

          customerChose: true,

          dispute: {
            select: {
              id: true,
            },
          },

          dropoffAddress: true,
          dropoffLat: true,
          dropoffLng: true,
          dropoffPlaceId: true,
          dropoffState: true,
          dropoffWindowEnd: true,
          dropoffWindowStart: true,
          etaMinutes: true,
          id: true,
          isUrgent: true,
          licensePlate: true,

          payment: {
            select: {
              id: true,
            },
          },

          payout: {
            select: {
              id: true,
            },
          },

          pickupAddress: true,
          pickupLat: true,
          pickupLng: true,
          pickupPlaceId: true,
          pickupPin: true,
          pickupState: true,
          pickupWindowEnd: true,
          pickupWindowStart: true,

          quote: {
            select: {
              id: true,
            },
          },

          rating: {
            select: {
              id: true,
            },
          },

          recipientEmail: true,
          recipientName: true,
          recipientPhone: true,
          requiresOpsConfirmation: true,

          resubmittedFrom: {
            select: {
              id: true,
            },
          },

          sameDayEligible: true,
          serviceType: true,
          status: true,

          tip: {
            select: {
              id: true,
            },
          },

          trackingSession: {
            select: {
              id: true,
            },
          },

          trackingShareExpiresAt: true,
          trackingShareToken: true,
          updatedAt: true,
          urgentBonusAmount: true,
          vehicleColor: true,
          vehicleMake: true,
          vehicleModel: true,
          vinVerificationCode: true,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }

  @common.Delete("/:id")
  @swagger.ApiOkResponse({ type: DeliveryRequest })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteDeliveryRequest(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Req() request?: Request
  ): Promise<DeliveryRequest | null> {
    // ROW-LEVEL SCOPING: non-admin callers may only delete their OWN
    // deliveries, and only while still DRAFT (after that, deletion is an
    // admin decision). 404 for foreign rows — no existence leak.
    // (`request` optional for base-signature compatibility; always
    // injected at runtime.)
    if (request && !this.isAdminRequest(request)) {
      const delivery = await this.prisma.deliveryRequest.findUnique({
        where: { id: params.id },
        select: { customerId: true, status: true },
      });
      const sessionCustomerId = await this.resolveSessionCustomerId(request);
      if (
        !delivery ||
        !sessionCustomerId ||
        delivery.customerId !== sessionCustomerId
      ) {
        throw new errors.NotFoundException(
          `No resource was found for delivery ${params.id}`
        );
      }
      if (delivery.status !== EnumDeliveryRequestStatus.DRAFT) {
        throw new common.ForbiddenException(
          "Only DRAFT deliveries can be deleted"
        );
      }
    }
    try {
      return await this.service.deleteDeliveryRequest({
        where: params,
        select: {
          afterHours: true,
          bufferMinutes: true,

          compliance: {
            select: {
              id: true,
            },
          },

          createdAt: true,

          createdBy: {
            select: {
              id: true,
            },
          },

          createdByRole: true,

          customer: {
            select: {
              id: true,
            },
          },

          customerChose: true,

          dispute: {
            select: {
              id: true,
            },
          },

          dropoffAddress: true,
          dropoffLat: true,
          dropoffLng: true,
          dropoffPlaceId: true,
          dropoffState: true,
          dropoffWindowEnd: true,
          dropoffWindowStart: true,
          etaMinutes: true,
          id: true,
          isUrgent: true,
          licensePlate: true,

          payment: {
            select: {
              id: true,
            },
          },

          payout: {
            select: {
              id: true,
            },
          },

          pickupAddress: true,
          pickupLat: true,
          pickupLng: true,
          pickupPlaceId: true,
          pickupPin: true,
          pickupState: true,
          pickupWindowEnd: true,
          pickupWindowStart: true,

          quote: {
            select: {
              id: true,
            },
          },

          rating: {
            select: {
              id: true,
            },
          },

          recipientEmail: true,
          recipientName: true,
          recipientPhone: true,
          requiresOpsConfirmation: true,

          resubmittedFrom: {
            select: {
              id: true,
            },
          },

          sameDayEligible: true,
          serviceType: true,
          status: true,

          tip: {
            select: {
              id: true,
            },
          },

          trackingSession: {
            select: {
              id: true,
            },
          },

          trackingShareExpiresAt: true,
          trackingShareToken: true,
          updatedAt: true,
          urgentBonusAmount: true,
          vehicleColor: true,
          vehicleMake: true,
          vehicleModel: true,
          vinVerificationCode: true,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/assignments")
  @ApiNestedQuery(DeliveryAssignmentFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryAssignment",
    action: "read",
    possession: "any",
  })
  async findAssignments(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<DeliveryAssignment[]> {
    const query = plainToClass(DeliveryAssignmentFindManyArgs, request.query);
    const results = await this.service.findAssignments(params.id, {
      ...query,
      select: {
        assignedAt: true,

        assignedBy: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        reason: true,
        unassignedAt: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/assignments")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectAssignments(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignments: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/assignments")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateAssignments(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignments: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/assignments")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectAssignments(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignments: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/audits")
  @ApiNestedQuery(AdminAuditLogFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "read",
    possession: "any",
  })
  async findAudits(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<AdminAuditLog[]> {
    const query = plainToClass(AdminAuditLogFindManyArgs, request.query);
    const results = await this.service.findAudits(params.id, {
      ...query,
      select: {
        action: true,

        actor: {
          select: {
            id: true,
          },
        },

        actorType: true,
        afterJson: true,
        beforeJson: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        reason: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/audits")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectAudits(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      audits: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/audits")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateAudits(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      audits: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/audits")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectAudits(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      audits: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/evidence")
  @ApiNestedQuery(DeliveryEvidenceFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryEvidence",
    action: "read",
    possession: "any",
  })
  async findEvidence(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<DeliveryEvidence[]> {
    const query = plainToClass(DeliveryEvidenceFindManyArgs, request.query);
    const results = await this.service.findEvidence(params.id, {
      ...query,
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        imageUrl: true,
        phase: true,
        slotIndex: true,
        type: true,
        updatedAt: true,
        value: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/evidence")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectEvidence(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryEvidenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      evidence: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/evidence")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateEvidence(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryEvidenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      evidence: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/evidence")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectEvidence(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryEvidenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      evidence: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/evidenceExports")
  @ApiNestedQuery(EvidenceExportFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "EvidenceExport",
    action: "read",
    possession: "any",
  })
  async findEvidenceExports(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<EvidenceExport[]> {
    const query = plainToClass(EvidenceExportFindManyArgs, request.query);
    const results = await this.service.findEvidenceExports(params.id, {
      ...query,
      select: {
        createdAt: true,

        createdBy: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        metaJson: true,
        updatedAt: true,
        url: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/evidenceExports")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectEvidenceExports(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: EvidenceExportWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      evidenceExports: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/evidenceExports")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateEvidenceExports(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: EvidenceExportWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      evidenceExports: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/evidenceExports")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectEvidenceExports(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: EvidenceExportWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      evidenceExports: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/notifications")
  @ApiNestedQuery(NotificationEventFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "read",
    possession: "any",
  })
  async findNotifications(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<NotificationEvent[]> {
    const query = plainToClass(NotificationEventFindManyArgs, request.query);
    const results = await this.service.findNotifications(params.id, {
      ...query,
      select: {
        actor: {
          select: {
            id: true,
          },
        },

        archivedAt: true,
        body: true,
        channel: true,
        clickedAt: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        dismissedAt: true,

        driver: {
          select: {
            id: true,
          },
        },

        errorMessage: true,
        expiresAt: true,
        failedAt: true,
        id: true,
        isRead: true,
        openedAt: true,
        payload: true,
        readAt: true,
        seenInListAt: true,
        sentAt: true,
        status: true,
        subject: true,
        templateCode: true,
        toEmail: true,
        toPhone: true,
        type: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/notifications")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectNotifications(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifications: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/notifications")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateNotifications(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifications: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/notifications")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectNotifications(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifications: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/resubmissions")
  @ApiNestedQuery(DeliveryRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "read",
    possession: "any",
  })
  async findResubmissions(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<DeliveryRequest[]> {
    const query = plainToClass(DeliveryRequestFindManyArgs, request.query);
    const results = await this.service.findResubmissions(params.id, {
      ...query,
      select: {
        afterHours: true,
        bufferMinutes: true,

        compliance: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        createdBy: {
          select: {
            id: true,
          },
        },

        createdByRole: true,

        customer: {
          select: {
            id: true,
          },
        },

        customerChose: true,

        dispute: {
          select: {
            id: true,
          },
        },

        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        dropoffWindowEnd: true,
        dropoffWindowStart: true,
        etaMinutes: true,
        id: true,
        isUrgent: true,
        licensePlate: true,

        payment: {
          select: {
            id: true,
          },
        },

        payout: {
          select: {
            id: true,
          },
        },

        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupPin: true,
        pickupState: true,
        pickupWindowEnd: true,
        pickupWindowStart: true,

        quote: {
          select: {
            id: true,
          },
        },

        rating: {
          select: {
            id: true,
          },
        },

        recipientEmail: true,
        recipientName: true,
        recipientPhone: true,
        requiresOpsConfirmation: true,

        resubmittedFrom: {
          select: {
            id: true,
          },
        },

        sameDayEligible: true,
        serviceType: true,
        status: true,

        tip: {
          select: {
            id: true,
          },
        },

        trackingSession: {
          select: {
            id: true,
          },
        },

        trackingShareExpiresAt: true,
        trackingShareToken: true,
        updatedAt: true,
        urgentBonusAmount: true,
        vehicleColor: true,
        vehicleMake: true,
        vehicleModel: true,
        vinVerificationCode: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/resubmissions")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectResubmissions(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      resubmissions: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/resubmissions")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateResubmissions(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      resubmissions: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/resubmissions")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectResubmissions(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      resubmissions: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/scheduleChanges")
  @ApiNestedQuery(ScheduleChangeRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "ScheduleChangeRequest",
    action: "read",
    possession: "any",
  })
  async findScheduleChanges(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<ScheduleChangeRequest[]> {
    const query = plainToClass(
      ScheduleChangeRequestFindManyArgs,
      request.query
    );
    const results = await this.service.findScheduleChanges(params.id, {
      ...query,
      select: {
        createdAt: true,
        decidedAt: true,

        decidedBy: {
          select: {
            id: true,
          },
        },

        decisionNote: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        proposedDropoffWindowEnd: true,
        proposedDropoffWindowStart: true,
        proposedPickupWindowEnd: true,
        proposedPickupWindowStart: true,
        reason: true,

        requestedBy: {
          select: {
            id: true,
          },
        },

        requestedByRole: true,
        status: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/scheduleChanges")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectScheduleChanges(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChanges: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/scheduleChanges")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateScheduleChanges(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChanges: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/scheduleChanges")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectScheduleChanges(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: ScheduleChangeRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      scheduleChanges: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/statusHistory")
  @ApiNestedQuery(DeliveryStatusHistoryFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryStatusHistory",
    action: "read",
    possession: "any",
  })
  async findStatusHistory(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<DeliveryStatusHistory[]> {
    const query = plainToClass(
      DeliveryStatusHistoryFindManyArgs,
      request.query
    );
    const results = await this.service.findStatusHistory(params.id, {
      ...query,
      select: {
        actor: {
          select: {
            id: true,
          },
        },

        actorRole: true,
        actorType: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        fromStatus: true,
        id: true,
        note: true,
        toStatus: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/statusHistory")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectStatusHistory(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryStatusHistoryWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      statusHistory: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/statusHistory")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateStatusHistory(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryStatusHistoryWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      statusHistory: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/statusHistory")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectStatusHistory(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: DeliveryStatusHistoryWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      statusHistory: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/supportRequests")
  @ApiNestedQuery(SupportRequestFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "SupportRequest",
    action: "read",
    possession: "any",
  })
  async findSupportRequests(
    @common.Req() request: Request,
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<SupportRequest[]> {
    const query = plainToClass(SupportRequestFindManyArgs, request.query);
    const results = await this.service.findSupportRequests(params.id, {
      ...query,
      select: {
        actorRole: true,
        actorType: true,

        assignedTo: {
          select: {
            id: true,
          },
        },

        category: true,
        closedAt: true,
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        id: true,
        message: true,
        priority: true,
        resolvedAt: true,
        status: true,
        subject: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/supportRequests")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async connectSupportRequests(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: SupportRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      supportRequests: {
        connect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/supportRequests")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async updateSupportRequests(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: SupportRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      supportRequests: {
        set: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/supportRequests")
  @nestAccessControl.UseRoles({
    resource: "DeliveryRequest",
    action: "update",
    possession: "any",
  })
  async disconnectSupportRequests(
    @common.Param() params: DeliveryRequestWhereUniqueInput,
    @common.Body() body: SupportRequestWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      supportRequests: {
        disconnect: body,
      },
    };
    await this.service.updateDeliveryRequest({
      where: params,
      data,
      select: { id: true },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // PATCH /:id lockdown — prevent bypassing the pricing-edit engine.
  //
  // The DeliveryPricingEditEngine (POST /:id/edit-pricing) is the ONLY
  // code path that does proper Stripe reconciliation when a dealer changes
  // pricing or addresses on a delivery. If a dealer could just PATCH the
  // `quoteId` / `pickupAddress` / `dropoffAddress` / pickup-dropoff coords
  // directly, the DB would show the new price while Stripe still holds the
  // OLD auth — exactly the bug the engine was built to prevent.
  //
  // This guard runs at the TOP of PATCH /:id and rejects any attempt to
  // change those fields while the delivery is in a dealer-editable status
  // WITH AN ACTIVE PAYMENT ROW (QUOTED/LISTED/EXPIRED). The dealer must
  // use /edit-pricing instead.
  //
  // DRAFT is EXEMPT — drafts have no Payment row, no Stripe auth, nothing
  // to reconcile. The dedicated draft-edit page (dealer-edit-draft.tsx)
  // PATCHes addresses/quote freely, and that's correct because no payment
  // machinery has touched the delivery yet.
  //
  // Admins (role=ADMIN) are also exempt — they may need to PATCH pricing
  // fields directly when fixing a manually-intervened delivery.
  //
  // Non-editable statuses (BOOKED/ACTIVE/COMPLETED/CLOSED/CANCELLED/DISPUTED)
  // don't need this guard because pricing edits aren't allowed there at all,
  // and the PATCH endpoint's own role-based access control + business logic
  // already prevents quote/address changes on locked deliveries.
  // ─────────────────────────────────────────────────────────────────
  /**
   * PATCH ownership + field lockdown for NON-ADMIN callers.
   *
   * 1. Ownership: a non-admin may only PATCH a delivery that belongs to
   *    their own Customer row. Everyone else gets a 403 (admins are
   *    exempt and may fix any delivery by hand).
   *
   * 2. Lifecycle-field lockdown: `status` (and the quote/customer
   *    relations that drive pricing) are owned by the lifecycle engine,
   *    the pricing-edit engine, and the create/promote paths — never by
   *    this generic PATCH. No FE caller sends them (verified across
   *    every caller), so they are silently stripped for non-admins:
   *    the state machine can no longer be bypassed by a crafted PATCH,
   *    while any legacy client keeps working.
   */
  private async guardDeliveryPatchOwnershipAndFields(
    deliveryId: string,
    data: any,
    request: Request,
  ): Promise<void> {
    if (this.isAdminRequest(request)) {
      return;
    }

    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true, customerId: true },
    });
    if (!delivery) {
      // Let the downstream handler produce the 404.
      return;
    }

    const sessionCustomerId = await this.resolveSessionCustomerId(request);
    if (!sessionCustomerId || delivery.customerId !== sessionCustomerId) {
      throw new common.ForbiddenException(
        "You can only edit your own deliveries"
      );
    }

    // Lifecycle/pricing-owned fields — stripped for non-admins.
    delete data.status;
    delete data.quote;
    delete data.quoteId;
    delete data.createdByUserId;
    delete data.resubmittedFromId;

    // customerId (scalar FK form used by the FE) must be the caller's own.
    if (
      data.customerId !== undefined &&
      data.customerId !== sessionCustomerId
    ) {
      throw new common.ForbiddenException(
        "customerId must match the authenticated session"
      );
    }
    // Relation form (never sent by the FE): validate then strip.
    if (data.customer !== undefined) {
      const connectedId =
        data.customer?.connect?.id ?? data.customer?.connect ?? undefined;
      if (
        connectedId !== undefined &&
        connectedId !== null &&
        connectedId !== sessionCustomerId
      ) {
        throw new common.ForbiddenException(
          "customer must match the authenticated session"
        );
      }
      delete data.customer;
    }
  }

  private async guardPricingFieldsForDealerEditableStatuses(
    deliveryId: string,
    data: any,
    request: Request,
  ): Promise<void> {
    // Resolve the actor's role from the auth payload.
    const user = (request as any).user as any;
    const actorRoles: EnumUserRoles[] = Array.isArray(user?.roles)
      ? user.roles
      : user?.roles
        ? [user.roles]
        : [];
    const isAdmin = actorRoles.includes(EnumUserRoles.ADMIN);
    if (isAdmin) {
      // Admins can PATCH pricing fields directly when fixing things manually.
      return;
    }

    // Check whether the PATCH body touches any pricing-edit-controlled field.
    // We check both the scalar form (quoteId) and the relation form (quote: { connect }).
    const touchedFields = this.detectPricingFieldChanges(data);
    if (touchedFields.length === 0) {
      return; // PATCH only touches non-pricing fields (schedule, vehicle, etc.) — fine.
    }

    // Load the delivery's current status to decide if the lockdown applies.
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true, status: true },
    });
    if (!delivery) {
      // Let the downstream handler return the 404 — not our problem here.
      return;
    }

    // DRAFT is always exempt — no Payment row, no Stripe auth to reconcile.
    // The dedicated draft-edit page (dealer-edit-draft.tsx) PATCHes addresses
    // and quote freely, and that's correct because no payment machinery has
    // touched the delivery yet.
    if (delivery.status === EnumDeliveryRequestStatus.DRAFT) {
      return;
    }

    // For QUOTED/LISTED/EXPIRED, a Payment row may exist (LISTED/EXPIRED) or
    // may not (QUOTED with no Payment yet). Either way, the pricing-edit
    // engine is the canonical path for changes to pricing-controlled fields
    // on these statuses, so the lockdown applies.
    const lockdownStatuses: EnumDeliveryRequestStatus[] = [
      EnumDeliveryRequestStatus.QUOTED,
      EnumDeliveryRequestStatus.LISTED,
      EnumDeliveryRequestStatus.EXPIRED,
    ];
    if (!lockdownStatuses.includes(delivery.status)) {
      // Status is not dealer-editable (e.g. BOOKED/ACTIVE/COMPLETED) — the
      // PATCH endpoint's own logic + role-based access control will reject
      // inappropriate changes. No need to enforce the lockdown here.
      return;
    }

    // Reject — the dealer must use POST /:id/edit-pricing instead.
    throw new common.BadRequestException({
      code: "PRICING_EDIT_VIA_PATCH_BLOCKED",
      message:
        `Pricing and address fields (${touchedFields.join(", ")}) cannot be ` +
          "changed via PATCH on a delivery in " + delivery.status + " status. " +
          "Please use POST /api/deliveryRequests/" + deliveryId + "/edit-pricing " +
          "instead — that endpoint handles Stripe reconciliation correctly.",
      details: {
        deliveryId,
        status: delivery.status,
        blockedFields: touchedFields,
        correctEndpoint: `POST /api/deliveryRequests/${deliveryId}/edit-pricing`,
      },
    });
  }

  /**
   * Inspect the PATCH body and return the list of pricing-edit-controlled
   * fields it touches. Returns an empty array if the PATCH only changes
   * non-pricing fields (schedule, vehicle, recipient, etc.).
   *
   * Controlled fields:
   *   - quoteId / quote (relation form)
   *   - pickupAddress / pickupLat / pickupLng / pickupPlaceId / pickupState
   *   - dropoffAddress / dropoffLat / dropoffLng / dropoffPlaceId / dropoffState
   */
  private detectPricingFieldChanges(data: any): string[] {
    if (!data || typeof data !== "object") {
      return [];
    }
    const touched: string[] = [];
    const controlledScalarFields = [
      "quoteId",
      "pickupAddress",
      "pickupLat",
      "pickupLng",
      "pickupPlaceId",
      "pickupState",
      "dropoffAddress",
      "dropoffLat",
      "dropoffLng",
      "dropoffPlaceId",
      "dropoffState",
    ];
    for (const field of controlledScalarFields) {
      if (data[field] !== undefined) {
        touched.push(field);
      }
    }
    // Also detect the relation form: `quote: { connect: {...} }` or `{ disconnect: true }`.
    if (data.quote !== undefined) {
      touched.push("quote");
    }
    return touched;
  }
}
