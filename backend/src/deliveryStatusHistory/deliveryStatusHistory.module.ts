import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DeliveryStatusHistoryModuleBase } from "./base/deliveryStatusHistory.module.base";
import { DeliveryStatusHistoryService } from "./deliveryStatusHistory.service";
import { DeliveryStatusHistoryController } from "./deliveryStatusHistory.controller";
import { DeliveryStatusHistoryResolver } from "./deliveryStatusHistory.resolver";
import { DeliveryStatusHistoryDomain } from "src/domain/deliveryStatusHistory/deliveryStatusHistory.domain";
import { DeliveryStatusHistoryPolicyService } from "src/domain/deliveryStatusHistory/deliveryStatusHistoryPolicy.service";


@Module({
  imports: [DeliveryStatusHistoryModuleBase, forwardRef(() => AuthModule)],
  controllers: [DeliveryStatusHistoryController],
  providers: [DeliveryStatusHistoryService, DeliveryStatusHistoryResolver, DeliveryStatusHistoryDomain, DeliveryStatusHistoryPolicyService],
  exports: [DeliveryStatusHistoryService],
})
export class DeliveryStatusHistoryModule {}
