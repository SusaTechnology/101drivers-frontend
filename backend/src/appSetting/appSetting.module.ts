import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppSettingModuleBase } from "./base/appSetting.module.base";
import { AppSettingService } from "./appSetting.service";
import { AppSettingController } from "./appSetting.controller";
import { AppSettingResolver } from "./appSetting.resolver";
import { AppSettingDomain } from "src/domain/appSetting/appSetting.domain";
import { AppSettingPolicyService } from "src/domain/appSetting/appSettingPolicy.service";
import { AppSettingPublicController } from "./appSettings.public.controller";

@Module({
  imports: [AppSettingModuleBase, forwardRef(() => AuthModule)],
  controllers: [AppSettingController, AppSettingPublicController],
  providers: [AppSettingService, AppSettingResolver, AppSettingDomain, AppSettingPolicyService],
  exports: [AppSettingService],
})
export class AppSettingModule {}
