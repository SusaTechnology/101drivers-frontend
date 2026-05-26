import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DeliveryComplianceModuleBase } from "./base/deliveryCompliance.module.base";
import { DeliveryComplianceService } from "./deliveryCompliance.service";
import { DeliveryComplianceController } from "./deliveryCompliance.controller";
import { DeliveryComplianceResolver } from "./deliveryCompliance.resolver";
import { DeliveryComplianceDomain } from "src/domain/deliveryCompliance/deliveryCompliance.domain";
import { DeliveryCompliancePolicyService } from "src/domain/deliveryCompliance/deliveryCompliancePolicy.service";

@Module({
  imports: [DeliveryComplianceModuleBase, forwardRef(() => AuthModule)],
  controllers: [DeliveryComplianceController],
  providers: [DeliveryComplianceService, DeliveryComplianceResolver, DeliveryComplianceDomain, DeliveryCompliancePolicyService],
  exports: [DeliveryComplianceService],
})
export class DeliveryComplianceModule {}
