// src/appSetting/appSetting.public.controller.ts
import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";

import { AppSettingService } from "./appSetting.service";
import {
  LandingPageSettingsResponseDto,
  ReferralProgramSettingsResponseDto,
  WhatsappSupportSettingsResponseDto,
} from "./dto/appSetting.dto";

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

  /**
   * GET /api/appSettings/public/whatsapp-support
   *
   * Public WhatsApp support link (admin-editable from the Config Hub).
   * Backs every "Message us on WhatsApp" button in the app so the link
   * can be rotated without a frontend redeploy.
   *
   * The link itself is shown to logged-out visitors on the help page,
   * so it is not secret — this endpoint is intentionally public (no
   * auth guard on this controller), following the same convention as
   * the landing-page and referral-program endpoints above.
   */
  @common.Get("whatsapp-support")
  @swagger.ApiOperation({
    summary: "Public WhatsApp support link (admin-editable)",
  })
  @swagger.ApiOkResponse({ type: WhatsappSupportSettingsResponseDto })
  async getWhatsappSupportSettings(): Promise<WhatsappSupportSettingsResponseDto> {
    return this.service.getWhatsappSupportSettings();
  }
}