// src/appSetting/appSetting.public.controller.ts
import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { AppSettingService } from "./appSetting.service";
import { LandingPageSettingsResponseDto, ReferralProgramSettingsResponseDto } from "./dto/appSetting.dto";

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

  /**
   * GET /api/appSettings/public/referral-program
   *
   * Public referral program config (reward amount, trips required,
   * days to complete, max referrals). Used by the driver Wallet
   * page to render the "Refer a Friend" card without hardcoding
   * the reward amount.
   *
   * The values themselves are not secret — the reward policy is
   * advertised on the public home page too — so this endpoint is
   * intentionally public (no auth required). Auth is still applied
   * at the controller level by the global DefaultAuthGuard, but no
   * role check is enforced here.
   */
  @common.Get("referral-program")
  @swagger.ApiOperation({
    summary: "Public referral program settings (reward, trips, days, max)",
  })
  @swagger.ApiOkResponse({ type: ReferralProgramSettingsResponseDto })
  async getReferralProgramSettings(): Promise<ReferralProgramSettingsResponseDto> {
    return this.service.getReferralProgramSettings();
  }
}