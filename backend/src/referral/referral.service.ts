import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import {
  ReferralRewardTrigger,
  ReferralTimeLimitMode,
  ReferralPayoutModelDto,
  ReferralTypeDto,
} from "../appSetting/dto/appSetting.dto";
import {
  generateUniqueReferralCode,
  validateCustomReferralCode,
} from "./referral-code";
import {
  REFERRAL_REWARD_PAYOUT_PROVIDER,
  ReferralRewardPayoutProvider,
} from "./referral-payout-provider";

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingService: AppSettingService,
    @Inject(forwardRef(() => REFERRAL_REWARD_PAYOUT_PROVIDER))
    private readonly payoutProvider: ReferralRewardPayoutProvider,
  ) {}

  /**
   * Resolve the driver record from the authenticated user's JWT payload.
   * req.user only contains { id, username, roles } from the JWT — no profileId.
   */
  async resolveDriverId(req: any): Promise<string> {
    const userId = (req as any).user?.id;
    if (!userId) throw new NotFoundException("Not authenticated");

    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!driver) throw new NotFoundException("Driver profile not found");
    return driver.id;
  }

  /**
   * Resolve the customer record from the authenticated user's JWT payload.
   * Returns the Customer.id (NOT the User.id) — used for customer-referrer
   * endpoints so we can read/write Customer.referralCode directly.
   */
  async resolveCustomerId(req: any): Promise<string> {
    const userId = (req as any).user?.id;
    if (!userId) throw new NotFoundException("Not authenticated");

    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Customer profile not found");
    return customer.id;
  }

  /**
   * Get or create the driver's unique referral code.
   *
   * Phase 2 (V2): the code is stored on `Driver.referralCode` (a unique
   * column added by the 20260831120000_referral_v2 migration). For
   * backward compat, if a driver already has a code-holder `Referral` row
   * from the legacy flow but no `Driver.referralCode`, we migrate the
   * code onto `Driver.referralCode` on first read.
   *
   * NOTE: If the program isActive=false, we DON'T create a code-holder
   * row — the driver Wallet UI hides the "Refer a Friend" card, so the
   * driver won't reach this endpoint anyway. But we check here as a
   * safety net.
   */
  async getMyReferralCode(driverId: string): Promise<string> {
    // ── V2 path: read from Driver.referralCode ──
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { referralCode: true },
    });
    if (driver?.referralCode) {
      return driver.referralCode;
    }

    // Don't create new codes if the program is paused
    const config = await this.appSettingService.getReferralProgramSettings();
    if (!config.isActive) {
      throw new BadRequestException(
        "The referral program is currently paused. Please try again later."
      );
    }

    // ── Backward-compat: migrate from legacy code-holder Referral row ──
    const legacyReferral = await this.prisma.referral.findFirst({
      where: { referrerId: driverId },
      select: { referralCode: true },
    });
    if (legacyReferral?.referralCode) {
      // Try to migrate the code onto Driver.referralCode. If a race
      // produced a unique-constraint violation (another driver claimed
      // the same code in the meantime — extremely unlikely), fall
      // back to generating a fresh code.
      try {
        await this.prisma.driver.update({
          where: { id: driverId },
          data: { referralCode: legacyReferral.referralCode },
        });
        return legacyReferral.referralCode;
      } catch (err: any) {
        // P2002 = unique constraint — code clash, generate fresh
        if (err?.code !== "P2002") throw err;
        // fall through to fresh generation
      }
    }

    // ── Generate a fresh unique code ──
    const code = await this.generateUniqueCode();

    await this.prisma.driver.update({
      where: { id: driverId },
      data: { referralCode: code },
    });

    // Also create a code-holder Referral row for backward compat with
    // any code that still reads from the Referral table. New code
    // should read from Driver.referralCode directly.
    try {
      await this.prisma.referral.create({
        data: {
          referralCode: code,
          referrerId: driverId,
          status: "PENDING",
          referralType: ReferralTypeDto.DRIVER,
          payoutModel: ReferralPayoutModelDto.TIERED,
        },
      });
    } catch (err: any) {
      // P2002 = code clash on Referral.referralCode (rare). The Driver
      // row already has the code, which is what matters for V2 — the
      // legacy code-holder row is best-effort.
      if (err?.code !== "P2002") throw err;
    }

    return code;
  }

  /**
   * List all referrals made by this driver with their status.
   */
  async getMyReferrals(driverId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: driverId },
      select: {
        id: true,
        referredDriverId: true,
        referredEmail: true,
        referredDriver: {
          select: {
            id: true,
            user: { select: { fullName: true } },
            onboardingCompletedAt: true,
          },
        },
        status: true,
        tripsCompleted: true,
        requiredDeliveries: true,
        referredRewardAmount: true,
        referredRewardPaidAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter out the code-holder rows (no referredDriverId AND no
    // referredEmail) — those are just placeholders for the referrer's code.
    return referrals.filter((r) => r.referredDriverId || r.referredEmail);
  }

  /**
   * Get referral stats for the driver Wallet UI.
   *
   * Returns:
   *   - totalEarned: $ already paid to the driver from referral tier payouts
   *   - pendingReward: $ accrued but not yet paid (e.g. 19 successful → 0,
   *     25 successful → $150 pending because tier 2 needs 40)
   *   - successfulReferrals: count of referrals that became successful
   *     (status = REWARD_PAID)
   *   - activeReferrals: count of referrals in progress (not yet
   *     successful, not expired)
   *   - totalReferrals: total count of referrals made (excluding
   *     code-holder rows)
   *   - currentTier: which tier the referrer is currently on (1, 2, 3...)
   *   - nextTierProgress: % progress toward the next tier (0-100)
   *   - nextTierReferralsNeeded: # more successful referrals needed
   *     to cross the next tier
   *   - lastPaidTier: highest tier the referrer has been paid for
   */
  async getMyReferralStats(driverId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: driverId },
      select: {
        status: true,
        referredDriverId: true,
        referredEmail: true,
      },
    });

    // Real referrals only (exclude code-holder rows)
    const realReferrals = referrals.filter((r) => r.referredDriverId || r.referredEmail);

    let successfulReferrals = 0;
    let activeReferrals = 0;
    let expiredReferrals = 0;

    for (const r of realReferrals) {
      if (r.status === "REWARD_PAID") {
        successfulReferrals++;
      } else if (r.status === "EXPIRED" || r.status === "CLOSED") {
        expiredReferrals++;
      } else {
        // PENDING, REGISTERED, ONBOARDING_COMPLETE, TRIPPING, COMPLETED
        activeReferrals++;
      }
    }

    // Read the live config for tier math
    const config = await this.appSettingService.getReferralProgramSettings();
    const threshold = config.referralThreshold;
    const referrerRewardAmount = config.referrerRewardAmount;

    // Get the referrer's last paid tier (from the Driver row)
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { lastPaidReferrerTier: true },
    });
    const lastPaidTier = driver?.lastPaidReferrerTier ?? 0;

    // Compute total $ already paid via tier payouts (sum of REFERRAL_REFERRER payouts)
    const tierPayouts = await this.prisma.driverPayout.findMany({
      where: {
        driverId,
        type: "REFERRAL_REFERRER",
        status: { in: ["PAID", "PENDING", "ELIGIBLE"] },
      },
      select: { netAmount: true, status: true },
    });
    const totalEarned = tierPayouts
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.netAmount, 0);
    const pendingReward = tierPayouts
      .filter((p) => p.status === "PENDING" || p.status === "ELIGIBLE")
      .reduce((sum, p) => sum + p.netAmount, 0);

    // Compute current tier progress
    // E.g. threshold=20, successful=25 → currentTier=1 (already paid for 20),
    //      next tier is at 40, need 15 more, progress = 5/20 = 25%
    const currentTier = Math.floor(successfulReferrals / threshold);
    const referralsIntoCurrentTier = successfulReferrals - (currentTier * threshold);
    const nextTierReferralsNeeded = threshold - referralsIntoCurrentTier;
    const nextTierProgress = Math.round((referralsIntoCurrentTier / threshold) * 100);

    return {
      totalEarned,
      pendingReward,
      successfulReferrals,
      activeReferrals,
      expiredReferrals,
      totalReferrals: realReferrals.length,
      // Tier info
      threshold,
      referrerRewardAmount,
      lastPaidTier,
      currentTier,
      nextTierReferralsNeeded,
      nextTierProgress,
      // Program state (for the wallet UI to show paused notice)
      programIsActive: config.isActive,
    };
  }

  /**
   * Apply a referral code when a new driver signs up.
   *
   * Reads the admin-configured referral program settings and stamps
   * a SNAPSHOT of the per-referral policy onto the new Referral row.
   * This freezes:
   *   - rewardTrigger (ON_APPROVED or ON_DELIVERIES_COMPLETED)
   *   - requiredDeliveries (only used if trigger = ON_DELIVERIES_COMPLETED)
   *   - windowStartDate, windowEndDate, expiresAt (per-referral deadline)
   *   - referredGetsReward, referredRewardAmount (one-shot reward for the
   *     referred driver — null if referredGetsReward=false)
   *
   * The referrer-tier policy (referralThreshold, referrerRewardAmount)
   * is read LIVE at trigger time (not snapshotted) so the admin can
   * adjust incentives mid-program.
   *
   * Rejects the application if:
   *   - The program is paused (isActive=false)
   *   - The current date is outside the calendar window
   *     (when timeLimitMode=CALENDAR_RANGE)
   *   - The referrer is the same as the referred driver
   *   - The driver already used a referral code
   *
   * NO CAP on number of referrals — the referrer can refer as many
   * drivers as they want. Reward is per-tier, not per-referral.
   */
  async applyReferral(driverId: string, referralCode: string) {
    if (!referralCode) {
      throw new BadRequestException("referralCode is required");
    }

    // ── Phase 2 (V2): look up the referrer via the new path ──
    // A referral code can now belong to either a Driver (Driver.referralCode)
    // or a Customer (Customer.referralCode). The legacy path (Referral.referralCode
    // with a code-holder row) still works for backward compat.
    //
    // We support BOTH a Driver referrer (referralType=DRIVER) AND a Customer
    // referrer (referralType=CUSTOMER) referring a driver. The role matrix:
    //   - Driver→Driver: payoutModel=TIERED (legacy) or PER_DELIVERY (new)
    //   - Customer→Driver: payoutModel=PER_DELIVERY only (customer earns
    //     a credit per paid delivery, driver earns the $50-on-5th bonus)
    const upperCode = referralCode.toUpperCase();

    const [driverReferrer, customerReferrer, legacyReferral] = await Promise.all([
      this.prisma.driver.findFirst({
        where: { referralCode: upperCode },
        select: { id: true, referralCode: true, userId: true },
      }),
      this.prisma.customer.findFirst({
        where: { referralCode: upperCode },
        select: { id: true, referralCode: true, userId: true },
      }),
      this.prisma.referral.findFirst({
        where: { referralCode: upperCode, status: "PENDING" },
        select: { id: true, referrerId: true, referralCode: true },
      }),
    ]);

    // Resolve which referrer applies. Driver-side takes precedence (it's
    // the more specific case — a Driver.referralCode is the canonical V2
    // storage location for a driver referrer).
    let referrerDriverId: string | null = null;
    let referrerUserId: string | null = null;
    let referralType: ReferralTypeDto;
    let legacyReferralId: string | null = legacyReferral?.id ?? null;

    if (driverReferrer) {
      if (driverReferrer.id === driverId) {
        throw new BadRequestException("You cannot use your own referral code");
      }
      referrerDriverId = driverReferrer.id;
      referrerUserId = driverReferrer.userId;
      referralType = ReferralTypeDto.DRIVER;
    } else if (customerReferrer) {
      referrerUserId = customerReferrer.userId;
      referralType = ReferralTypeDto.CUSTOMER;
    } else if (legacyReferral) {
      // Legacy code-holder row — referrer must be a driver (pre-V2)
      if (legacyReferral.referrerId === driverId) {
        throw new BadRequestException("You cannot use your own referral code");
      }
      referrerDriverId = legacyReferral.referrerId;
      referralType = ReferralTypeDto.DRIVER;
    } else {
      throw new NotFoundException("Invalid or expired referral code");
    }

    // ── Per-referred-party uniqueness check ──
    // A driver can only have ONE referral applied. If they already used a
    // code (whether driver-referrer or customer-referrer), reject.
    const existingLink = await this.prisma.referral.findFirst({
      where: { referredDriverId: driverId },
      select: { id: true },
    });
    if (existingLink) {
      throw new BadRequestException("You already used a referral code");
    }

    // NOTE: We intentionally do NOT add late-application or circular-referral
    // guards here. Per the platform's referral model:
    //
    //   - The referral is a marketing strategy to bring NEW drivers to the
    //     platform. The relationship is established when someone applies
    //     a code; the PAYOUT timing is determined by the admin's trigger
    //     config (ON_APPROVED first-approval-only, or ON_DELIVERIES_COMPLETED
    //     X deliveries after first approval), NOT by when the code was applied.
    //
    //   - If a driver applies a code post-approval and the trigger is
    //     ON_APPROVED, the trigger never fires retroactively — the
    //     onDriverApproved hook only runs on the approval event itself,
    //     which already happened before the referral row existed. No payout.
    //
    //   - If the trigger is ON_DELIVERIES_COMPLETED and the driver applies
    //     late, the new Referral row starts at tripsCompleted=0 and the
    //     driver needs to complete X MORE deliveries to fire the payout.
    //     That's legitimate work — not an exploit.
    //
    //   - Circular farming (A↔B mutually referring each other) also can't
    //     double-pay: each driver's onDriverApproved only fires once on
    //     FIRST approval. If they were already approved before applying
    //     the other's code, no payout. If they apply before approval,
    //     each approval fires the other's trigger once — that's two
    //     legitimate new-driver payouts, not a duplicate.
    //
    // The "one-shot only" enforcement (referral.status === REWARD_PAID
    // guard in fireReferralSuccess) plus first-approval-only enforcement
    // in onDriverApproved are the real safeguards. Application timing
    // is the admin's concern, not the system's.

    // ── Read live config + validate program state ──────────────
    const config = await this.appSettingService.getReferralProgramSettings();

    if (!config.isActive) {
      throw new BadRequestException(
        "The referral program is currently paused. Please try again later."
      );
    }

    // ── Per-referrer-type gate ──
    // The admin can disable driver-referrer or customer-referrer flows
    // independently of the master isActive flag.
    if (referralType === ReferralTypeDto.DRIVER && !config.driverReferralsEnabled) {
      throw new BadRequestException(
        "Driver-to-driver referrals are currently disabled."
      );
    }
    if (referralType === ReferralTypeDto.CUSTOMER && !config.customerReferralsEnabled) {
      throw new BadRequestException(
        "Customer referrals are currently disabled."
      );
    }

    // Compute expiresAt + validate window
    let expiresAt: Date | null = null;
    let windowStartDate: Date | null = null;
    let windowEndDate: Date | null = null;
    const now = new Date();

    if (config.timeLimitMode === ReferralTimeLimitMode.CALENDAR_RANGE) {
      windowStartDate = config.windowStartDate ? new Date(config.windowStartDate) : null;
      windowEndDate = config.windowEndDate ? new Date(config.windowEndDate) : null;

      if (!windowStartDate || !windowEndDate) {
        throw new BadRequestException(
          "Referral program window is not properly configured. Please contact support."
        );
      }

      if (now < windowStartDate) {
        throw new BadRequestException(
          "The referral program hasn't started yet. Please try again later."
        );
      }

      if (now > windowEndDate) {
        throw new BadRequestException(
          "The referral program has ended. Please try again later."
        );
      }

      expiresAt = windowEndDate;
    }
    // else: FOREVER → expiresAt stays null

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { user: { select: { email: true } } },
    });

    // ── Determine payoutModel for this referral ──
    // For Driver→Driver: use the program's default payoutModel.
    // For Customer→Driver: always PER_DELIVERY (a customer referrer can
    // only earn per-delivery credits, not tier payouts).
    const payoutModel: ReferralPayoutModelDto =
      referralType === ReferralTypeDto.CUSTOMER
        ? ReferralPayoutModelDto.PER_DELIVERY
        : config.payoutModel;

    // ── Stamp the per-referral policy snapshot onto the new row ──
    // This freezes the policy at sign-up time so future admin changes
    // don't retroactively change pending referrals.
    await this.prisma.referral.create({
      data: {
        referralCode: upperCode,
        referrerId: referrerDriverId, // null when customer referrer
        referrerUserId,
        referredCustomerId: null,
        referredDriverId: driverId,
        referredEmail: driver?.user?.email || null,
        status: "REGISTERED",
        referralType,
        payoutModel,
        // Snapshot
        rewardTrigger: config.rewardTrigger,
        requiredDeliveries: config.requiredDeliveries,
        windowStartDate,
        windowEndDate,
        expiresAt,
        referredGetsReward: config.referredGetsReward,
        referredRewardAmount: config.referredGetsReward ? config.referredRewardAmount : null,
      },
    });

    // ── Best-effort: delete the legacy code-holder Referral row ──
    // If the referrer was found via Driver.referralCode or Customer.referralCode,
    // and a matching code-holder Referral row exists (status=PENDING, no
    // referredDriverId), remove it — its job is done. Best-effort, never
    // rethrows.
    if (legacyReferralId) {
      try {
        await this.prisma.referral.deleteMany({
          where: {
            id: legacyReferralId,
            referredDriverId: null,
            referredCustomerId: null,
            status: "PENDING",
          },
        });
      } catch {
        // ignore — best-effort cleanup
      }
    }

    return { success: true, message: "Referral code applied successfully" };
  }
  /**
   * Get driver profile info for the wallet page header.
   */
  async getDriverProfile(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        profilePhotoUrl: true,
        selfiePhotoUrl: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    const ratings = await this.prisma.deliveryRating.findMany({
      where: { driverId, stars: { gt: 0 } },
      select: { stars: true },
    });

    const avgRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length) * 10
          ) / 10
        : null;
    const totalRatings = ratings.length;

    const assignments = await this.prisma.deliveryAssignment.findMany({
      where: { driverId },
      select: { deliveryId: true },
    });

    const completedTrips = await this.prisma.deliveryRequest.count({
      where: {
        status: "COMPLETED",
        id: { in: assignments.map((a) => a.deliveryId) },
      },
    });

    return {
      fullName: driver?.user?.fullName || null,
      email: driver?.user?.email || null,
      profilePhotoUrl: driver?.profilePhotoUrl || driver?.selfiePhotoUrl || null,
      avgRating,
      totalRatings,
      completedTrips,
    };
  }

  /**
   * Generate a unique 8-character alphanumeric referral code.
   *
   * Uses the shared `generateUniqueReferralCode` helper from
   * `./referral-code` (blocklist + regex + collision-check). The exists()
   * predicate checks ALL existing code locations (Driver.referralCode,
   * Customer.referralCode, and Referral.referralCode) so a code never
   * collides across referrer types.
   */
  private async generateUniqueCode(): Promise<string> {
    return generateUniqueReferralCode(async (candidate) => {
      // Check Driver.referralCode, Customer.referralCode, and Referral.referralCode
      // (the legacy code-holder rows). All three columns are unique, so we OR them.
      const [driver, customer, referral] = await Promise.all([
        this.prisma.driver.findFirst({
          where: { referralCode: candidate },
          select: { id: true },
        }),
        this.prisma.customer.findFirst({
          where: { referralCode: candidate },
          select: { id: true },
        }),
        this.prisma.referral.findFirst({
          where: { referralCode: candidate },
          select: { id: true },
        }),
      ]);
      return !!(driver || customer || referral);
    });
  }

  /**
   * Get the admin-configured referral program config for the driver
   * Wallet UI. Returns the full config shape (isActive, rewardTrigger,
   * requiredDeliveries, timeLimitMode, windowStartDate, windowEndDate,
   * referrerRewardAmount, referralThreshold, referredGetsReward,
   * referredRewardAmount).
   *
   * Thin wrapper around AppSettingService so the driver can fetch
   * the config from the same /api/referrals namespace as the other
   * wallet endpoints, instead of hitting /api/appSettings.
   */
  async getMyReferralProgramConfig() {
    return this.appSettingService.getReferralProgramSettings();
  }

  // ============================================================
  // ADMIN ENDPOINTS — for the /admin-referral-program page
  // ============================================================

  /**
   * Program-wide stats for the admin dashboard.
   *
   * Returns counts + $ totals, broken down by model (TIERED vs PER_DELIVERY)
   * and by referrer type (Driver vs Customer). The admin dashboard uses
   * these to render the summary cards.
   *
   * Returns:
   *   - totalReferrals: count of all real referrals (excluding code-holder rows)
   *   - successfulReferrals: count where status = REWARD_PAID
   *   - activeReferrals: count in progress (PENDING/REGISTERED/etc.)
   *   - expiredReferrals: count where status = EXPIRED
   *   - uniqueReferrers: count of distinct referrerIds (driver referrers)
   *   - uniqueCustomerReferrers: count of distinct referrerUserIds (customer referrers)
   *   - totalPaidOut: sum of all REFERRAL_* payouts (status = PAID) in dollars
   *   - totalPending: sum of all REFERRAL_* payouts (status = PENDING/ELIGIBLE) in dollars
   *   - totalCreditsIssuedCents: sum of all ReferralCredit amountCents (status = PENDING or APPLIED)
   *   - totalCreditsAppliedCents: sum of all ReferralCredit amountCents (status = APPLIED)
   *   - perModel: { TIERED: { count }, PER_DELIVERY: { count } }
   *   - perReferrerType: { DRIVER: { count }, CUSTOMER: { count } }
   */
  async getAdminProgramStats() {
    const [
      totalReferrals,
      successfulReferrals,
      activeReferrals,
      expiredReferrals,
      uniqueDriverReferrersAgg,
      uniqueCustomerReferrersAgg,
      paidPayouts,
      pendingPayouts,
      creditsAgg,
      tieredCount,
      perDeliveryCount,
      driverTypeCount,
      customerTypeCount,
    ] = await Promise.all([
      this.prisma.referral.count({
        where: {
          OR: [
            { referredDriverId: { not: null } },
            { referredEmail: { not: null } },
            { referredCustomerId: { not: null } },
          ],
        },
      }),
      this.prisma.referral.count({ where: { status: "REWARD_PAID" } }),
      this.prisma.referral.count({
        where: {
          status: { in: ["PENDING", "REGISTERED", "ONBOARDING_COMPLETE", "TRIPPING", "COMPLETED"] },
        },
      }),
      this.prisma.referral.count({ where: { status: "EXPIRED" } }),
      // Unique driver referrers (referrerId IS NOT NULL)
      this.prisma.referral.groupBy({
        by: ["referrerId"],
        where: {
          referrerId: { not: null },
          OR: [
            { referredDriverId: { not: null } },
            { referredEmail: { not: null } },
            { referredCustomerId: { not: null } },
          ],
        },
        _count: { _all: true },
      }),
      // Unique customer referrers (referrerUserId IS NOT NULL, referralType = CUSTOMER)
      this.prisma.referral.groupBy({
        by: ["referrerUserId"],
        where: {
          referrerUserId: { not: null },
          referralType: "CUSTOMER",
          OR: [
            { referredDriverId: { not: null } },
            { referredEmail: { not: null } },
            { referredCustomerId: { not: null } },
          ],
        },
        _count: { _all: true },
      }),
      this.prisma.driverPayout.findMany({
        where: {
          type: { in: ["REFERRAL_REFERRER", "REFERRAL_REFERRED"] },
          status: "PAID",
        },
        select: { netAmount: true },
      }),
      this.prisma.driverPayout.findMany({
        where: {
          type: { in: ["REFERRAL_REFERRER", "REFERRAL_REFERRED"] },
          status: { in: ["PENDING", "ELIGIBLE"] },
        },
        select: { netAmount: true },
      }),
      // Aggregate ReferralCredit rows by status
      this.prisma.referralCredit.groupBy({
        by: ["status"],
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      // Count by payout model
      this.prisma.referral.count({ where: { payoutModel: "TIERED" } }),
      this.prisma.referral.count({ where: { payoutModel: "PER_DELIVERY" } }),
      // Count by referrer type
      this.prisma.referral.count({ where: { referralType: "DRIVER" } }),
      this.prisma.referral.count({ where: { referralType: "CUSTOMER" } }),
    ]);

    const totalPaidOut = paidPayouts.reduce((s, p) => s + p.netAmount, 0);
    const totalPending = pendingPayouts.reduce((s, p) => s + p.netAmount, 0);

    // Aggregate credits: PENDING + APPLIED = "issued", APPLIED = "applied to invoice"
    const creditsPending = creditsAgg.find((c) => c.status === "PENDING");
    const creditsApplied = creditsAgg.find((c) => c.status === "APPLIED");
    const totalCreditsIssuedCents =
      (creditsPending?._sum.amountCents ?? 0) + (creditsApplied?._sum.amountCents ?? 0);
    const totalCreditsAppliedCents = creditsApplied?._sum.amountCents ?? 0;

    return {
      totalReferrals,
      successfulReferrals,
      activeReferrals,
      expiredReferrals,
      uniqueReferrers: uniqueDriverReferrersAgg.length,
      uniqueCustomerReferrers: uniqueCustomerReferrersAgg.length,
      totalPaidOut,
      totalPending,
      totalCreditsIssuedCents,
      totalCreditsAppliedCents,
      perModel: {
        TIERED: { count: tieredCount },
        PER_DELIVERY: { count: perDeliveryCount },
      },
      perReferrerType: {
        DRIVER: { count: driverTypeCount },
        CUSTOMER: { count: customerTypeCount },
      },
    };
  }
  /**
   * Paginated list of referrers with their stats.
   *
   * Returns referrer name, # of referrals, # successful, # trips total
   * across all their referrals, $ earned from referrals.
   *
   * For the admin table on /admin-referral-program.
   *
   * Phase 2 (V2): supports a `referralType` filter ("DRIVER" or "CUSTOMER")
   * to switch between driver referrers (referrerId IS NOT NULL) and
   * customer referrers (referrerUserId IS NOT NULL, referralType=CUSTOMER).
   * Default: "DRIVER" (legacy behavior).
   */
  async getAdminReferrersList(opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    referralType?: "DRIVER" | "CUSTOMER";
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const referralType = opts.referralType ?? "DRIVER";

    if (referralType === "CUSTOMER") {
      // Customer referrers — list distinct referrerUserIds
      const rows = await this.prisma.referral.findMany({
        where: {
          referrerUserId: { not: null },
          referralType: "CUSTOMER",
          OR: [
            { referredDriverId: { not: null } },
            { referredEmail: { not: null } },
            { referredCustomerId: { not: null } },
          ],
          ...(opts.search
            ? {
                referrerUser: {
                  fullName: { contains: opts.search, mode: "insensitive" },
                },
              }
            : {}),
        },
        distinct: ["referrerUserId"],
        select: { referrerUserId: true },
      });
      const allIds = rows
        .map((r) => r.referrerUserId)
        .filter((id): id is string => !!id);
      const total = allIds.length;
      const pagedIds = allIds.slice(skip, skip + pageSize);

      if (pagedIds.length === 0) {
        return { referrers: [], total, page, pageSize };
      }

      // For each customer referrer, get their stats
      const referrers = await Promise.all(
        pagedIds.map(async (referrerUserId) => {
          const user = await this.prisma.user.findUnique({
            where: { id: referrerUserId },
            select: { id: true, fullName: true, email: true },
          });
          const customer = await this.prisma.customer.findUnique({
            where: { userId: referrerUserId },
            select: { id: true, businessName: true, contactName: true, customerType: true },
          });

          const referrals = await this.prisma.referral.findMany({
            where: {
              referrerUserId,
              referralType: "CUSTOMER",
              OR: [
                { referredDriverId: { not: null } },
                { referredEmail: { not: null } },
                { referredCustomerId: { not: null } },
              ],
            },
            select: { status: true, completedPaidDeliveries: true },
          });

          const successfulReferrals = referrals.filter((r) => r.status === "REWARD_PAID").length;
          const totalPaidDeliveries = referrals.reduce(
            (s, r) => s + (r.completedPaidDeliveries || 0),
            0,
          );

          // Sum of all ReferralCredit rows applied to this customer's invoices
          const credits = await this.prisma.referralCredit.findMany({
            where: { customerId: customer?.id, status: "APPLIED" },
            select: { amountCents: true },
          });
          const totalEarnedCents = credits.reduce((s, c) => s + c.amountCents, 0);

          return {
            referrerId: customer?.id ?? referrerUserId,
            referrerUserId,
            referrerName:
              customer?.businessName || customer?.contactName || user?.fullName || "Unknown",
            referrerEmail: user?.email || null,
            referrerType: "CUSTOMER",
            customerType: customer?.customerType ?? null,
            totalReferrals: referrals.length,
            successfulReferrals,
            totalPaidDeliveries,
            totalEarnedCents,
          };
        }),
      );

      return { referrers, total, page, pageSize };
    }

    // ── Driver referrers (legacy) ──
    // Find all referrerIds that have at least one real referral.
    const referrerRows = await this.prisma.referral.findMany({
      where: {
        referrerId: { not: null },
        OR: [
          { referredDriverId: { not: null } },
          { referredEmail: { not: null } },
        ],
        ...(opts.search
          ? {
              referrer: {
                user: {
                  fullName: { contains: opts.search, mode: "insensitive" },
                },
              },
            }
          : {}),
      },
      distinct: ["referrerId"],
      select: { referrerId: true },
    });

    const allIds = referrerRows
      .map((r) => r.referrerId)
      .filter((id): id is string => !!id);
    const total = allIds.length;
    const pagedIds = allIds.slice(skip, skip + pageSize);

    if (pagedIds.length === 0) {
      return {
        referrers: [],
        total,
        page,
        pageSize,
      };
    }

    // For each referrer, get their stats
    const referrers = await Promise.all(
      pagedIds.map(async (referrerId) => {
        const driver = await this.prisma.driver.findUnique({
          where: { id: referrerId },
          select: {
            id: true,
            user: { select: { fullName: true, email: true } },
            lastPaidReferrerTier: true,
          },
        });

        const referrals = await this.prisma.referral.findMany({
          where: {
            referrerId,
            OR: [
              { referredDriverId: { not: null } },
              { referredEmail: { not: null } },
            ],
          },
          select: {
            status: true,
            tripsCompleted: true,
            referredRewardAmount: true,
          },
        });

        const successfulReferrals = referrals.filter((r) => r.status === "REWARD_PAID").length;
        const totalTrips = referrals.reduce((s, r) => s + (r.tripsCompleted || 0), 0);

        // Sum of all referrer-tier payouts for this driver
        const payouts = await this.prisma.driverPayout.findMany({
          where: {
            driverId: referrerId,
            type: "REFERRAL_REFERRER",
            status: "PAID",
          },
          select: { netAmount: true },
        });
        const totalEarned = payouts.reduce((s, p) => s + p.netAmount, 0);

        return {
          referrerId,
          referrerName: driver?.user?.fullName || "Unknown",
          referrerEmail: driver?.user?.email || null,
          referrerType: "DRIVER",
          totalReferrals: referrals.length,
          successfulReferrals,
          totalTrips,
          totalEarned,
          lastPaidTier: driver?.lastPaidReferrerTier ?? 0,
        };
      }),
    );

    return {
      referrers,
      total,
      page,
      pageSize,
    };
  }
  /**
   * Detail view for a single referrer — list of all their referrals
   * with per-referral status, trips progress, reward amount, paid date.
   *
   * For the admin detail dialog when a referrer row is clicked.
   */
  async getAdminReferrerDetail(referrerId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: referrerId },
      select: {
        id: true,
        user: { select: { fullName: true, email: true } },
        lastPaidReferrerTier: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Referrer not found");
    }

    const referrals = await this.prisma.referral.findMany({
      where: {
        referrerId,
        OR: [
          { referredDriverId: { not: null } },
          { referredEmail: { not: null } },
        ],
      },
      select: {
        id: true,
        status: true,
        tripsCompleted: true,
        requiredDeliveries: true,
        referredRewardAmount: true,
        referredRewardPaidAt: true,
        rewardTrigger: true,
        expiresAt: true,
        createdAt: true,
        referredDriver: {
          select: {
            id: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        referredEmail: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Sum of referrer-tier payouts
    const payouts = await this.prisma.driverPayout.findMany({
      where: {
        driverId: referrerId,
        type: "REFERRAL_REFERRER",
      },
      select: { id: true, netAmount: true, status: true, createdAt: true, paidAt: true, failureMessage: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      referrer: {
        id: driver.id,
        name: driver.user?.fullName || "Unknown",
        email: driver.user?.email || null,
        lastPaidTier: driver.lastPaidReferrerTier,
      },
      referrals: referrals.map((r) => ({
        id: r.id,
        referredName: r.referredDriver?.user?.fullName || r.referredEmail || "Unknown",
        status: r.status,
        tripsCompleted: r.tripsCompleted,
        requiredDeliveries: r.requiredDeliveries,
        rewardTrigger: r.rewardTrigger,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        referredRewardAmount: r.referredRewardAmount,
        referredRewardPaidAt: r.referredRewardPaidAt,
      })),
      tierPayouts: payouts.map((p) => ({
        id: p.id,
        amount: p.netAmount,
        status: p.status,
        tierNumber: p.failureMessage?.startsWith("TIER:")
          ? parseInt(p.failureMessage.slice(5), 10)
          : null,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      })),
    };
  }

    // ============================================================
  // ADMIN ENDPOINTS (Phase 3) — referrals list, detail, manual override
  // ============================================================

  /**
   * Paginated list of ALL referrals (admin view). Supports filtering by
   * referralType, payoutModel, status, and search by referralCode or
   * referredEmail.
   *
   * Returns each referral with:
   *   - id, referralCode, status, referralType, payoutModel
   *   - referredEmail, referredDriver (with user), referredCustomer (with contactName/businessName)
   *   - referrer (driver referrer) or referrerUser (customer referrer)
   *   - tripsCompleted, completedPaidDeliveries
   *   - createdAt, expiresAt
   */
  async getAdminReferralsList(opts: {
    page?: number;
    pageSize?: number;
    referralType?: "DRIVER" | "CUSTOMER";
    payoutModel?: "TIERED" | "PER_DELIVERY";
    status?: string;
    search?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: any = {
      // Exclude code-holder rows (no referred party)
      OR: [
        { referredDriverId: { not: null } },
        { referredEmail: { not: null } },
        { referredCustomerId: { not: null } },
      ],
    };
    if (opts.referralType) where.referralType = opts.referralType;
    if (opts.payoutModel) where.payoutModel = opts.payoutModel;
    if (opts.status) where.status = opts.status;
    if (opts.search) {
      where.AND = [
        {
          OR: [
            { referralCode: { contains: opts.search, mode: "insensitive" } },
            { referredEmail: { contains: opts.search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const [referrals, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        select: {
          id: true,
          referralCode: true,
          status: true,
          referralType: true,
          payoutModel: true,
          referredEmail: true,
          referredDriverId: true,
          referredCustomerId: true,
          referrerId: true,
          referrerUserId: true,
          tripsCompleted: true,
          completedPaidDeliveries: true,
          requiredDeliveries: true,
          rewardTrigger: true,
          referredGetsReward: true,
          referredRewardAmount: true,
          referredRewardPaidAt: true,
          expiresAt: true,
          createdAt: true,
          referredDriver: {
            select: { id: true, user: { select: { id: true, fullName: true, email: true } } },
          },
          referredCustomer: {
            select: {
              id: true,
              contactName: true,
              businessName: true,
              customerType: true,
              contactEmail: true,
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          referrer: {
            select: { id: true, user: { select: { id: true, fullName: true, email: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.referral.count({ where }),
    ]);

    // For customer referrers, fetch the referrerUser + customer info
    const referrerUserIds = referrals
      .map((r) => r.referrerUserId)
      .filter((id): id is string => !!id);
    const referrerUsers = referrerUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: referrerUserIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const referrerCustomers = referrerUserIds.length
      ? await this.prisma.customer.findMany({
          where: { userId: { in: referrerUserIds } },
          select: {
            userId: true,
            businessName: true,
            contactName: true,
            customerType: true,
          },
        })
      : [];
    const referrerUserById = new Map(referrerUsers.map((u) => [u.id, u]));
    const referrerCustomerByUserId = new Map(referrerCustomers.map((c) => [c.userId, c]));

    return {
      referrals: referrals.map((r) => {
        const referrerUser = r.referrerUserId ? referrerUserById.get(r.referrerUserId) : null;
        const referrerCustomer = r.referrerUserId
          ? referrerCustomerByUserId.get(r.referrerUserId)
          : null;
        return {
          id: r.id,
          referralCode: r.referralCode,
          status: r.status,
          referralType: r.referralType,
          payoutModel: r.payoutModel,
          referredEmail: r.referredEmail,
          referredDriver: r.referredDriver
            ? {
                id: r.referredDriver.id,
                name: r.referredDriver.user?.fullName || null,
                email: r.referredDriver.user?.email || null,
              }
            : null,
          referredCustomer: r.referredCustomer
            ? {
                id: r.referredCustomer.id,
                name:
                  r.referredCustomer.businessName ||
                  r.referredCustomer.contactName ||
                  r.referredCustomer.user?.fullName ||
                  null,
                email:
                  r.referredCustomer.contactEmail || r.referredCustomer.user?.email || null,
                customerType: r.referredCustomer.customerType,
              }
            : null,
          referrer: r.referrer
            ? {
                id: r.referrer.id,
                name: r.referrer.user?.fullName || null,
                email: r.referrer.user?.email || null,
                type: "DRIVER",
              }
            : referrerUser
              ? {
                  id: referrerUser.id,
                  name:
                    referrerCustomer?.businessName ||
                    referrerCustomer?.contactName ||
                    referrerUser.fullName ||
                    null,
                  email: referrerUser.email || null,
                  type: "CUSTOMER",
                  customerType: referrerCustomer?.customerType ?? null,
                }
              : null,
          tripsCompleted: r.tripsCompleted,
          completedPaidDeliveries: r.completedPaidDeliveries,
          requiredDeliveries: r.requiredDeliveries,
          rewardTrigger: r.rewardTrigger,
          referredGetsReward: r.referredGetsReward,
          referredRewardAmount: r.referredRewardAmount,
          referredRewardPaidAt: r.referredRewardPaidAt,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Detail view for a single referral — full info including the
   * associated ReferralCredit rows + DriverPayout rows.
   */
  async getAdminReferralDetail(referralId: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        id: true,
        referralCode: true,
        status: true,
        referralType: true,
        payoutModel: true,
        referrerId: true,
        referrerUserId: true,
        referredDriverId: true,
        referredCustomerId: true,
        referredEmail: true,
        referredPhone: true,
        rewardTrigger: true,
        requiredDeliveries: true,
        tripsCompleted: true,
        completedPaidDeliveries: true,
        windowStartDate: true,
        windowEndDate: true,
        expiresAt: true,
        referredGetsReward: true,
        referredRewardAmount: true,
        referredRewardPaidAt: true,
        referredPayoutId: true,
        createdAt: true,
        updatedAt: true,
        referrer: {
          select: { id: true, user: { select: { id: true, fullName: true, email: true } } },
        },
        referredDriver: {
          select: { id: true, user: { select: { id: true, fullName: true, email: true } } },
        },
        referredCustomer: {
          select: {
            id: true,
            contactName: true,
            businessName: true,
            contactEmail: true,
            customerType: true,
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!referral) {
      throw new NotFoundException("Referral not found");
    }

    // Look up the referrer user/customer if referrerUserId is set
    let referrerUser: any = null;
    let referrerCustomer: any = null;
    if (referral.referrerUserId) {
      referrerUser = await this.prisma.user.findUnique({
        where: { id: referral.referrerUserId },
        select: { id: true, fullName: true, email: true },
      });
      referrerCustomer = await this.prisma.customer.findUnique({
        where: { userId: referral.referrerUserId },
        select: { id: true, businessName: true, contactName: true, customerType: true },
      });
    }

    // Pull ReferralCredit + DriverPayout rows for this referral
    const [credits, payouts] = await Promise.all([
      this.prisma.referralCredit.findMany({
        where: { referralId },
        select: {
          id: true,
          amountCents: true,
          reason: true,
          status: true,
          appliedAt: true,
          stripeInvoiceId: true,
          createdAt: true,
          customerId: true,
          deliveryId: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.driverPayout.findMany({
        where: {
          OR: [
            { referredByReferral: { id: referralId } },
            { referral: { id: referralId } },
          ],
        },
        select: {
          id: true,
          type: true,
          status: true,
          netAmount: true,
          grossAmount: true,
          failureMessage: true,
          tierNumber: true,
          createdAt: true,
          paidAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      referral: {
        ...referral,
        referrerUser,
        referrerCustomer,
      },
      credits,
      payouts: payouts.map((p) => ({
        id: p.id,
        type: p.type,
        status: p.status,
        amount: p.netAmount,
        failureMessage: p.failureMessage,
        tierNumber: p.tierNumber,
        isPerDelivery: p.failureMessage?.startsWith("PER_DELIVERY:") ?? false,
        perDeliveryId: p.failureMessage?.startsWith("PER_DELIVERY:")
          ? p.failureMessage.slice("PER_DELIVERY:".length)
          : null,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      })),
    };
  }

  /**
   * Manual override: admin sets the status of a referral.
   *
   * Allowed transitions:
   *   - PENDING/REGISTERED/ONBOARDING_COMPLETE/TRIPPING/COMPLETED → REWARD_PAID
   *     (force-fires the one-shot referred reward if applicable)
   *   - any → EXPIRED (admin manually expires)
   *   - any → CLOSED (admin closes without payout)
   *
   * Refuses to transition FROM REWARD_PAID (already paid out — would
   * require a clawback, which is a separate flow).
   *
   * If transitioning to REWARD_PAID and the referral has a referred
   * driver with referredGetsReward=true and no referredRewardPaidAt,
   * fires the one-shot referred reward via the payout provider.
   *
   * NOTE: This is a deliberate admin escape hatch. Use sparingly —
   * prefer fixing the underlying issue (program config, expiry window,
   * etc.) so the trigger fires naturally next time.
   *
   * Returns the updated referral.
   */
  async manualOverrideReferralStatus(
    referralId: string,
    newStatus: "REWARD_PAID" | "EXPIRED" | "CLOSED",
    reason?: string,
  ) {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        id: true,
        status: true,
        referredDriverId: true,
        referredGetsReward: true,
        referredRewardAmount: true,
        referredRewardPaidAt: true,
        referrerId: true,
      },
    });
    if (!referral) {
      throw new NotFoundException("Referral not found");
    }
    if (referral.status === "REWARD_PAID" && newStatus !== "REWARD_PAID") {
      throw new BadRequestException(
        "Cannot change status of a REWARD_PAID referral — would require a clawback. " +
        "Use the DriverPayout adjustment flow instead."
      );
    }
    if (referral.status === newStatus) {
      return { referral, message: "Status unchanged" };
    }

    // If transitioning to REWARD_PAID, fire the referred reward payout
    // (idempotent via referredPayoutId)
    if (
      newStatus === "REWARD_PAID" &&
      referral.referredGetsReward &&
      !referral.referredRewardPaidAt &&
      referral.referredDriverId
    ) {
      const config = await this.appSettingService.getReferralProgramSettings();
      const amount = referral.referredRewardAmount ?? config.referredRewardAmount ?? 0;
      if (amount > 0) {
        try {
          // Use the payout provider directly — this is an admin override,
          // so we DON'T fire the referrer tier payouts (that would be
          // double-paying the referrer if the trigger already fired).
          await this.payoutProvider.createReferredRewardPayout({
            referredDriverId: referral.referredDriverId,
            amount,
            referralId: referral.id,
          });
        } catch (err: any) {
          // Log but don't fail the override — the status update is the
          // primary action.
          console.error(
            `[manualOverride] Failed to fire referred reward payout: ${err.message}`
          );
        }
      }
    }

    const updated = await this.prisma.referral.update({
      where: { id: referralId },
      data: {
        status: newStatus,
        ...(newStatus === "REWARD_PAID" && !referral.referredRewardPaidAt
          ? { referredRewardPaidAt: new Date() }
          : {}),
      },
      select: { id: true, status: true, referredRewardPaidAt: true },
    });

    return {
      referral: updated,
      message: `Status changed from ${referral.status} to ${newStatus}${reason ? ` (reason: ${reason})` : ""}`,
    };
  }

  /**
   * Paginated list of all ReferralCredit rows (admin view). Supports
   * filtering by status, customerId, referralId.
   */
  async getAdminReferralCreditsList(opts: {
    page?: number;
    pageSize?: number;
    status?: "PENDING" | "APPLIED" | "EXPIRED";
    customerId?: string;
    referralId?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.referralId) where.referralId = opts.referralId;

    const [credits, total] = await Promise.all([
      this.prisma.referralCredit.findMany({
        where,
        select: {
          id: true,
          referralId: true,
          customerId: true,
          deliveryId: true,
          amountCents: true,
          reason: true,
          status: true,
          appliedAt: true,
          stripeInvoiceId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.referralCredit.count({ where }),
    ]);

    return { credits, total, page, pageSize };
  }

  /**
   * Manual apply: admin marks a PENDING ReferralCredit as APPLIED.
   *
   * Used when an admin has manually applied the credit to a Stripe
   * invoice outside of the automated flow (e.g. via the Stripe
   * dashboard). Sets `appliedAt = now` and the provided `stripeInvoiceId`.
   *
   * Refuses to transition non-PENDING credits.
   */
  async manualApplyReferralCredit(creditId: string, stripeInvoiceId?: string) {
    const credit = await this.prisma.referralCredit.findUnique({
      where: { id: creditId },
      select: { id: true, status: true },
    });
    if (!credit) {
      throw new NotFoundException("ReferralCredit not found");
    }
    if (credit.status !== "PENDING") {
      throw new BadRequestException(
        `Cannot apply a credit in status ${credit.status}. Only PENDING credits can be applied.`
      );
    }
    const updated = await this.prisma.referralCredit.update({
      where: { id: creditId },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        ...(stripeInvoiceId ? { stripeInvoiceId } : {}),
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        stripeInvoiceId: true,
      },
    });
    return { credit: updated };
  }

  /**
   * Manual expire: admin marks a PENDING ReferralCredit as EXPIRED.
   *
   * Used when an admin wants to remove a credit that was issued in
   * error (e.g. wrong delivery, wrong customer) without applying it
   * to an invoice.
   *
   * Refuses to transition non-PENDING credits (an APPLIED credit was
   * already used on an invoice and can't be expired; an EXPIRED credit
   * is already in the target state).
   */
  async manualExpireReferralCredit(creditId: string, reason?: string) {
    const credit = await this.prisma.referralCredit.findUnique({
      where: { id: creditId },
      select: { id: true, status: true, reason: true },
    });
    if (!credit) {
      throw new NotFoundException("ReferralCredit not found");
    }
    if (credit.status !== "PENDING") {
      throw new BadRequestException(
        `Cannot expire a credit in status ${credit.status}. Only PENDING credits can be expired.`
      );
    }
    const updated = await this.prisma.referralCredit.update({
      where: { id: creditId },
      data: {
        status: "EXPIRED",
        // Append the admin reason to the existing reason for audit trail
        reason: reason ? `${credit.reason} [admin-expired: ${reason}]` : `${credit.reason} [admin-expired]`,
      },
      select: { id: true, status: true, reason: true },
    });
    return { credit: updated };
  }

// ============================================================
  // CUSTOMER-REFERRER ENDPOINTS (Phase 2)
  // ============================================================
  // The Customer-referrer flow mirrors the Driver-referrer flow but uses
  // Customer.referralCode (instead of Driver.referralCode) and creates
  // ReferralCredit rows (instead of DriverPayout rows) for per-delivery
  // payouts. Customer referrers can refer BOTH new customers (dealer or
  // private) AND new drivers.

  /**
   * Get or create the customer's unique referral code.
   *
   * Phase 2 (V2): the code is stored on `Customer.referralCode` (a unique
   * column added by the 20260831120000_referral_v2 migration).
   */
  async getMyCustomerReferralCode(customerId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { referralCode: true, referralCodeLocked: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }
    if (customer.referralCode) {
      return customer.referralCode;
    }

    // Don't create new codes if the program is paused
    const config = await this.appSettingService.getReferralProgramSettings();
    if (!config.isActive) {
      throw new BadRequestException(
        "The referral program is currently paused. Please try again later."
      );
    }

    const code = await this.generateUniqueCode();

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { referralCode: code },
    });

    return code;
  }

  /**
   * Set a custom referral code for the customer (instead of the auto-generated one).
   * Validates the code against the regex + blocklist + collision check.
   * Once set, the code is locked and cannot be changed (referralCodeLocked=true).
   */
  async setMyCustomerReferralCode(customerId: string, newCode: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { referralCode: true, referralCodeLocked: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }
    if (customer.referralCodeLocked) {
      throw new BadRequestException(
        "Your referral code is locked and cannot be changed. Please contact support if you need to change it."
      );
    }

    // Validate format + blocklist
    const validation = validateCustomReferralCode(newCode);
    if (!validation.ok) {
      const reason =
        validation.reason === "EMPTY"
          ? "Referral code is required."
          : validation.reason === "INVALID_FORMAT"
            ? "Referral code must be 8 characters, using only letters A–Z and digits 2–9 (no 0, 1, I, or O)."
            : validation.reason === "BLOCKLISTED"
              ? "This referral code is not available. Please choose another."
              : "Invalid referral code.";
      throw new BadRequestException(reason);
    }

    const upperCode = newCode.toUpperCase();

    // Collision check across all three tables
    const [driver, customerCollision, referral] = await Promise.all([
      this.prisma.driver.findFirst({
        where: { referralCode: upperCode },
        select: { id: true },
      }),
      this.prisma.customer.findFirst({
        where: { referralCode: upperCode },
        select: { id: true },
      }),
      this.prisma.referral.findFirst({
        where: { referralCode: upperCode },
        select: { id: true },
      }),
    ]);
    if (driver || customerCollision || referral) {
      throw new BadRequestException(
        "This referral code is already in use. Please choose another."
      );
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { referralCode: upperCode, referralCodeLocked: true },
    });

    return upperCode;
  }

  /**
   * Same as setMyCustomerReferralCode but for drivers.
   */
  async setMyDriverReferralCode(driverId: string, newCode: string): Promise<string> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { referralCode: true, referralCodeLocked: true },
    });
    if (!driver) {
      throw new NotFoundException("Driver profile not found");
    }
    if (driver.referralCodeLocked) {
      throw new BadRequestException(
        "Your referral code is locked and cannot be changed. Please contact support if you need to change it."
      );
    }

    const validation = validateCustomReferralCode(newCode);
    if (!validation.ok) {
      const reason =
        validation.reason === "EMPTY"
          ? "Referral code is required."
          : validation.reason === "INVALID_FORMAT"
            ? "Referral code must be 8 characters, using only letters A–Z and digits 2–9 (no 0, 1, I, or O)."
            : validation.reason === "BLOCKLISTED"
              ? "This referral code is not available. Please choose another."
              : "Invalid referral code.";
      throw new BadRequestException(reason);
    }

    const upperCode = newCode.toUpperCase();

    const [driverCollision, customerCollision, referral] = await Promise.all([
      this.prisma.driver.findFirst({
        where: { referralCode: upperCode },
        select: { id: true },
      }),
      this.prisma.customer.findFirst({
        where: { referralCode: upperCode },
        select: { id: true },
      }),
      this.prisma.referral.findFirst({
        where: { referralCode: upperCode },
        select: { id: true },
      }),
    ]);
    if (driverCollision || customerCollision || referral) {
      throw new BadRequestException(
        "This referral code is already in use. Please choose another."
      );
    }

    await this.prisma.driver.update({
      where: { id: driverId },
      data: { referralCode: upperCode, referralCodeLocked: true },
    });

    return upperCode;
  }

  /**
   * Apply a referral code when a new CUSTOMER signs up (dealer or private).
   *
   * The referrer can be EITHER a Customer OR a Driver (both are supported
   * via the V2 referrer lookup). The referred side is always a Customer.
   * The payoutModel is always PER_DELIVERY — customer-referrer payouts
   * are per-delivery credits applied to the customer's next invoice.
   *
   * Mirrors applyReferral() in shape but for customer referred parties.
   */
  async applyCustomerReferral(customerId: string, referralCode: string) {
    if (!referralCode) {
      throw new BadRequestException("referralCode is required");
    }

    const upperCode = referralCode.toUpperCase();

    // ── Look up the referrer (same V2 path as applyReferral) ──
    const [driverReferrer, customerReferrer, legacyReferral] = await Promise.all([
      this.prisma.driver.findFirst({
        where: { referralCode: upperCode },
        select: { id: true, referralCode: true, userId: true },
      }),
      this.prisma.customer.findFirst({
        where: { referralCode: upperCode },
        select: { id: true, referralCode: true, userId: true },
      }),
      this.prisma.referral.findFirst({
        where: { referralCode: upperCode, status: "PENDING" },
        select: { id: true, referrerId: true, referralCode: true },
      }),
    ]);

    let referrerDriverId: string | null = null;
    let referrerUserId: string | null = null;
    let referralType: ReferralTypeDto;
    let legacyReferralId: string | null = legacyReferral?.id ?? null;

    if (driverReferrer) {
      referrerDriverId = driverReferrer.id;
      referrerUserId = driverReferrer.userId;
      referralType = ReferralTypeDto.DRIVER;
    } else if (customerReferrer) {
      if (customerReferrer.id === customerId) {
        throw new BadRequestException("You cannot use your own referral code");
      }
      referrerUserId = customerReferrer.userId;
      referralType = ReferralTypeDto.CUSTOMER;
    } else if (legacyReferral) {
      referrerDriverId = legacyReferral.referrerId;
      referralType = ReferralTypeDto.DRIVER;
    } else {
      throw new NotFoundException("Invalid or expired referral code");
    }

    // ── Per-referred-party uniqueness check ──
    const existingLink = await this.prisma.referral.findFirst({
      where: { referredCustomerId: customerId },
      select: { id: true },
    });
    if (existingLink) {
      throw new BadRequestException("You already used a referral code");
    }

    // ── Read live config + validate program state ──
    const config = await this.appSettingService.getReferralProgramSettings();
    if (!config.isActive) {
      throw new BadRequestException(
        "The referral program is currently paused. Please try again later."
      );
    }
    if (referralType === ReferralTypeDto.DRIVER && !config.driverReferralsEnabled) {
      throw new BadRequestException(
        "Driver-to-customer referrals are currently disabled."
      );
    }
    if (referralType === ReferralTypeDto.CUSTOMER && !config.customerReferralsEnabled) {
      throw new BadRequestException(
        "Customer referrals are currently disabled."
      );
    }

    // Compute expiresAt + validate window
    let expiresAt: Date | null = null;
    let windowStartDate: Date | null = null;
    let windowEndDate: Date | null = null;
    const now = new Date();

    if (config.timeLimitMode === ReferralTimeLimitMode.CALENDAR_RANGE) {
      windowStartDate = config.windowStartDate ? new Date(config.windowStartDate) : null;
      windowEndDate = config.windowEndDate ? new Date(config.windowEndDate) : null;
      if (!windowStartDate || !windowEndDate) {
        throw new BadRequestException(
          "Referral program window is not properly configured. Please contact support."
        );
      }
      if (now < windowStartDate) {
        throw new BadRequestException(
          "The referral program hasn't started yet. Please try again later."
        );
      }
      if (now > windowEndDate) {
        throw new BadRequestException(
          "The referral program has ended. Please try again later."
        );
      }
      expiresAt = windowEndDate;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { contactEmail: true, user: { select: { email: true } } },
    });

    // Customer referrals are always PER_DELIVERY (a customer earns per-delivery
    // credits, not tier payouts). Driver referrers referring a customer also
    // use PER_DELIVERY (the customer side of the relationship is always
    // credit-based; the driver side gets the per-delivery referrer amount
    // via DriverPayout).
    const payoutModel: ReferralPayoutModelDto = ReferralPayoutModelDto.PER_DELIVERY;

    await this.prisma.referral.create({
      data: {
        referralCode: upperCode,
        referrerId: referrerDriverId,
        referrerUserId,
        referredCustomerId: customerId,
        referredDriverId: null,
        referredEmail: customer?.contactEmail || customer?.user?.email || null,
        status: "REGISTERED",
        referralType,
        payoutModel,
        rewardTrigger: config.rewardTrigger,
        requiredDeliveries: config.requiredDeliveries,
        windowStartDate,
        windowEndDate,
        expiresAt,
        referredGetsReward: config.referredGetsReward,
        referredRewardAmount: config.referredGetsReward ? config.referredRewardAmount : null,
      },
    });

    // ── Best-effort: delete the legacy code-holder Referral row ──
    if (legacyReferralId) {
      try {
        await this.prisma.referral.deleteMany({
          where: {
            id: legacyReferralId,
            referredDriverId: null,
            referredCustomerId: null,
            status: "PENDING",
          },
        });
      } catch {
        // ignore — best-effort cleanup
      }
    }

    return { success: true, message: "Referral code applied successfully" };
  }

  /**
   * List all referrals made by this customer.
   */
  async getMyCustomerReferrals(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { userId: true },
    });
    if (!customer) return [];

    const referrals = await this.prisma.referral.findMany({
      where: {
        referrerUserId: customer.userId,
        referralType: ReferralTypeDto.CUSTOMER,
        // Exclude code-holder rows (no referred party)
        OR: [
          { referredCustomerId: { not: null } },
          { referredDriverId: { not: null } },
          { referredEmail: { not: null } },
        ],
      },
      select: {
        id: true,
        referralCode: true,
        status: true,
        referralType: true,
        payoutModel: true,
        completedPaidDeliveries: true,
        expiresAt: true,
        createdAt: true,
        referredCustomer: {
          select: {
            id: true,
            contactName: true,
            contactEmail: true,
            businessName: true,
            customerType: true,
          },
        },
        referredDriver: {
          select: {
            id: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        referredEmail: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return referrals;
  }

  /**
   * Get referral stats for a customer referrer.
   *
   * Returns counts + total credits earned (from ReferralCredit rows).
   * For the customer dashboard "Refer & Earn" card.
   */
  async getMyCustomerReferralStats(customerId: string) {
    // Find referrals made by this customer (via referrerUserId)
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { userId: true, referralCode: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }

    const referrals = await this.prisma.referral.findMany({
      where: {
        referrerUserId: customer.userId,
        referralType: ReferralTypeDto.CUSTOMER,
      },
      select: {
        id: true,
        status: true,
        completedPaidDeliveries: true,
        payoutModel: true,
        referredCustomer: { select: { id: true } },
        referredDriver: { select: { id: true } },
        referredEmail: true,
      },
    });

    // Real referrals only (have a referred party)
    const realReferrals = referrals.filter(
      (r) => r.referredCustomer || r.referredDriver || r.referredEmail,
    );

    let successfulReferrals = 0;
    let activeReferrals = 0;
    let expiredReferrals = 0;
    let totalPaidDeliveries = 0;

    for (const r of realReferrals) {
      if (r.status === "REWARD_PAID" || r.status === "COMPLETED") {
        successfulReferrals++;
      } else if (r.status === "EXPIRED" || r.status === "CLOSED") {
        expiredReferrals++;
      } else {
        activeReferrals++;
      }
      totalPaidDeliveries += r.completedPaidDeliveries || 0;
    }

    // Sum of all ReferralCredit rows for this customer (referrer)
    const credits = await this.prisma.referralCredit.findMany({
      where: { customerId, status: { in: ["PENDING", "APPLIED"] } },
      select: { amountCents: true, status: true },
    });
    const totalCreditsEarnedCents = credits
      .filter((c) => c.status === "APPLIED")
      .reduce((s, c) => s + c.amountCents, 0);
    const pendingCreditsCents = credits
      .filter((c) => c.status === "PENDING")
      .reduce((s, c) => s + c.amountCents, 0);

    const config = await this.appSettingService.getReferralProgramSettings();

    return {
      referralCode: customer.referralCode,
      totalReferrals: realReferrals.length,
      successfulReferrals,
      activeReferrals,
      expiredReferrals,
      totalPaidDeliveries,
      // Credits in cents (frontend can format as $X.XX)
      totalCreditsEarnedCents,
      pendingCreditsCents,
      // Live config so the UI can show the per-delivery amount
      perDeliveryReferrerAmountCents: config.perDeliveryReferrerAmountCents,
      perDeliveryReferredBonusCents: config.perDeliveryReferredBonusCents,
      perDeliveryBonusTriggerCount: config.perDeliveryBonusTriggerCount,
      programIsActive: config.isActive,
      customerReferralsEnabled: config.customerReferralsEnabled,
    };
  }

  /**
   * Public lookup: resolve a referral code to the referrer's display name.
   * Used by the public /test-referral/:code page to confirm to the user
   * whose code they're about to use BEFORE redirecting to signup.
   *
   * Returns:
   *   - found: true if the code is valid
   *   - referrerName: the referrer's display name (first name + last initial
   *     for privacy; or business name for business customers; or "A 101 Drivers
   *     driver" for drivers if they don't have a public name)
   *   - referrerType: "DRIVER" | "CUSTOMER"
   *   - programActive: whether the program is currently accepting new referrals
   *
   * No auth required — this is a public endpoint. Returns minimal info
   * (just enough for the user to recognize whose code it is).
   */
  async publicResolveReferralCode(code: string): Promise<{
    found: boolean;
    referrerName: string | null;
    referrerType: ReferralTypeDto | null;
    programActive: boolean;
  }> {
    if (!code) return { found: false, referrerName: null, referrerType: null, programActive: false };

    const upperCode = code.toUpperCase();

    const [driverReferrer, customerReferrer, legacyReferral] = await Promise.all([
      this.prisma.driver.findFirst({
        where: { referralCode: upperCode },
        select: { id: true, userId: true, user: { select: { fullName: true } } },
      }),
      this.prisma.customer.findFirst({
        where: { referralCode: upperCode },
        select: { id: true, userId: true, contactName: true, businessName: true, customerType: true, user: { select: { fullName: true } } },
      }),
      this.prisma.referral.findFirst({
        where: { referralCode: upperCode, status: "PENDING" },
        select: { id: true, referrerId: true },
      }),
    ]);

    const config = await this.appSettingService.getReferralProgramSettings();

    if (driverReferrer) {
      return {
        found: true,
        referrerName: driverReferrer.user?.fullName
          ? this.privacyMaskName(driverReferrer.user.fullName)
          : "A 101 Drivers driver",
        referrerType: ReferralTypeDto.DRIVER,
        programActive: config.isActive && config.driverReferralsEnabled,
      };
    }

    if (customerReferrer) {
      const name =
        customerReferrer.businessName ||
        customerReferrer.contactName ||
        customerReferrer.user?.fullName ||
        "A 101 Drivers customer";
      return {
        found: true,
        // For business customers, the business name is public (not masked).
        // For private customers, mask the personal name.
        referrerName:
          customerReferrer.customerType === "BUSINESS"
            ? name
            : this.privacyMaskName(name),
        referrerType: ReferralTypeDto.CUSTOMER,
        programActive: config.isActive && config.customerReferralsEnabled,
      };
    }

    if (legacyReferral) {
      // Legacy code-holder row — referrer is a driver
      const driver = legacyReferral.referrerId
        ? await this.prisma.driver.findUnique({
            where: { id: legacyReferral.referrerId },
            select: { user: { select: { fullName: true } } },
          })
        : null;
      return {
        found: true,
        referrerName: driver?.user?.fullName
          ? this.privacyMaskName(driver.user.fullName)
          : "A 101 Drivers driver",
        referrerType: ReferralTypeDto.DRIVER,
        programActive: config.isActive && config.driverReferralsEnabled,
      };
    }

    return { found: false, referrerName: null, referrerType: null, programActive: config.isActive };
  }

  /**
   * Privacy-mask a personal name for public display.
   * "John Smith" → "John S."
   * "Madonna" → "Madonna"
   * "" → ""
   */
  private privacyMaskName(name: string): string {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  /**
   * Public lookup by name — anyone can search for a referrer by name and
   * get their referral code back. Used by the /test-referral (no code)
   * public lookup page.
   *
   * Searches:
   *   - Driver.referralCode where Driver.user.fullName contains the query
   *   - Customer.referralCode where Customer.user.fullName contains the query
   *     OR Customer.businessName contains the query (for business customers)
   *
   * Returns up to 10 results with privacy-masked names. Only returns
   * referrers whose referral program is active (customerReferralsEnabled
   * or driverReferralsEnabled depending on type).
   *
   * No auth required — this is a public endpoint.
   */
  async publicLookupByName(query: string): Promise<{
    results: Array<{
      code: string;
      referrerName: string;
      referrerType: ReferralTypeDto;
    }>;
  }> {
    if (!query || query.trim().length < 2) {
      return { results: [] };
    }

    const searchTerm = query.trim();
    const config = await this.appSettingService.getReferralProgramSettings();

    // Search drivers + customers in parallel
    const [drivers, customers] = await Promise.all([
      // Only search if driver referrals are enabled
      config.driverReferralsEnabled
        ? this.prisma.driver.findMany({
            where: {
              referralCode: { not: null },
              user: {
                fullName: { contains: searchTerm, mode: "insensitive" },
              },
            },
            select: {
              referralCode: true,
              user: { select: { fullName: true } },
            },
            take: 10,
          })
        : [],
      // Only search if customer referrals are enabled
      config.customerReferralsEnabled
        ? this.prisma.customer.findMany({
            where: {
              referralCode: { not: null },
              OR: [
                { user: { fullName: { contains: searchTerm, mode: "insensitive" } } },
                { businessName: { contains: searchTerm, mode: "insensitive" } },
                { contactName: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
            select: {
              referralCode: true,
              businessName: true,
              contactName: true,
              customerType: true,
              user: { select: { fullName: true } },
            },
            take: 10,
          })
        : [],
    ]);

    const results: Array<{
      code: string;
      referrerName: string;
      referrerType: ReferralTypeDto;
    }> = [];

    // Add driver results
    for (const d of drivers) {
      if (d.referralCode) {
        results.push({
          code: d.referralCode,
          referrerName: d.user?.fullName
            ? this.privacyMaskName(d.user.fullName)
            : "A 101 Drivers driver",
          referrerType: ReferralTypeDto.DRIVER,
        });
      }
    }

    // Add customer results
    for (const c of customers) {
      if (c.referralCode) {
        const name =
          c.customerType === "BUSINESS"
            ? (c.businessName || c.contactName || c.user?.fullName || "A 101 Drivers customer")
            : this.privacyMaskName(c.contactName || c.user?.fullName || "A 101 Drivers customer");
        results.push({
          code: c.referralCode,
          referrerName: name,
          referrerType: ReferralTypeDto.CUSTOMER,
        });
      }
    }

    // Limit to 10 total results
    return { results: results.slice(0, 10) };
  }
}
