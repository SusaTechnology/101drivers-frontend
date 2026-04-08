import { Module } from "@nestjs/common";
import { DeliveryLogisticsModule } from "src/delivery-logistics/delivery-logistics.module";
import { SchedulingPolicyEngine } from "src/domain/schedulingPolicy/schedulingPolicy.engine";

@Module({
  imports: [DeliveryLogisticsModule],
  providers: [SchedulingPolicyEngine],
  exports: [SchedulingPolicyEngine],
})
export class SchedulingPolicyEngineModule {}