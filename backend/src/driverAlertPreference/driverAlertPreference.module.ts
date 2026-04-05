import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DriverAlertPreferenceModuleBase } from "./base/driverAlertPreference.module.base";
import { DriverAlertPreferenceService } from "./driverAlertPreference.service";
import { DriverAlertPreferenceController } from "./driverAlertPreference.controller";
import { DriverAlertPreferenceResolver } from "./driverAlertPreference.resolver";
import { DriverAlertPreferenceDomain } from "src/domain/driverAlertPreference/driverAlertPreference.domain";
import { DriverAlertPreferencePolicyService } from "src/domain/driverAlertPreference/driverAlertPreferencePolicy.service";

@Module({
  imports: [DriverAlertPreferenceModuleBase, forwardRef(() => AuthModule)],
  controllers: [DriverAlertPreferenceController],
  providers: [DriverAlertPreferenceService, DriverAlertPreferenceResolver, DriverAlertPreferenceDomain, DriverAlertPreferencePolicyService],
  exports: [DriverAlertPreferenceService],
})
export class DriverAlertPreferenceModule {}
