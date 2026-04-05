import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OperatingHourModuleBase } from "./base/operatingHour.module.base";
import { OperatingHourService } from "./operatingHour.service";
import { OperatingHourController } from "./operatingHour.controller";
import { OperatingHourResolver } from "./operatingHour.resolver";
import { OperatingHourPolicyService } from "src/domain/operationgHour/operatingHourPolicy.service";
import { OperatingHourDomain } from "src/domain/operationgHour/operatingHour.domain";

@Module({
  imports: [OperatingHourModuleBase, forwardRef(() => AuthModule)],
  controllers: [OperatingHourController],
  providers: [OperatingHourService, OperatingHourResolver, OperatingHourDomain, OperatingHourPolicyService ],
  exports: [OperatingHourService],
})
export class OperatingHourModule {}
