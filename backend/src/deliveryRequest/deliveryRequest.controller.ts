import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DeliveryRequestService } from "./deliveryRequest.service";
import { DeliveryRequestControllerBase } from "./base/deliveryRequest.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
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
} from "./dto/deliveryRequestLogistics.dto";
import { SupportRequestWhereUniqueInput } from "src/supportRequest/base/SupportRequestWhereUniqueInput";
import { SupportRequestFindManyArgs } from "src/supportRequest/base/SupportRequestFindManyArgs";
import { SupportRequest } from "src/supportRequest/base/SupportRequest";


@swagger.ApiTags("deliveryRequests")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
@common.Controller("deliveryRequests")
export class DeliveryRequestController extends DeliveryRequestControllerBase {
  constructor(
    protected readonly service: DeliveryRequestService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  @common.Get("counts")
  async count(@common.Req() request: Request): Promise<number> {
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
  @common.Body() body: CreateDeliveryDraftFromQuoteBody
): Promise<DeliveryRequest> {
  return this.service.createDeliveryDraftFromQuote({
    customerId: body.customerId,
    quoteId: body.quoteId,
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
    afterHours: body.afterHours === true,
    isUrgent: body.isUrgent === true,
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
  @common.Body() body: ForceCancelDeliveryAdminBody
): Promise<any> {
  return this.service.adminForceCancelDelivery({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason,
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
  @common.Body() body: OpenDisputeAdminBody
): Promise<any> {
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
  @common.Body() body: LegalHoldAdminBody
): Promise<any> {
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
  @common.Body() body: AssignDriverAdminBody
): Promise<any> {
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
  @common.Body() body: ReassignDeliveryAdminPatchBody
): Promise<any> {
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
  @common.Body() body: ApproveComplianceAdminBody
): Promise<any> {
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
  @common.Query() query: AdminDeliveryListQueryDto
): Promise<AdminDeliveryListResponseDto> {
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

@common.Get(":id/admin")
@swagger.ApiOkResponse({ type: AdminDeliveryDetailResponseDto })
@nestAccessControl.UseRoles({
  resource: "DeliveryRequest",
  action: "read",
  possession: "any",
})
async getAdminDeliveryDetail(
  @common.Param("id") id: string
): Promise<AdminDeliveryDetailResponseDto> {
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
  @common.Param("id") id: string
): Promise<any> {
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
  @common.Body() body: AdminInvoicePostpaidBody
): Promise<any> {
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
  @common.Body() body: AdminMarkPostpaidPaidBody
): Promise<any> {
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
  @common.Body() body: AdminMarkPayoutPaidBody
): Promise<any> {
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
  @common.Body() body: CancelDeliveryAdminBody
): Promise<any> {
  return this.service.adminCancelDelivery({
    deliveryId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason,
  });
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
  @common.Body() body: ReassignDeliveryAdminBody
): Promise<any> {
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
  @common.Body() body: QuotePreviewBody
): Promise<any> {
  return this.service.createQuotePreview({
    pickupAddress: body.pickupAddress,
    dropoffAddress: body.dropoffAddress,
    serviceType: body.serviceType,
    customerId: body.customerId ?? null,
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
    @common.Body() body: CreateDeliveryFromQuoteBody
  ): Promise<DeliveryRequest> {
    return this.service.createDeliveryFromAcceptedQuote({
      customerId: body.customerId,
      quoteId: body.quoteId,
      serviceType: body.serviceType,
      createdByUserId: body.createdByUserId ?? null,
      createdByRole: body.createdByRole ?? null,
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
      isUrgent: body.isUrgent === true,
      afterHours: body.afterHours === true,
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
  @common.Param("driverId") driverId: string
): Promise<any> {
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
  return this.service.getDriverJobFeed({
    driverId,
    limit: limit ? Number(limit) : undefined,
    cursor: cursor ?? null,
    urgentOnly: urgentOnly === "true",
    serviceType: serviceType ?? null,
    search: search ?? null,
    radiusMiles:
      radiusMiles !== undefined && radiusMiles !== null && radiusMiles !== ""
        ? Number(radiusMiles)
        : null,
    datePreset: datePreset ?? "ALL",
    sortBy: sortBy ?? "BEST_MATCH",
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
  @common.Param("deliveryId") deliveryId: string
): Promise<any> {
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
    @common.Body() body: BookDeliveryBody
  ): Promise<DeliveryRequest> {
    return this.service.bookDelivery({
      deliveryId: params.id,
      driverId: body.driverId,
      bookedByUserId: body.bookedByUserId ?? null,
      reason: body.reason ?? null,
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
    @common.Body() body: TransitionDeliveryStatusBody
  ): Promise<DeliveryRequest> {
    return this.service.transitionDeliveryStatus({
      deliveryId: params.id,
      toStatus: body.toStatus,
      actorUserId: body.actorUserId ?? null,
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

    return this.service.ingestDriverLocation({
      userId: user?.id,
      lat: Number(body.lat),
      lng: Number(body.lng),
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
    @common.Body() body: CreateTrackingLinkBody
  ): Promise<TrackingLinkResponseBody> {
    return this.service.createTrackingLink({
      deliveryId: params.id,
      expiresInHours: body.expiresInHours ?? 24,
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
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<TrackingLinkResponseBody> {
    return this.service.getTrackingLink({
      deliveryId: params.id,
    });
  }

  @common.Get("public/tracking/:token")
  @common.UseGuards()
  @swagger.ApiOkResponse({ type: Object })
  async getPublicTracking(
    @common.Param("token") token: string
  ): Promise<any> {
    return this.service.getPublicTracking({
      token,
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
  @common.Body() body: StartTripBody
): Promise<DeliveryRequest> {
  return this.service.startTrip({
    deliveryId: params.id,
    driverId: body.driverId,
    actorUserId: body.actorUserId ?? null,
    actorRole: body.actorRole ?? null,
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
  @common.Body() body: CompleteTripBody
): Promise<DeliveryRequest> {
  return this.service.completeTrip({
    deliveryId: params.id,
    driverId: body.driverId,
    actorUserId: body.actorUserId ?? null,
    actorRole: body.actorRole ?? null,
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
  @common.Body() body: SubmitPickupComplianceBody
): Promise<DeliveryRequest> {
  return this.service.submitPickupCompliance({
    deliveryId: params.id,
    driverId: body.driverId,
    vinVerificationCode: body.vinVerificationCode,
    odometerStart: body.odometerStart,
    photos: body.photos ?? [],
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
  @common.Body() body: SubmitDropoffComplianceBody
): Promise<DeliveryRequest> {
  return this.service.submitDropoffCompliance({
    deliveryId: params.id,
    driverId: body.driverId,
    odometerEnd: body.odometerEnd,
    photos: body.photos ?? [],
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
  @common.Param("driverId") driverId: string
): Promise<any> {
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
  @common.Body() body: CancelDeliveryBody
): Promise<DeliveryRequest> {
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
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<DeliveryRequest | null> {
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
    @common.Body() data: DeliveryRequestUpdateInput
  ): Promise<DeliveryRequest | null> {
    try {
      return await this.service.updateDeliveryRequest({
        where: params,
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
    @common.Param() params: DeliveryRequestWhereUniqueInput
  ): Promise<DeliveryRequest | null> {
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
}
