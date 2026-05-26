import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverPreferenceModuleBase } from "./base/driverPreference.module.base";
import { DriverPreferenceService } from "./driverPreference.service";
import { DriverPreferenceController } from "./driverPreference.controller";
import { DriverPreferenceResolver } from "./driverPreference.resolver";
import { DriverPreferenceDomain } from "src/domain/driverPreference/driverPreference.domain";
import { DriverPreferencePolicyService } from "src/domain/driverPreference/driverPreferencePolicy.service";

@Module({
  imports: [DriverPreferenceModuleBase, forwardRef(() => AuthModule)],
  controllers: [DriverPreferenceController],
  providers: [DriverPreferenceService, DriverPreferenceResolver, DriverPreferenceDomain, DriverPreferencePolicyService],
  exports: [DriverPreferenceService],
})
export class DriverPreferenceModule {}
