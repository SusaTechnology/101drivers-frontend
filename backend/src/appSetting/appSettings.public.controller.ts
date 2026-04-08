// src/appSetting/appSetting.public.controller.ts
import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { AppSettingService } from "./appSetting.service";
import { LandingPageSettingsResponseDto } from "./dto/appSetting.dto";

@swagger.ApiTags("appSettings-public")
@common.Controller("appSettings/public")
export class AppSettingPublicController {
  constructor(protected readonly service: AppSettingService) {}

  @common.Get("landing-page")
  @swagger.ApiOperation({
    summary: "Public landing page settings",
  })
  @swagger.ApiOkResponse({ type: LandingPageSettingsResponseDto })
  async getLandingPageSettings(): Promise<LandingPageSettingsResponseDto> {
    return this.service.getLandingPageSettings();
  }
}