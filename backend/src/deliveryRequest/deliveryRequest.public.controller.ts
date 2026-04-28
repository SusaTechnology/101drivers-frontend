import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { DeliveryRequestService } from "./deliveryRequest.service";
import {
  CreateIndividualDeliveryFromQuoteBody,
  CreateIndividualDeliveryDraftFromQuoteBody,
  IndividualQuotePreviewBody,
} from "./dto/deliveryRequestLogistics.dto";
import {
  CreateIndividualDeliveryFromQuoteResult,
} from "../delivery-logistics/delivery-request-orchestrator.service";

@swagger.ApiTags("deliveryRequests-public")
@common.Controller("deliveryRequests")
export class DeliveryRequestPublicController {
  constructor(protected readonly service: DeliveryRequestService) {}
@common.Post("individual/create-draft-from-quote")
@swagger.ApiOperation({
  summary: "Public save draft delivery from quote for individual flow",
})
@swagger.ApiOkResponse({ type: Object })
async createIndividualDeliveryDraftFromQuote(
  @common.Body() body: CreateIndividualDeliveryDraftFromQuoteBody
): Promise<any> {
  return this.service.createIndividualDeliveryDraftFromQuote({
    customerId: body.customerId ?? null,
    customerEmail: body.customerEmail ?? null,
    customerName: body.customerName ?? null,
    customerPhone: body.customerPhone ?? null,

    quoteId: body.quoteId,
    serviceType: body.serviceType,

    savedVehicleId: body.savedVehicleId ?? null,
    saveVehicleForFuture: body.saveVehicleForFuture === true,

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
  @common.Post("individual/quote-preview")
  @swagger.ApiOperation({
    summary: "Public quote preview for individual landing-page flow",
  })
  @swagger.ApiOkResponse({ type: Object })
  async createIndividualQuotePreview(
    @common.Body() body: IndividualQuotePreviewBody
  ): Promise<any> {
    return this.service.createQuotePreview({
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
      serviceType: body.serviceType,
      customerId: body.customerId ?? null,
    });
  }

  @common.Post("individual/create-from-quote")
  @swagger.ApiOperation({
    summary: "Public create delivery from accepted quote for individual flow",
  })
  @swagger.ApiOkResponse({ type: Object })
  async createIndividualDeliveryFromAcceptedQuote(
    @common.Body() body: CreateIndividualDeliveryFromQuoteBody
  ): Promise<CreateIndividualDeliveryFromQuoteResult> {
    return this.service.createIndividualDeliveryFromAcceptedQuote({
      customerId: body.customerId ?? null,
      customerEmail: body.customerEmail ?? null,
      customerName: body.customerName ?? null,
      customerPhone: body.customerPhone ?? null,
      otp: body.otp ?? null,
      password: body.password ?? null,

      quoteId: body.quoteId,
      serviceType: body.serviceType,

      savedVehicleId: body.savedVehicleId ?? null,
      saveVehicleForFuture: body.saveVehicleForFuture === true,

      pickupWindowStart: body.pickupWindowStart ?? null,
      pickupWindowEnd: body.pickupWindowEnd ?? null,
      dropoffWindowStart: body.dropoffWindowStart ?? null,
      dropoffWindowEnd: body.dropoffWindowEnd ?? null,

      licensePlate: body.licensePlate,
      vehicleColor: body.vehicleColor,
      vehicleMake: body.vehicleMake ?? null,
      vehicleModel: body.vehicleModel ?? null,
      vinVerificationCode: body.vinVerificationCode,

      recipientName: body.recipientName ?? null,
      recipientEmail: body.recipientEmail ?? null,
      recipientPhone: body.recipientPhone ?? null,

      afterHours: body.afterHours === true,
      isUrgent: body.isUrgent === true,
    });
  }
}