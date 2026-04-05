import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DeliveryRequestModuleBase } from "./base/deliveryRequest.module.base";
import { DeliveryRequestService } from "./deliveryRequest.service";
import { DeliveryRequestController } from "./deliveryRequest.controller";
import { DeliveryRequestResolver } from "./deliveryRequest.resolver";
import { DeliveryRequestPolicyService } from "src/domain/deliveryRequest/deliveryRequestPolicy.service";
import { DeliveryRequestDomain } from "src/domain/deliveryRequest/deliveryRequest.domain";
import { DeliveryLogisticsModule } from "../delivery-logistics/delivery-logistics.module";
import { DeliveryCancellationEngine } from "src/domain/deliveryRequest/deliveryCancellation.engine";
import { AdminDeliveryEngine } from "src/domain/deliveryRequest/adminDelivery.engine";
import { PaymentPayoutEngine } from "src/domain/deliveryRequest/paymentPayout.engine";
import { DeliveryRequestPublicController } from "./deliveryRequest.public.controller";
import { SchedulingPolicyEngineModule } from "../domain/schedulingPolicy/schedulingPolicy.module";

@Module({
  imports: [
    DeliveryRequestModuleBase,
    forwardRef(() => AuthModule),
    DeliveryLogisticsModule,
    SchedulingPolicyEngineModule,
  ],
  controllers: [DeliveryRequestController, DeliveryRequestPublicController],
  providers: [
    DeliveryRequestService,
    DeliveryRequestResolver,
    DeliveryRequestDomain,
    DeliveryRequestPolicyService,
    DeliveryCancellationEngine,
    AdminDeliveryEngine,
    PaymentPayoutEngine,
  ],
  exports: [DeliveryRequestService],
})
export class DeliveryRequestModule {}