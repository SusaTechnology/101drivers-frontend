import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverPayoutModuleBase } from "./base/driverPayout.module.base";
import { DriverPayoutService } from "./driverPayout.service";
import { DriverPayoutController } from "./driverPayout.controller";
import { DriverPayoutResolver } from "./driverPayout.resolver";
import { DriverPayoutDomain } from "src/domain/driverPayout/driverPayout.domain";
import { DriverPayoutPolicyService } from "src/domain/driverPayout/driverPayoutPolicy.service";
import { DeliveryLogisticsModule } from "src/delivery-logistics/delivery-logistics.module";

@Module({
  imports: [DriverPayoutModuleBase, forwardRef(() => AuthModule), DeliveryLogisticsModule],
  controllers: [DriverPayoutController],
  providers: [DriverPayoutService, DriverPayoutResolver, DriverPayoutDomain, DriverPayoutPolicyService],
  exports: [DriverPayoutService],
})
export class DriverPayoutModule {}
