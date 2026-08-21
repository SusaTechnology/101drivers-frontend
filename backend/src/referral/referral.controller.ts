import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { Response } from "express";
import { ReferralService } from "./referral.service";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";

@swagger.ApiTags("referrals")
@common.Controller("referrals")
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard)
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  /**
   * GET /referrals/my-referral-code
   * Get or create the driver's unique referral code.
   */
  @common.Get("my-referral-code")
  @swagger.ApiOkResponse({ description: "Driver's referral code" })
  async getMyReferralCode(
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const driverId = await this.referralService.resolveDriverId(req);
    const referralCode = await this.referralService.getMyReferralCode(driverId);
    res.json({ referralCode });
  }

  /**
   * GET /referrals/my-referrals
   * List all referrals made by this driver with their status.
   */
  @common.Get("my-referrals")
  @swagger.ApiOkResponse({ description: "List of referrals" })
  async getMyReferrals(
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const driverId = await this.referralService.resolveDriverId(req);
    const referrals = await this.referralService.getMyReferrals(driverId);
    res.json({ referrals });
  }

  /**
   * GET /referrals/my-stats
   * Get referral stats: total earned, pending, active count, tier progress.
   */
  @common.Get("my-stats")
  @swagger.ApiOkResponse({ description: "Referral stats" })
  async getMyReferralStats(
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const driverId = await this.referralService.resolveDriverId(req);
    const stats = await this.referralService.getMyReferralStats(driverId);
    res.json(stats);
  }

  /**
   * POST /referrals/apply
   * Called when a new driver signs up with a referral code.
   */
  @common.Post("apply")
  @swagger.ApiOkResponse({ description: "Referral applied" })
  async applyReferral(
    @common.Body() body: { referralCode: string },
    @common.Req() req: any,
  ): Promise<any> {
    const driverId = await this.referralService.resolveDriverId(req);
    return this.referralService.applyReferral(driverId, body.referralCode);
  }

  /**
   * GET /referrals/driver-profile
   * Get driver profile info for the wallet page header.
   */
  @common.Get("driver-profile")
  @swagger.ApiOkResponse({ description: "Driver profile summary" })
  async getDriverProfile(
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const driverId = await this.referralService.resolveDriverId(req);
    const profile = await this.referralService.getDriverProfile(driverId);
    res.json(profile);
  }

  /**
   * GET /referrals/program-config
   * Returns the admin-configured referral program policy:
   *   - isActive (master on/off)
   *   - rewardTrigger (ON_APPROVED | ON_DELIVERIES_COMPLETED)
   *   - requiredDeliveries (when trigger = ON_DELIVERIES_COMPLETED)
   *   - timeLimitMode (CALENDAR_RANGE | FOREVER)
   *   - windowStartDate, windowEndDate (when CALENDAR_RANGE)
   *   - referrerRewardAmount ($ per tier)
   *   - referralThreshold (successful referrals per tier)
   *   - referredGetsReward (bool)
   *   - referredRewardAmount ($ one-shot to referred driver)
   *
   * Used by the driver Wallet page to render the "Refer a Friend"
   * card without hardcoding the reward amount.
   */
  @common.Get("program-config")
  @swagger.ApiOkResponse({ description: "Referral program configuration" })
  async getReferralProgramConfig(
    @common.Res() res: Response,
  ): Promise<void> {
    const config = await this.referralService.getMyReferralProgramConfig();
    res.json(config);
  }

  // ============================================================
  // ADMIN ENDPOINTS — for the /admin-referral-program page.
  // All guarded by nest-access-control with the AppSetting resource.
  // ============================================================

  /**
   * GET /referrals/admin/stats
   * Program-wide stats: total referrals, successful, active, expired,
   * total $ paid out, total $ pending, unique referrers.
   */
  @common.Get("admin/stats")
  @swagger.ApiOkResponse({ description: "Program-wide referral stats" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getAdminProgramStats(): Promise<any> {
    return this.referralService.getAdminProgramStats();
  }

  /**
   * GET /referrals/admin/referrers
   * Paginated list of referrers with their stats.
   * Query params: page (default 1), pageSize (default 20), search (by name).
   */
  @common.Get("admin/referrers")
  @swagger.ApiOkResponse({ description: "Paginated list of referrers" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getAdminReferrersList(
    @common.Query("page") page?: string,
    @common.Query("pageSize") pageSize?: string,
    @common.Query("search") search?: string,
  ): Promise<any> {
    return this.referralService.getAdminReferrersList({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      search: search || undefined,
    });
  }

  /**
   * GET /referrals/admin/referrers/:referrerId
   * Detail view for a single referrer — list of all their referrals
   * + tier payout history.
   */
  @common.Get("admin/referrers/:referrerId")
  @swagger.ApiOkResponse({ description: "Referrer detail with referrals + payouts" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getAdminReferrerDetail(
    @common.Param("referrerId") referrerId: string,
  ): Promise<any> {
    return this.referralService.getAdminReferrerDetail(referrerId);
  }
}
