import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import {
  ReferralRewardTrigger,
  ReferralTimeLimitMode,
} from "../appSetting/dto/appSetting.dto";

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingService: AppSettingService,
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
   * Get or create the driver's unique referral code.
   *
   * NOTE: If the program isActive=false, we DON'T create a code-holder
   * row — the driver Wallet UI hides the "Refer a Friend" card, so the
   * driver won't reach this endpoint anyway. But we check here as a
   * safety net.
   */
  async getMyReferralCode(driverId: string): Promise<string> {
    const existingReferral = await this.prisma.referral.findFirst({
      where: { referrerId: driverId },
      select: { referralCode: true },
    });

    if (existingReferral) {
      return existingReferral.referralCode;
    }

    // Don't create new code-holder rows if the program is paused
    const config = await this.appSettingService.getReferralProgramSettings();
    if (!config.isActive) {
      throw new BadRequestException(
        "The referral program is currently paused. Please try again later."
      );
    }

    const code = await this.generateUniqueCode();

    await this.prisma.referral.create({
      data: {
        referralCode: code,
        referrerId: driverId,
        status: "PENDING",
      },
    });

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

    const referral = await this.prisma.referral.findFirst({
      where: { referralCode, status: "PENDING" },
    });

    if (!referral) {
      throw new NotFoundException("Invalid or expired referral code");
    }

    if (referral.referrerId === driverId) {
      throw new BadRequestException("You cannot use your own referral code");
    }

    const existingLink = await this.prisma.referral.findFirst({
      where: { referredDriverId: driverId },
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

    // ── Stamp the per-referral policy snapshot onto the new row ──
    // This freezes the policy at sign-up time so future admin changes
    // don't retroactively change pending referrals.
    await this.prisma.referral.create({
      data: {
        referralCode,
        referrerId: referral.referrerId,
        referredDriverId: driverId,
        referredEmail: driver?.user?.email || null,
        status: "REGISTERED",
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
   */
  private async generateUniqueCode(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code: string;
    let exists = true;

    while (exists) {
      code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const found = await this.prisma.referral.findFirst({
        where: { referralCode: code },
      });
      exists = !!found;
    }

    return code!;
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
   * Returns:
   *   - totalReferrals: count of all real referrals (excluding code-holder rows)
   *   - successfulReferrals: count where status = REWARD_PAID
   *   - activeReferrals: count in progress (PENDING/REGISTERED/etc.)
   *   - expiredReferrals: count where status = EXPIRED
   *   - totalPaidOut: sum of all REFERRAL_REFERRER + REFERRAL_REFERRED
   *     payouts (status = PAID)
   *   - totalPending: sum of all REFERRAL_* payouts (status = PENDING/ELIGIBLE)
   *   - uniqueReferrers: count of distinct referrerIds
   */
  async getAdminProgramStats() {
    const [
      totalReferrals,
      successfulReferrals,
      activeReferrals,
      expiredReferrals,
      uniqueReferrersAgg,
      paidPayouts,
      pendingPayouts,
    ] = await Promise.all([
      this.prisma.referral.count({
        where: {
          OR: [
            { referredDriverId: { not: null } },
            { referredEmail: { not: null } },
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
      this.prisma.referral.groupBy({
        by: ["referrerId"],
        where: {
          OR: [
            { referredDriverId: { not: null } },
            { referredEmail: { not: null } },
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
    ]);

    const totalPaidOut = paidPayouts.reduce((s, p) => s + p.netAmount, 0);
    const totalPending = pendingPayouts.reduce((s, p) => s + p.netAmount, 0);

    return {
      totalReferrals,
      successfulReferrals,
      activeReferrals,
      expiredReferrals,
      uniqueReferrers: uniqueReferrersAgg.length,
      totalPaidOut,
      totalPending,
    };
  }

  /**
   * Paginated list of referrers with their stats.
   *
   * Returns referrer name, # of referrals, # successful, # trips total
   * across all their referrals, $ earned from referrals.
   *
   * For the admin table on /admin-referral-program.
   */
  async getAdminReferrersList(opts: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    // Find all referrerIds that have at least one real referral
    const referrerIds = await this.prisma.referral.findMany({
      where: {
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

    const total = referrerIds.length;
    const pagedIds = referrerIds.slice(skip, skip + pageSize).map((r) => r.referrerId);

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
          totalReferrals: referrals.length,
          successfulReferrals,
          totalTrips,
          totalEarned,
          lastPaidTier: driver?.lastPaidReferrerTier ?? 0,
        };
      })
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
}
