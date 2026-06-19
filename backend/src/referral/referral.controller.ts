import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
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
   * Get referral stats: total earned, pending, active count.
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
}
