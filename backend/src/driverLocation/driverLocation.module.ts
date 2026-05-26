import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverLocationModuleBase } from "./base/driverLocation.module.base";
import { DriverLocationService } from "./driverLocation.service";
import { DriverLocationController } from "./driverLocation.controller";
import { DriverLocationResolver } from "./driverLocation.resolver";
import { DriverLocationDomain } from "src/domain/driverLocation/driverLocation.domain";
import { DriverLocationPolicyService } from "src/domain/driverLocation/driverLocationPolicy.service";

@Module({
  imports: [DriverLocationModuleBase, forwardRef(() => AuthModule)],
  controllers: [DriverLocationController],
  providers: [DriverLocationService, DriverLocationResolver, DriverLocationDomain, DriverLocationPolicyService],
  exports: [DriverLocationService],
})
export class DriverLocationModule {}
