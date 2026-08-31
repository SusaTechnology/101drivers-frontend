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

  // ============================================================
  // CUSTOMER-REFERRER ENDPOINTS (Phase 2)
  // ============================================================
  // Customer referrers use Customer.referralCode (not Driver.referralCode)
  // and earn ReferralCredit rows (per-delivery credits applied to their
  // next Stripe invoice). All endpoints require authentication; the
  // caller's Customer profile is resolved from their JWT userId.

  /**
   * GET /referrals/my-customer-referral-code
   * Get or create the customer's unique referral code. The code is
   * stored on Customer.referralCode (V2 schema).
   */
  @common.Get("my-customer-referral-code")
  @swagger.ApiOkResponse({ description: "Customer's referral code" })
  async getMyCustomerReferralCode(
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const customerId = await this.referralService.resolveCustomerId(req);
    const referralCode = await this.referralService.getMyCustomerReferralCode(customerId);
    res.json({ referralCode });
  }

  /**
   * POST /referrals/my-customer-referral-code
   * Set a custom referral code for the customer (instead of the auto-generated one).
   * Validates the code against the regex + blocklist + collision check.
   * Once set, the code is locked and cannot be changed.
   *
   * Body: { referralCode: string }
   */
  @common.Post("my-customer-referral-code")
  @swagger.ApiOkResponse({ description: "Customer referral code set" })
  async setMyCustomerReferralCode(
    @common.Body() body: { referralCode: string },
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const customerId = await this.referralService.resolveCustomerId(req);
    const referralCode = await this.referralService.setMyCustomerReferralCode(
      customerId,
      body.referralCode,
    );
    res.json({ referralCode });
  }

  /**
   * POST /referrals/my-driver-referral-code
   * Set a custom referral code for the driver (instead of the auto-generated one).
   * Validates the code against the regex + blocklist + collision check.
   * Once set, the code is locked and cannot be changed.
   *
   * Body: { referralCode: string }
   */
  @common.Post("my-driver-referral-code")
  @swagger.ApiOkResponse({ description: "Driver referral code set" })
  async setMyDriverReferralCode(
    @common.Body() body: { referralCode: string },
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const driverId = await this.referralService.resolveDriverId(req);
    const referralCode = await this.referralService.setMyDriverReferralCode(
      driverId,
      body.referralCode,
    );
    res.json({ referralCode });
  }

  /**
   * GET /referrals/my-customer-referrals
   * List all referrals made by this customer (dealer or private).
   */
  @common.Get("my-customer-referrals")
  @swagger.ApiOkResponse({ description: "Customer's referrals" })
  async getMyCustomerReferrals(
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const customerId = await this.referralService.resolveCustomerId(req);
    const referrals = await this.referralService.getMyCustomerReferrals(customerId);
    res.json({ referrals });
  }

  /**
   * GET /referrals/my-customer-referral-stats
   * Get referral stats for a customer referrer (total credits earned, pending,
   * active count, etc.).
   */
  @common.Get("my-customer-referral-stats")
  @swagger.ApiOkResponse({ description: "Customer referral stats" })
  async getMyCustomerReferralStats(
    @common.Req() req: any,
    @common.Res() res: Response,
  ): Promise<void> {
    const customerId = await this.referralService.resolveCustomerId(req);
    const stats = await this.referralService.getMyCustomerReferralStats(customerId);
    res.json(stats);
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
   * Query params: page (default 1), pageSize (default 20), search (by name),
   * referralType ("DRIVER" or "CUSTOMER", default "DRIVER").
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
    @common.Query("referralType") referralType?: "DRIVER" | "CUSTOMER",
  ): Promise<any> {
    return this.referralService.getAdminReferrersList({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      search: search || undefined,
      referralType: referralType || undefined,
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

  // ============================================================
  // ADMIN ENDPOINTS (Phase 3) — referrals list, detail, manual override
  // ============================================================

  /**
   * GET /referrals/admin/referrals
   * Paginated list of ALL referrals (admin view). Supports filtering by
   * referralType, payoutModel, status, and search by referralCode or
   * referredEmail.
   *
   * Query params:
   *   - page (default 1)
   *   - pageSize (default 20)
   *   - referralType ("DRIVER" or "CUSTOMER")
   *   - payoutModel ("TIERED" or "PER_DELIVERY")
   *   - status (any EnumReferralStatus value)
   *   - search (matches referralCode or referredEmail, case-insensitive)
   */
  @common.Get("admin/referrals")
  @swagger.ApiOkResponse({ description: "Paginated list of all referrals" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getAdminReferralsList(
    @common.Query("page") page?: string,
    @common.Query("pageSize") pageSize?: string,
    @common.Query("referralType") referralType?: "DRIVER" | "CUSTOMER",
    @common.Query("payoutModel") payoutModel?: "TIERED" | "PER_DELIVERY",
    @common.Query("status") status?: string,
    @common.Query("search") search?: string,
  ): Promise<any> {
    return this.referralService.getAdminReferralsList({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      referralType: referralType || undefined,
      payoutModel: payoutModel || undefined,
      status: status || undefined,
      search: search || undefined,
    });
  }

  /**
   * GET /referrals/admin/referrals/:referralId
   * Detail view for a single referral — full info including the
   * associated ReferralCredit rows + DriverPayout rows.
   */
  @common.Get("admin/referrals/:referralId")
  @swagger.ApiOkResponse({ description: "Referral detail with credits + payouts" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getAdminReferralDetail(
    @common.Param("referralId") referralId: string,
  ): Promise<any> {
    return this.referralService.getAdminReferralDetail(referralId);
  }

  /**
   * POST /referrals/admin/referrals/:referralId/override-status
   * Manual override: admin sets the status of a referral.
   *
   * Allowed transitions:
   *   - any non-terminal → REWARD_PAID (force-fires the one-shot referred reward)
   *   - any → EXPIRED (admin manually expires)
   *   - any → CLOSED (admin closes without payout)
   *
   * Refuses to transition FROM REWARD_PAID (would require a clawback).
   *
   * Body: { status: "REWARD_PAID" | "EXPIRED" | "CLOSED", reason?: string }
   */
  @common.Post("admin/referrals/:referralId/override-status")
  @swagger.ApiOkResponse({ description: "Referral status overridden" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "update",
    possession: "any",
  })
  async manualOverrideReferralStatus(
    @common.Param("referralId") referralId: string,
    @common.Body() body: { status: "REWARD_PAID" | "EXPIRED" | "CLOSED"; reason?: string },
  ): Promise<any> {
    return this.referralService.manualOverrideReferralStatus(
      referralId,
      body.status,
      body.reason,
    );
  }

  // ============================================================
  // ADMIN ENDPOINTS (Phase 3) — ReferralCredit list + manual override
  // ============================================================

  /**
   * GET /referrals/admin/credits
   * Paginated list of all ReferralCredit rows (admin view). Supports
   * filtering by status, customerId, referralId.
   *
   * Query params:
   *   - page (default 1)
   *   - pageSize (default 20)
   *   - status ("PENDING" | "APPLIED" | "EXPIRED")
   *   - customerId
   *   - referralId
   */
  @common.Get("admin/credits")
  @swagger.ApiOkResponse({ description: "Paginated list of all ReferralCredit rows" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getAdminReferralCreditsList(
    @common.Query("page") page?: string,
    @common.Query("pageSize") pageSize?: string,
    @common.Query("status") status?: "PENDING" | "APPLIED" | "EXPIRED",
    @common.Query("customerId") customerId?: string,
    @common.Query("referralId") referralId?: string,
  ): Promise<any> {
    return this.referralService.getAdminReferralCreditsList({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      status: status || undefined,
      customerId: customerId || undefined,
      referralId: referralId || undefined,
    });
  }

  /**
   * POST /referrals/admin/credits/:creditId/apply
   * Manual apply: admin marks a PENDING ReferralCredit as APPLIED.
   *
   * Body: { stripeInvoiceId?: string }
   */
  @common.Post("admin/credits/:creditId/apply")
  @swagger.ApiOkResponse({ description: "ReferralCredit applied" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "update",
    possession: "any",
  })
  async manualApplyReferralCredit(
    @common.Param("creditId") creditId: string,
    @common.Body() body: { stripeInvoiceId?: string },
  ): Promise<any> {
    return this.referralService.manualApplyReferralCredit(creditId, body.stripeInvoiceId);
  }

  /**
   * POST /referrals/admin/credits/:creditId/expire
   * Manual expire: admin marks a PENDING ReferralCredit as EXPIRED.
   *
   * Body: { reason?: string }
   */
  @common.Post("admin/credits/:creditId/expire")
  @swagger.ApiOkResponse({ description: "ReferralCredit expired" })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "update",
    possession: "any",
  })
  async manualExpireReferralCredit(
    @common.Param("creditId") creditId: string,
    @common.Body() body: { reason?: string },
  ): Promise<any> {
    return this.referralService.manualExpireReferralCredit(creditId, body.reason);
  }
}
