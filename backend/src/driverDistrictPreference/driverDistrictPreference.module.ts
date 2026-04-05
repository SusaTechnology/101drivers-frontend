import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverDistrictPreferenceModuleBase } from "./base/driverDistrictPreference.module.base";
import { DriverDistrictPreferenceService } from "./driverDistrictPreference.service";
import { DriverDistrictPreferenceController } from "./driverDistrictPreference.controller";
import { DriverDistrictPreferenceResolver } from "./driverDistrictPreference.resolver";
import { DriverDistrictPreferenceDomain } from "src/domain/driverDistrictPreference/driverDistrictPreference.domain";
import { DriverDistrictPreferencePolicyService } from "src/domain/driverDistrictPreference/driverDistrictPreferencePolicy.service";

@Module({
  imports: [DriverDistrictPreferenceModuleBase, forwardRef(() => AuthModule)],
  controllers: [DriverDistrictPreferenceController],
  providers: [
    DriverDistrictPreferenceService,
    DriverDistrictPreferenceResolver,
    DriverDistrictPreferenceDomain,
    DriverDistrictPreferencePolicyService
  ],
  exports: [DriverDistrictPreferenceService],
})
export class DriverDistrictPreferenceModule {}
